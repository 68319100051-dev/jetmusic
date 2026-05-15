'use client';
import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { TrackData } from '../lib/mediaSession';

export interface Playlist {
  id: string;
  name: string;
  tracks: TrackData[];
  createdAt: number;
}

interface PlaylistContextType {
  playlists: Playlist[];
  createPlaylist: (name: string) => void;
  deletePlaylist: (id: string) => void;
  addTrack: (playlistId: string, track: TrackData) => void;
  removeTrack: (playlistId: string, trackId: string) => void;
  toggleLike: (track: TrackData) => void;
  isLiked: (trackId: string) => boolean;
  resetAllPlaylists: () => void;
  isLoaded: boolean;
}

const LIKED_SONGS_ID = 'liked_songs_id';

const PlaylistContext = createContext<PlaylistContextType | undefined>(undefined);

export function PlaylistProvider({ children }: { children: React.ReactNode }) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const { user, updateProfile, isLoaded: authLoaded } = useAuth();
  
  // Track whether we've done initial sync for this user session
  const syncedForUser = useRef<string | null>(null);
  const lastStateHash = useRef<string>('');

  const normalizeId = (id: string) => {
    if (!id) return '';
    // Strip common prefixes
    let clean = id.replace(/^(yt-|sc-|local-)/, '');
    
    // Extract YT ID from URLs if present
    if (clean.includes('youtube.com') || clean.includes('youtu.be')) {
      const match = clean.match(/(?:v=|\/|embed\/|shorts\/)([0-9A-Za-z_-]{11})/);
      return match ? match[1] : clean;
    }
    return clean;
  };

  // 1. Initial Load: Cloud is primary source of truth for logged-in users
  useEffect(() => {
    // VITAL FIX: Use email as the consistent ID for sync across ALL devices
    const userId = user?.email?.toLowerCase() ?? null;

    // ---- LOGGED IN ----
    if (userId && authLoaded) {
      const cloudPlaylists: Playlist[] = Array.isArray(user?.playlists) ? [...user!.playlists] : [];
      const cloudHash = JSON.stringify(cloudPlaylists);
      
      // Critical Check: If this data matches what we just PUSHED, don't trigger a re-sync
      if (syncedForUser.current === `${userId}_${cloudHash}`) {
        return;
      }

      // Local guest adoption (Runs only if we still have guest data)
      let guestData: Playlist[] = [];
      const savedGuest = localStorage.getItem('jet_playlists_guest');
      if (savedGuest) {
        try { 
          const parsed = JSON.parse(savedGuest);
          guestData = Array.isArray(parsed) ? parsed : (parsed.playlists || []);
        } catch (e) {}
      }

      // Merge Logic (Runs once when guestData exists or if cloud differs from local memory)
      const mergedMap = new Map<string, Playlist>();
      
      // Start with cloud as priority
      for (const pl of cloudPlaylists) mergedMap.set(pl.id, pl);
      
      // If guest data exists, merge it uniquely
      if (guestData.length > 0) {
        for (const pl of guestData) {
          if (!mergedMap.has(pl.id)) {
            mergedMap.set(pl.id, pl);
          } else if (pl.id === LIKED_SONGS_ID) {
             // Union liked songs
             const cloudLiked = mergedMap.get(LIKED_SONGS_ID)!;
             const trackMap = new Map<string, TrackData>();
             for (const t of [...cloudLiked.tracks, ...pl.tracks]) {
                const nid = normalizeId(t.id);
                if (!trackMap.has(nid)) trackMap.set(nid, t);
             }
             mergedMap.set(LIKED_SONGS_ID, { ...cloudLiked, tracks: Array.from(trackMap.values()) });
          }
        }
      }

      if (!mergedMap.has(LIKED_SONGS_ID)) {
        mergedMap.set(LIKED_SONGS_ID, { id: LIKED_SONGS_ID, name: 'เพลงที่ชอบ', tracks: [], createdAt: Date.now() });
      }

      let merged = Array.from(mergedMap.values());
      const likedIdx = merged.findIndex(p => p.id === LIKED_SONGS_ID);
      if (likedIdx >= 0) {
        merged = [merged[likedIdx], ...merged.filter((_, i) => i !== likedIdx)];
      }

      // Update state
      setPlaylists(merged);
      setIsLoaded(true);
      
      // Mark as synced so we don't loop
      const newCloudHash = JSON.stringify(cloudPlaylists);
      syncedForUser.current = `${userId}_${newCloudHash}`;
      lastStateHash.current = JSON.stringify(merged);

      // Final cleanup of guest migration
      if (guestData.length > 0) {
        localStorage.removeItem('jet_playlists_guest');
        updateProfile({ playlists: merged });
      }
      return;
    }

    // ---- GUEST ----
    if (!userId && authLoaded) {
      const storageKey = 'jet_playlists_guest';
      let localData: Playlist[] = [];
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try { 
          const parsed = JSON.parse(saved);
          localData = Array.isArray(parsed) ? parsed : (parsed.playlists || []);
        } catch (e) {}
      }
      if (!Array.isArray(localData)) localData = [];
      if (!localData.some(p => p.id === LIKED_SONGS_ID)) {
        localData.unshift({ id: LIKED_SONGS_ID, name: 'เพลงที่ชอบ', tracks: [], createdAt: Date.now() });
      }
      setPlaylists(localData);
      setIsLoaded(true);
      syncedForUser.current = null;
    }
  }, [user?.email, user?.playlists, authLoaded]);

  // Handle local persistence only
  useEffect(() => {
    if (isLoaded) {
      const userId = user?.email?.toLowerCase() ?? null;
      const storageKey = userId ? `jet_playlists_${userId}` : 'jet_playlists_guest';
      const dataToSave = { 
        playlists, 
        lastUpdated: Date.now() 
      };
      localStorage.setItem(storageKey, JSON.stringify(dataToSave));
    }
  }, [playlists, user?.email, isLoaded]);

  // HELPER: Sync to cloud explicitly
  const syncToCloud = (updatedPlaylists: Playlist[]) => {
    const userId = user?.email?.toLowerCase() ?? null;
    if (userId) {
       const syncPayload = { 
          playlists: updatedPlaylists,
          lastUpdated: Date.now() 
       };
       // Mark this specific hash as "locally pushed" to avoid the loop in the useEffect above
       syncedForUser.current = `${userId}_${JSON.stringify(updatedPlaylists)}`;
       lastStateHash.current = JSON.stringify(updatedPlaylists);
       updateProfile(syncPayload);
    }
  };

  const createPlaylist = (name: string) => {
    const newPlaylist: Playlist = {
      id: `pl_${Date.now()}`,
      name,
      tracks: [],
      createdAt: Date.now()
    };
    const next = [...playlists, newPlaylist];
    setPlaylists(next);
    syncToCloud(next);
  };

  const deletePlaylist = (id: string) => {
    if (id === LIKED_SONGS_ID) return;
    const next = playlists.filter(p => p.id !== id);
    setPlaylists(next);
    syncToCloud(next);
  };

  const addTrack = (playlistId: string, track: TrackData) => {
    const tid = normalizeId(track.id);
    const next = playlists.map((p: Playlist) => {
      if (p.id === playlistId) {
        if (p.tracks.some((t: TrackData) => normalizeId(t.id) === tid)) return p;
        return { ...p, tracks: [track, ...p.tracks] };
      }
      return p;
    });
    setPlaylists(next);
    syncToCloud(next);
  };

  const removeTrack = (playlistId: string, trackId: string) => {
    const tid = normalizeId(trackId);
    const next = playlists.map((p: Playlist) => {
      if (p.id === playlistId) {
        return { ...p, tracks: p.tracks.filter((t: TrackData) => normalizeId(t.id) !== tid) };
      }
      return p;
    });
    setPlaylists(next);
    syncToCloud(next);
  };

  const toggleLike = (track: TrackData) => {
    if (!track?.id) return;
    const tid = normalizeId(track.id);
    
    setPlaylists(prev => {
      const lp = prev.find((p: Playlist) => p.id === LIKED_SONGS_ID);
      if (!lp) return prev;
      
      const alreadyLiked = lp.tracks.some((t: TrackData) => normalizeId(t.id) === tid);
      const next = prev.map((p: Playlist) => {
        if (p.id === LIKED_SONGS_ID) {
          if (alreadyLiked) {
            return { ...p, tracks: p.tracks.filter((t: TrackData) => normalizeId(t.id) !== tid) };
          } else {
            return { ...p, tracks: [track, ...p.tracks] };
          }
        }
        return p;
      });
      
      // Delay sync slightly to ensure state is committed
      setTimeout(() => syncToCloud(next), 0);
      return next;
    });
  };

  const isLiked = useCallback((trackId: string) => {
    if (!trackId) return false;
    const tid = normalizeId(trackId);
    const lp = playlists.find((p: Playlist) => p.id === LIKED_SONGS_ID);
    return lp?.tracks.some((t: TrackData) => normalizeId(t.id) === tid) || false;
  }, [playlists]);

  const resetAllPlaylists = () => {
    const fresh = [{ id: LIKED_SONGS_ID, name: 'เพลงที่ชอบ', tracks: [], createdAt: Date.now() }];
    setPlaylists(fresh);
    syncToCloud(fresh);
  };

  return (
    <PlaylistContext.Provider value={{ playlists, createPlaylist, deletePlaylist, addTrack, removeTrack, toggleLike, isLiked, resetAllPlaylists, isLoaded }}>
      {children}
    </PlaylistContext.Provider>
  );
}

export function usePlaylist() {
  const context = useContext(PlaylistContext);
  if (context === undefined) {
    throw new Error('usePlaylist must be used within a PlaylistProvider');
  }
  return context;
}

