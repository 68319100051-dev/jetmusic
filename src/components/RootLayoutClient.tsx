'use client';
import { ReactNode } from 'react';
import { usePlayer } from '@/contexts/PlayerContext';
import { useAuth } from '@/contexts/AuthContext';
import Player from './Player';
import Navigation from './BottomNav';
import AuthModal from './AuthModal';

export default function RootLayoutClient({ children }: { children: ReactNode }) {
  const { currentTrack } = usePlayer();
  const { user, isGuest, showAuthModal } = useAuth();

  // Navigation is only shown for fully logged-in premium members
  const showNav = user && !isGuest;

  return (
    <div className="main-layout">
      <main className="content">
        {children}
      </main>
      
      {showNav && <Navigation />}
      {(user || isGuest) && currentTrack && <Player />}

      {/* 🔐 GLOBAL AUTH MODAL OVERLAY 🔐 */}
      {showAuthModal && <AuthModal />}
    </div>
  );
}
