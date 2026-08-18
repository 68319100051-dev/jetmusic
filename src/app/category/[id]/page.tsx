'use client';
import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, Loader2, Play, Music } from 'lucide-react';
import { SkeletonCard } from '@/components/Skeleton';
import TrackRow from '@/components/TrackRow';
import { usePlayer } from '@/contexts/PlayerContext';
import { usePlaylist } from '@/contexts/PlaylistContext';
import { useDiscovery } from '@/contexts/DiscoveryContext';
import styles from './page.module.css';

const CATEGORY_MAP: Record<string, { title: string, query: string, color: string }> = {
  featured: {
    title: 'แนะนำสำหรับคุณ',
    query: 'เพลงไทยยอดนิยม แนะนำสำหรับคุณ',
    color: 'linear-gradient(135deg, #1db954 0%, #191414 100%)'
  },
  trending: {
    title: 'กำลังฮิตตอนนี้',
    query: 'เพลงไทยยอดนิยม',
    color: 'linear-gradient(135deg, #6366f1 0%, #191414 100%)'
  }
};

export default function CategoryPage() {
  const { id } = useParams();
  const router = useRouter();
  const { playTrack } = usePlayer();
  const { playlists } = usePlaylist();
  const { trending, recommended, setRecommended, refreshTrending, isTrendingLoaded, isRecommendedLoaded } = useDiscovery();
  
  const [localTracks, setLocalTracks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const category = CATEGORY_MAP[id as string];

  // 🛡️ STABILITY: Use global state directly for known categories 🛡️
  const tracks = useMemo(() => {
    if (id === 'trending') return trending.slice(0, 20);
    if (id === 'featured') return recommended;
    return localTracks;
  }, [id, trending, recommended, localTracks]);

  const isLoaded = useMemo(() => {
    if (id === 'trending') return isTrendingLoaded;
    if (id === 'featured') return isRecommendedLoaded;
    return !loading;
  }, [id, isTrendingLoaded, isRecommendedLoaded, loading]);

  useEffect(() => {
    if (!category) return;
    
    async function fetchCategoryTracks() {
      // If already loaded in global context, skip
      if (id === 'trending' && isTrendingLoaded && trending.length >= 20) return;
      if (id === 'featured' && isRecommendedLoaded) return;

      if (tracks.length === 0) {
        setLoading(true);
      }
      try {
        if (id === 'trending') {
          await refreshTrending();
        } else {
          let finalQuery = category!.query;
          const likedPlaylist = playlists.find(p => p.id === 'liked_songs_id');
          const likedTracks = likedPlaylist?.tracks || [];
          if (likedTracks.length > 0) {
            const artists = Array.from(new Set(likedTracks.map(t => t.artist))).slice(0, 3);
            finalQuery = `เพลง ${artists.join(' ')} แนะนำ`;
          }

          const res = await fetch(`/api/search?q=${encodeURIComponent(finalQuery)}`);
          const data = await res.json();
          if (data.results) {
            const resultTracks = data.results.slice(0, 24);
            if (id === 'featured') {
              setRecommended(resultTracks);
            } else {
              setLocalTracks(resultTracks);
            }
          }
        }
      } catch (err) {
        console.error("Category fetch error:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchCategoryTracks();
  }, [id, category, playlists.length, isTrendingLoaded, isRecommendedLoaded, refreshTrending, setRecommended]);

  if (!category) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <Music size={64} opacity={0.2} />
          <h2>ไม่พบหมวดหมู่</h2>
          <button onClick={() => router.push('/')} className={styles.backBtn}>กลับหน้าหลัก</button>
        </div>
      </div>
    );
  }

  const isLoading = !isLoaded && tracks.length === 0;

  return (
    <div className={styles.container}>
      <header className={styles.header} style={{ background: category.color }}>
        <button onClick={() => router.back()} className={styles.iconBtn}>
          <ChevronLeft size={28} />
        </button>
        <div className={styles.headerContent}>
          <h1 className={styles.title}>{category.title}</h1>
          <p className={styles.subtitle}>{isLoading ? '...' : (tracks.length + ' เพลงยอดนิยมสำหรับคุณ')}</p>
          <button 
            className={styles.playAllBtn}
            onClick={() => tracks.length > 0 && playTrack(tracks[0], tracks, id === 'trending' ? 'discovery' : 'playlist')}
            disabled={isLoading}
            style={{ opacity: isLoading ? 0.5 : 1 }}
          >
            <Play fill="black" size={24} /> เล่นทั้งหมด
          </button>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.trackList}>
          {isLoading ? (
            Array(12).fill(0).map((_, i) => (
              <div key={`skel-cat-row-${i}`} style={{ 
                height: 64, width: '100%', background: 'rgba(255,255,255,0.03)', 
                borderRadius: 8, marginBottom: 8, animation: 'pulse 1.5s infinite' 
              }} />
            ))
          ) : (
            tracks.map((track, i) => (
              <TrackRow 
                key={track.id} 
                track={track} 
                index={i}
                showIndex={true}
                queue={tracks}
                playSource={id === 'trending' ? 'discovery' : 'playlist'}
              />
            ))
          )}
        </div>
      </main>
    </div>
  );
}
