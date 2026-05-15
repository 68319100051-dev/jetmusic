'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface UserStats {
  songsPlayed: number;
}

export interface UserPlayCounts {
  tracks: Record<string, { count: number, name: string, artist: string, cover: string }>;
  artists: Record<string, number>;
}

export interface User {
  id: string;
  username: string;
  email: string;
  avatarUrl?: string;
  history?: any[];
  lastPlayed?: any;
  searchHistory?: string[];
  playlists?: any[];
  tier?: string;
  stats?: UserStats;
  playCounts?: UserPlayCounts;
  memberSince?: string;
}

interface AuthContextType {
  user: User | null;
  isGuest: boolean;
  showAuthModal: boolean;
  isLoaded: boolean;
  signup: (email: string, password: string, username: string) => Promise<{ success: boolean; error?: string }>;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  continueAsGuest: () => void;
  setShowAuthModal: (show: boolean) => void;
  logout: () => void;
  updateProfile: (data: Partial<User>) => void;
  updateStats: (stats: Partial<UserStats>) => void;
  addToHistory: (track: any) => void;
  recordPlayStats: (track: any) => void;
  syncUserData: (data: Partial<User>) => Promise<void>;
  refreshCloudData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
 
  // On app start: hydrate from localStorage, then fetch fresh from cloud
  useEffect(() => {
    const savedUser = localStorage.getItem('jet_v2_user');
    const savedGuest = localStorage.getItem('jet_v2_guest_session');
    
    if (savedUser) {
      try {
        const localUser = JSON.parse(savedUser);
        setUser(localUser);
        setIsLoaded(true);
        fetchCloudData(localUser.email.toLowerCase());
      } catch (e) {
        console.error("Auth hydration error:", e);
        setIsLoaded(true);
      }
    } else if (savedGuest === 'true') {
      setIsGuest(true);
      setIsLoaded(true);
    } else {
      setIsLoaded(true);
    }
  }, []);

  const fetchCloudData = async (emailRaw: string) => {
    const email = emailRaw.toLowerCase();
    console.log(`[Auth] Fetching fresh data for ${email}... (Case-Insensitive)`);
    try {
      const res = await fetch(`/api/user/sync?email=${encodeURIComponent(email)}&t=${Date.now()}`, { 
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
      });
      const syncData = await res.json();
      if (syncData.data) {
        if (!syncData.data.playlists) {
          syncData.data.playlists = [{ id: 'liked_songs_id', name: 'เพลงที่ชอบ', tracks: [], createdAt: Date.now() }];
        }

        setUser(prev => {
          if (!prev) return { ...syncData.data, password: undefined };
          
          const oldDataHash = JSON.stringify({ 
            pl: prev.playlists || [], 
            hi: prev.history || [], 
            st: prev.stats || {}
          });
          const newDataHash = JSON.stringify({ 
            pl: syncData.data.playlists || [], 
            hi: syncData.data.history || [], 
            st: syncData.data.stats || {}
          });
          
          if (oldDataHash === newDataHash && prev.email === syncData.data.email) {
             return prev;
          }
          
          return { ...prev, ...syncData.data, password: undefined };
        });
        localStorage.setItem('jet_v2_user', JSON.stringify({ ...syncData.data, password: undefined }));
      }
    } catch (e) {
      console.error("[Auth] Sync fetch error:", e);
    }
  };

  const refreshCloudData = async () => {
    if (user?.email) await fetchCloudData(user.email);
  };
  // Auto-sync when user returns to tab
  useEffect(() => {
    const handleFocus = () => {
      if (user?.email && document.visibilityState === 'visible') {
        fetchCloudData(user.email);
      }
    };
    document.addEventListener('visibilitychange', handleFocus);
    return () => document.removeEventListener('visibilitychange', handleFocus);
  }, [user?.email]);

  const signup = async (emailRaw: string, password: string, username: string) => {
    const email = emailRaw.toLowerCase();
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, username })
      });
      const data = await res.json();
      if (data.success) {
        setUser(data.user);
        setIsGuest(false);
        localStorage.setItem('jet_v2_user', JSON.stringify(data.user));
        localStorage.removeItem('jet_v2_guest_session');
        setShowAuthModal(false);
        return { success: true };
      }
      return { success: false, error: data.error };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  };

  const login = async (emailRaw: string, password: string) => {
    const email = emailRaw.toLowerCase();
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (data.success) {
        // Fetch fresh cloud data after login
        let freshUser = data.user;
        try {
          const syncRes = await fetch(`/api/user/sync?email=${encodeURIComponent(email)}&t=${Date.now()}`, { cache: 'no-store' });
          const syncData = await syncRes.json();
          if (syncData.data) {
            freshUser = { ...data.user, ...syncData.data, password: undefined };
          }
        } catch (e) { /* use login data if sync fails */ }
        
        setUser(freshUser);
        setIsGuest(false);
        localStorage.setItem('jet_v2_user', JSON.stringify(freshUser));
        localStorage.removeItem('jet_v2_guest_session');
        setShowAuthModal(false);
        return { success: true };
      }
      return { success: false, error: data.error };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  };

  const continueAsGuest = () => {
    setIsGuest(true);
    setShowAuthModal(false);
    localStorage.setItem('jet_v2_guest_session', 'true');
    localStorage.removeItem('jet_v2_user');
    setUser(null);
  };

  const logout = () => {
    setUser(null);
    setIsGuest(false);
    localStorage.removeItem('jet_v2_user');
    localStorage.removeItem('jet_v2_guest_session');
  };

  const syncUserData = async (data: Partial<User>) => {
    if (!user?.email) return;
    try {
      const updatedUser = { ...user, ...data };
      setUser(updatedUser);
      localStorage.setItem('jet_v2_user', JSON.stringify(updatedUser));

      const res = await fetch('/api/user/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, data })
      });
      
      if (!res.ok) {
        console.warn("Sync partially failed (Server error)");
      }
    } catch (e) {
      console.error("Sync fetch Error:", e);
    }
  };

  const updateProfile = (updates: Partial<User>) => {
    if (!user) return;
    syncUserData(updates);
  };

  const updateStats = (statUpdates: Partial<UserStats>) => {
    if (!user) return;
    const currentStats = user.stats || { songsPlayed: 0 };
    const nextStats = { ...currentStats };
    
    if (statUpdates.songsPlayed) {
      nextStats.songsPlayed += statUpdates.songsPlayed;
    }
    
    syncUserData({ stats: nextStats });
  };

  const addToHistory = (track: any) => {
    if (!user) return;
    const currentHistory = user.history || [];
    const newHistory = [track, ...currentHistory.filter((t: any) => t.id !== track.id)].slice(0, 50);
    syncUserData({ history: newHistory });
  };

  const recordPlayStats = (track: any) => {
    if (!user) return;
    
    // 1. Update global song count
    const currentStats = user.stats || { songsPlayed: 0 };
    const nextStats = { ...currentStats, songsPlayed: currentStats.songsPlayed + 1 };

    // 2. Update Play Counts (Tracks & Artists)
    const playCounts = user.playCounts || { tracks: {}, artists: {} };
    
    // Track count
    const trackId = track.id;
    const existingTrack = playCounts.tracks[trackId] || { count: 0, name: track.title, artist: track.artist, cover: track.coverUrl };
    const newTracks = {
      ...playCounts.tracks,
      [trackId]: { ...existingTrack, count: existingTrack.count + 1 }
    };
    
    // Artist count
    const artistName = track.artist || 'Unknown Artist';
    const existingArtistCount = playCounts.artists[artistName] || 0;
    const newArtists = {
      ...playCounts.artists,
      [artistName]: existingArtistCount + 1
    };

    const newPlayCounts = { tracks: newTracks, artists: newArtists };

    syncUserData({ stats: nextStats, playCounts: newPlayCounts });
  };

  return (
    <AuthContext.Provider value={{ 
      user, isGuest, isLoaded, showAuthModal, 
      signup, login, continueAsGuest, setShowAuthModal, logout,
      updateProfile,
      updateStats,
      addToHistory,
      recordPlayStats,
      syncUserData,
      refreshCloudData
      }}
    >

      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
