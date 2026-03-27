'use client';
import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { TrackData } from '../lib/mediaSession';

interface DiscoveryContextType {
  trending: TrackData[];
  recommended: TrackData[];
  setTrending: (tracks: TrackData[]) => void;
  setRecommended: (tracks: TrackData[]) => void;
  refreshTrending: () => Promise<TrackData[]>;
  isTrendingLoaded: boolean;
  isRecommendedLoaded: boolean;
  clearCache: () => void;
}

const DiscoveryContext = createContext<DiscoveryContextType | undefined>(undefined);

const STORAGE_KEY_TRENDING = 'jet_music_trending_cache';
const STORAGE_KEY_RECOMMENDED = 'jet_music_recommended_cache';

export function DiscoveryProvider({ children }: { children: React.ReactNode }) {
  const [trending, setTrendingState] = useState<TrackData[]>([]);
  const [recommended, setRecommendedState] = useState<TrackData[]>([]);
  const [isTrendingLoaded, setIsTrendingLoaded] = useState(false);
  const [isRecommendedLoaded, setIsRecommendedLoaded] = useState(false);
  const isHydrated = useRef(false);

  // 💾 PERSISTENCE: Hydrate from localStorage on mount 💾
  useEffect(() => {
    if (isHydrated.current) return;
    
    const cachedTrending = localStorage.getItem(STORAGE_KEY_TRENDING);
    const cachedRecommended = localStorage.getItem(STORAGE_KEY_RECOMMENDED);
    
    if (cachedTrending) {
      try {
        const parsed = JSON.parse(cachedTrending);
        if (Array.isArray(parsed) && parsed.length >= 20) {
          setTrendingState(parsed);
          setIsTrendingLoaded(true);
        }
      } catch (e) {
        console.error("Discovery hydration error (trending):", e);
      }
    }
    
    if (cachedRecommended) {
      try {
        const parsed = JSON.parse(cachedRecommended);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setRecommendedState(parsed);
          setIsRecommendedLoaded(true);
        }
      } catch (e) {
        console.error("Discovery hydration error (recommended):", e);
      }
    }
    isHydrated.current = true;
  }, []);

  const setTrending = useCallback((tracks: TrackData[]) => {
    setTrendingState(tracks);
    setIsTrendingLoaded(true);
    localStorage.setItem(STORAGE_KEY_TRENDING, JSON.stringify(tracks));
  }, []);

  const setRecommended = useCallback((tracks: TrackData[]) => {
    setRecommendedState(tracks);
    setIsRecommendedLoaded(true);
    localStorage.setItem(STORAGE_KEY_RECOMMENDED, JSON.stringify(tracks));
  }, []);


  const refreshTrending = useCallback(async () => {
    // 🛡️ SILENT REFRESH: Don't reset isTrendingLoaded if we already have data
    if (trending.length === 0) {
      setIsTrendingLoaded(false);
    }

    try {
      const queries = [
        'เพลงไทย ยอดนิยมล่าสุด', 
        'เพลงไทย มาแรง',
        'Thailand Top 100 Hits',
        'เพลงสตริงยอดฮิต 2025',
        'Thai Trending Songs'
      ];
      
      const allTracks: TrackData[] = [];
      const seenIds = new Set();
      
      for (const q of queries) {
        if (allTracks.length >= 20) break;
        
        try {
          const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
          const data = await res.json();
          if (data.results) {
            data.results.forEach((t: TrackData) => {
              if (!seenIds.has(t.id)) {
                seenIds.add(t.id);
                allTracks.push(t);
              }
            });
          }
        } catch (e) {
          console.error(`Fetch failed for query: ${q}`, e);
        }
      }

      const finalTrending = allTracks.slice(0, 20);
      
      if (finalTrending.length >= 10) {
         setTrendingState(finalTrending);
         setIsTrendingLoaded(true);
         localStorage.setItem(STORAGE_KEY_TRENDING, JSON.stringify(finalTrending));
      }
      
      console.log(`Discovery: Populated ${finalTrending.length} trending tracks.`);
      return finalTrending;
    } catch (err) {
      console.error("Discovery refresh error:", err);
      return [];
    } finally {
       setIsTrendingLoaded(true);
    }
  }, [trending.length]);


  const clearCache = useCallback(() => {
    setTrendingState([]);
    setRecommendedState([]);
    setIsTrendingLoaded(false);
    setIsRecommendedLoaded(false);
    localStorage.removeItem(STORAGE_KEY_TRENDING);
    localStorage.removeItem(STORAGE_KEY_RECOMMENDED);
  }, []);

  return (
    <DiscoveryContext.Provider value={{ 
      trending, 
      recommended, 
      setTrending, 
      setRecommended, 
      refreshTrending,
      isTrendingLoaded, 
      isRecommendedLoaded,
      clearCache
    }}>
      {children}
    </DiscoveryContext.Provider>
  );
}

export function useDiscovery() {
  const context = useContext(DiscoveryContext);
  if (context === undefined) {
    throw new Error('useDiscovery must be used within a DiscoveryProvider');
  }
  return context;
}
