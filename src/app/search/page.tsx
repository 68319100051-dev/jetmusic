'use client';
import { useState, useEffect, useCallback } from 'react';
import { Search as SearchIcon, Loader2, Play, Heart, Plus, Music, X, History, Trash2 } from 'lucide-react';
import TrackCard from '@/components/TrackCard';
import TrackRow from '@/components/TrackRow';
import { usePlayer } from '@/contexts/PlayerContext';
import { usePlaylist } from '@/contexts/PlaylistContext';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import { useDiscovery } from '@/contexts/DiscoveryContext';
import { SkeletonCard } from '@/components/Skeleton';
import { useSearchParams, useRouter } from 'next/navigation';
import styles from './page.module.css';

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = searchParams.get('q') || '';
  
  const [localQuery, setLocalQuery] = useState(query);

  const { playTrack } = usePlayer();
  const { user, isLoaded, addToHistory, syncUserData } = useAuth();
  const { showToast } = useToast();
  const { trending, refreshTrending, isTrendingLoaded } = useDiscovery();
  
  const searchHistory = user?.searchHistory || [];
  const listeningHistory = user?.history || [];
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLocalQuery(query);
  }, [query]);
  const [trendingLoading, setTrendingLoading] = useState(!isTrendingLoaded);
  const clearSearchHistory = () => {
    if (!user) return;
    syncUserData({ searchHistory: [] });
    showToast('ล้างประวัติการค้นหาแล้ว', 'success');
  };

  const addSearchQuery = useCallback((q: string) => {
    if (!q.trim() || !user) return;
    const current = user.searchHistory || [];
    if (current[0] === q) return; // Already most recent
    const next = [q, ...current.filter(item => item !== q)].slice(0, 10);
    syncUserData({ searchHistory: next });
  }, [user, syncUserData]);

  const removeSearchQuery = (q: string) => {
    if (!user) return;
    const next = (user.searchHistory || []).filter(item => item !== q);
    syncUserData({ searchHistory: next });
  };

  const fetchResults = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (data.results) {
        setResults(data.results.slice(0, 24));
      }
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchResults(localQuery);
      if (localQuery !== query) {
        if (localQuery) {
          router.replace(`/search?q=${encodeURIComponent(localQuery)}`);
          addSearchQuery(localQuery);
        } else {
          router.replace(`/search`);
        }
      }
    }, 800);
    return () => clearTimeout(timeout);
  }, [localQuery, fetchResults, query, router]);

  useEffect(() => {
    if (!query && !isTrendingLoaded) {
      setTrendingLoading(true);
      refreshTrending().finally(() => setTrendingLoading(false));
    } else if (!query && isTrendingLoaded) {
      setTrendingLoading(false);
    }
  }, [query, isTrendingLoaded, refreshTrending]);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.searchWrapper}>
          <SearchIcon className={styles.searchIcon} size={20} />
          <input
            type="text"
            className={styles.searchInput}
            placeholder="ค้นหาเพลง, ศิลปิน, หรืออัลบั้ม..."
            value={localQuery}
            onChange={(e) => setLocalQuery(e.target.value)}
            autoFocus
          />
          {localQuery && (
            <button className={styles.clearBtn} onClick={() => { setLocalQuery(''); router.replace('/search'); }}>
              <X size={18} />
            </button>
          )}
        </div>
      </header>

      <main className={styles.resultsArea}>
        {loading ? (
          <div className={styles.listArea}>
            {Array(8).fill(0).map((_, i) => (
              <div key={`skel-search-row-${i}`} style={{ height: 60, width: '100%', background: 'rgba(255,255,255,0.03)', borderRadius: 8, marginBottom: 8, animation: 'pulse 1.5s infinite' }} />
            ))}
          </div>
        ) : results.length > 0 ? (
          <div className={styles.listArea}>
            <h2 className={styles.sectionHeading}>ผลการค้นหาที่ดีที่สุด</h2>
          {results.map((track, index) => (
            <div key={track.id} onClick={() => addToHistory(track)}>
              <TrackRow 
                track={track} 
                index={index}
                showIndex={false}
                queue={results}
                playSource="search"
              />
            </div>
          ))}
          </div>
        ) : query ? (
          <div className={styles.emptyState}>ไม่พบผลลัพธ์สำหรับ "{query}"</div>
        ) : (
          <div className={styles.startPage}>
            {/* 📜 RECENT SEARCHES 📜 */}
            {searchHistory.length > 0 && (
              <div className={styles.historySection}>
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>ค้นหาล่าสุด</h2>
                  <button className={styles.clearAllBtn} onClick={clearSearchHistory}>ล้างทั้งหมด</button>
                </div>
                <div className={styles.historyChips}>
                  {searchHistory.map((q) => (
                    <div key={q} className={styles.searchChip}>
                      <span className={styles.chipText} onClick={() => setLocalQuery(q)}>
                        {q}
                      </span>
                      <button className={styles.removeChipBtn} onClick={() => removeSearchQuery(q)}>
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 🎧 LISTENING HISTORY 🎧 */}
            {listeningHistory.length > 0 && (
              <div className={styles.historySection}>
                <h2 className={styles.sectionTitle}>ฟังล่าสุด</h2>
                <div className={styles.historyList}>
                  {listeningHistory.slice(0, 5).map((track) => (
                    <div key={track.id} className={styles.historyRow}>
                        <div className={styles.historyInfo} onClick={() => playTrack(track, listeningHistory, 'history')}>
                            <History size={16} className={styles.historyIcon} />
                            <span className={styles.historyTitle}>{track.title}</span>
                        </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 🔥 TRENDING 🔥 */}
            <div className={styles.trendingSection}>
              <h2 className={styles.sectionTitle}>เพลงแนะนำตอนนี้</h2>
              <div className={styles.listArea}>
                {trendingLoading && !isTrendingLoaded ? (
                   Array(6).fill(0).map((_, i) => (
                     <div key={`skel-trend-search-row-${i}`} style={{ height: 60, width: '100%', background: 'rgba(255,255,255,0.03)', borderRadius: 8, marginBottom: 8, animation: 'pulse 1.5s infinite' }} />
                   ))
                ) : (
                  trending.slice(0, 20).map((track, i) => (
                    <TrackRow 
                      key={track.id} 
                      track={track} 
                      index={i}
                      showIndex={true}
                      queue={trending.slice(0, 20)}
                      playSource="discovery"
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// 🛡️ Wrapper to handle Suspense for useSearchParams
import { Suspense } from 'react';

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
        <Loader2 className="spin" size={48} color="#1db954" />
      </div>
    }>
      <SearchContent />
    </Suspense>
  );
}
