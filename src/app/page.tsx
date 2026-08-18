'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePlayer } from '@/contexts/PlayerContext';
import LandingPage from '@/components/LandingPage';
import RecentlyPlayed from '@/components/RecentlyPlayed';
import { useDiscovery } from '@/contexts/DiscoveryContext';
import { SkeletonCard } from '@/components/Skeleton';
import { ChevronRight, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { ReactNode } from 'react';

function Section({ title, children, href, action }: { title: string; children: ReactNode; href?: string; action?: ReactNode }) {
  return (
    <section className="section page-container">
      <div className="section-header">
        <h2 className="section-title">{title}</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {action}
          {href && (
            <Link href={href} className="see-all">
              ดูทั้งหมด <ChevronRight size={14} />
            </Link>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}

function SongCard({ song, queue }: { song: any, queue?: any[] }) {
  const { playTrack } = usePlayer();
  
  return (
    <div className="track-card" onClick={() => playTrack(song, queue, 'discovery')}>
      <div className="track-cover-container">
        <img 
          src={song.coverUrl} 
          alt={song.title}
          className="track-cover"
        />
        <div className="play-overlay">
          <div className="play-btn-circle">
            <div className="w-0 h-0 border-t-[8px] border-t-transparent border-l-[12px] border-l-white border-b-[8px] border-b-transparent ml-1" />
          </div>
        </div>
      </div>
      <h3 className="track-name">{song.title}</h3>
      <p className="track-artist">{song.artist}</p>
    </div>
  );
}

export default function Home() {
  const { user, isGuest, isLoaded, setShowAuthModal } = useAuth();
  const { trending, recommended, isTrendingLoaded, isRecommendedLoaded, refreshTrending } = useDiscovery();

  const [isRefreshing, setIsRefreshing] = useState(false);

  // Auto-load if cache is empty
  useEffect(() => {
    if (isLoaded && (user || isGuest) && trending.length === 0) {
      refreshTrending();
    }
  }, [isLoaded, user, isGuest, trending.length, refreshTrending]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Clear old cache timestamp to force fresh fetch
    if (typeof window !== 'undefined') {
      localStorage.removeItem('jet_music_trending_ts');
      localStorage.removeItem('jet_music_trending_cache');
    }
    await refreshTrending();
    setIsRefreshing(false);
  };

  if (!isLoaded) return null;

  // IF NO USER AND NOT GUEST -> SHOW LANDING PAGE (AUTHENTICATION)
  if (!user && !isGuest) {
    return <LandingPage />;
  }

  return (
    <div className="main-content">
      <header className="page-container mb-8">
        <div className="header-badge inline-block px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-sm font-bold mb-3">
          {user ? 'PREMIUM MEMBER' : 'GUEST DISCOVERY'} • v2.9.5 TRUE SYNC
        </div>
        <h1 className="text-3xl font-black text-white tracking-tight leading-tight">
          {user ? `ยินดีต้อนรับ, ${user.username}` : "Jet Music Discovery"}
        </h1>
        <p className="text-gray-400 mt-2">
          {user ? "สตรีมมิ่งระดับพรีเมียมส่วนตัวของคุณ" : "สำรวจเพลงฮิตล่าสุดในโหมด Guest"}
        </p>
      </header>

      <main>
        {user && <RecentlyPlayed />}

        <Section 
          title="กำลังมาแรงตอนนี้" 
          href="/category/trending"
          action={
            <button 
              onClick={handleRefresh} 
              disabled={isRefreshing}
              style={{ background: 'none', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 20, color: 'rgba(255,255,255,0.6)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', padding: '3px 10px', whiteSpace: 'nowrap' }}
            >
              <RefreshCw size={12} style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }} />
              {isRefreshing ? 'โหลด...' : 'รีเฟรช'}
            </button>
          }
        >
          <div className="horizontal-scroll">
            {!isTrendingLoaded ? (
               [...Array(6)].map((_, i) => <SkeletonCard key={i} />)
            ) : (
              trending.map((song: any) => (
                <SongCard key={song.id} song={song} queue={trending} />
              ))
            )}
          </div>
        </Section>

        <Section title="แนะนำสำหรับคุณ" href="/category/featured">
          <div className="horizontal-scroll">
            {!isRecommendedLoaded ? (
               [...Array(6)].map((_, i) => <SkeletonCard key={i} />)
            ) : (
              recommended.map((song: any) => (
                <SongCard key={song.id} song={song} queue={recommended} />
              ))
            )}
          </div>
        </Section>
        
        {!user && isGuest && (
          <div className="page-container">
            <div className="premium-banner" onClick={() => setShowAuthModal(true)}>
              <div className="premium-banner-content">
                <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <span className="font-black">P</span>
                </div>
                <div>
                  <h3 className="text-white font-bold text-sm">อัปเกรดเป็นพรีเมียม</h3>
                  <p className="text-xs text-gray-400">เข้าถึงคลังเพลง ประวัติการฟัง และฟีเจอร์เทพๆ ทั้งหมด!</p>
                </div>
              </div>
              <ChevronRight className="text-gray-500" size={20} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
