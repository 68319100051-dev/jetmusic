'use client';
import { ReactNode, useEffect, useState } from 'react';
import { usePlayer } from '@/contexts/PlayerContext';
import { useAuth } from '@/contexts/AuthContext';
import Player from './Player';
import Navigation from './BottomNav';
import AuthModal from './AuthModal';
import AppPromotionPopup from './AppPromotionPopup';
import ForceUpdateModal from './ForceUpdateModal';
import { Browser } from '@capacitor/browser';
import { App } from '@capacitor/app';

export default function RootLayoutClient({ children }: { children: ReactNode }) {
  const { currentTrack } = usePlayer();
  const { user, isGuest, showAuthModal } = useAuth();
  
  // Update state
  const [updateInfo, setUpdateInfo] = useState<{version: string, notes: string} | null>(null);

  // Navigation is only shown for fully logged-in premium members
  const showNav = user && !isGuest;

  // 🛡️ APP PROTECTION: Disable DevTools & Right-Click
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Block F12
      if (e.key === 'F12') {
        e.preventDefault();
      }
      
      // 2. Block Ctrl+Shift+I (DevTools)
      if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) {
        e.preventDefault();
      }

      // 3. Block Ctrl+U (View Source)
      if (e.ctrlKey && (e.key === 'U' || e.key === 'u')) {
        e.preventDefault();
      }
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);

    // Security Debugger Loop (Optional: disrupts those who manage to open it anyway)
    // const interval = setInterval(() => {
    //   debugger;
    // }, 100);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
      // clearInterval(interval);
    };
  }, []);

  // 🚀 FORCE UPDATE CHECK
  useEffect(() => {
    const checkVersion = async () => {
      try {
        let currentVersion = 'WEB';
        
        try {
          const info = await App.getInfo();
          // Normalize version (e.g., "v3.0.6" -> "3.0.6")
          currentVersion = info.version.replace(/^v/, '').trim();
        } catch (e) {
          return; 
        }

        const response = await fetch(`/api/version?t=${Date.now()}`);
        const data = await response.json();
        const latestVersion = data.latestVersion.replace(/^v/, '').trim();
        
        // Final logic: Only show if Native !== Server AND we haven't successfully updated to this version
        if (latestVersion !== currentVersion && currentVersion !== 'WEB') {
           // Check if user already dismissed this specific version in this session
           const sessionDismissed = sessionStorage.getItem('update_dismissed');
           if (sessionDismissed === latestVersion) return;

          setUpdateInfo({
            version: latestVersion,
            notes: data.releaseNotes
          });
        }
      } catch (e) {
        console.error("Update check failed", e);
      }
    };
    
    const timer = setTimeout(checkVersion, 3500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="main-layout">
      <main className="content">
        {children}
      </main>
      
      {showNav && <Navigation />}
      {(user || isGuest) && currentTrack && <Player />}


      {/* 🔐 GLOBAL AUTH MODAL OVERLAY 🔐 */}
      {showAuthModal && <AuthModal />}

      {/* 📣 WEB-TO-APP PROMOTION 📣 */}
      <AppPromotionPopup />

      {/* 🚀 FORCE UPDATE SYSTEM 🚀 */}
      {updateInfo && (
        <ForceUpdateModal 
          latestVersion={updateInfo.version}
          releaseNotes={updateInfo.notes}
          onUpdate={() => {
            const url = 'https://jet-music.vercel.app/jet-music.apk';
            window.open(url, '_system');
            // Record that we tried to update to this version to suppress prompt until reload
            sessionStorage.setItem('update_dismissed', updateInfo.version);
            setUpdateInfo(null);
          }}
        />
      )}
    </div>
  );
}
