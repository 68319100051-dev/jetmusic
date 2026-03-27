'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface UserStats {
  songsPlayed: number;
}

export interface User {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  history?: any[];
  lastPlayed?: any;
  searchHistory?: string[];
  playlists?: any[];
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
  addToHistory: (track: any) => void;
  syncUserData: (data: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const savedUser = localStorage.getItem('jet_v2_user');
    const savedGuest = localStorage.getItem('jet_v2_guest_session');
    
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        console.error("Auth hydration error:", e);
      }
    } else if (savedGuest === 'true') {
      setIsGuest(true);
    }
    setIsLoaded(true);
  }, []);

  const signup = async (email: string, password: string, username: string) => {
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

  const login = async (email: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
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

      await fetch('/api/user/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, data: updatedUser })
      });
    } catch (e) {
      console.error("Sync failed:", e);
    }
  };

  const updateProfile = (updates: Partial<User>) => {
    if (!user) return;
    syncUserData(updates);
  };

  const addToHistory = (track: any) => {
    if (!user) return;
    const currentHistory = user.history || [];
    const newHistory = [track, ...currentHistory.filter((t: any) => t.id !== track.id)].slice(0, 50);
    syncUserData({ history: newHistory });
  };

  return (
    <AuthContext.Provider value={{ 
      user, isGuest, isLoaded, showAuthModal, 
      signup, login, continueAsGuest, setShowAuthModal, logout,
      updateProfile,
      addToHistory,
      syncUserData
      }}
    >  {children}
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
