'use client';
import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';
import { usePlaylist, Playlist } from '@/contexts/PlaylistContext';
import { useToast } from '@/contexts/ToastContext';
import { useModal } from '@/contexts/ModalContext';
import styles from './page.module.css';
import { Music, Heart, ListVideo, PlusCircle } from 'lucide-react';
import Link from 'next/link';

export default function LibraryPage() {
  const { user, isLoaded: authLoaded, setShowAuthModal } = useAuth();
  const { playlists, isLoaded: plLoaded, createPlaylist } = usePlaylist();
  const { showToast } = useToast();
  const { prompt } = useModal();

  if (!authLoaded || !plLoaded) return null;

  const handleCreatePlaylist = async () => {
    const name = await prompt({
      title: 'สร้างเพลย์ลิสต์ใหม่',
      message: 'ตั้งชื่อเท่ๆ ให้เพลย์ลิสต์ของคุณสิ',
      placeholder: 'เช่น เพลงฟังตอนทำงาน...',
      confirmLabel: 'สร้างเลย',
      cancelLabel: 'ยกเลิก'
    });
    if (name && name.trim()) {
      createPlaylist(name.trim());
      showToast(`สร้างเพลย์ลิสต์ "${name}" แล้ว`, 'success');
    }
  };

  if (!user) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <Music size={64} color="var(--text-secondary)" opacity={0.2} style={{ marginBottom: 20 }} />
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'white' }}>เข้าสู่ระบบเพื่อดูคลังเพลง</h2>
          <p style={{ marginTop: 8 }}>เพลย์ลิสต์และเพลงที่คุณชอบจะปรากฏที่นี่</p>
          <button
            onClick={() => setShowAuthModal(true)}
            className={styles.browseBtn}
            style={{ marginTop: 24, border: 'none' }}
          >
            เข้าสู่ระบบสมาชิก
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className="logo-gradient" style={{ fontSize: '1.8rem', margin: 0 }}>คลังเพลงของคุณ</h1>
      </header>

      <div style={{ paddingBottom: 120 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 className={styles.sectionTitle} style={{ margin: 0, fontSize: '1.4rem' }}>เพลย์ลิสต์</h2>
          <button
            onClick={handleCreatePlaylist}
            style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, cursor: 'pointer' }}
          >
            <PlusCircle size={20} /> สร้างใหม่
          </button>
        </div>

        {playlists.length > 0 ? (
          <div className={styles.playlistList}>
            {playlists.map((pl: Playlist) => {
              const isLikedSongs = pl.id === 'liked_songs_id';
              return (
                <Link href={`/playlist/${pl.id}`} key={pl.id} className={styles.playlistItem}>
                  {/* Cover thumbnail */}
                  <div className={`${styles.coverThumb} ${isLikedSongs ? styles.likedCoverThumb : ''}`}>
                    {isLikedSongs ? (
                      <Heart size={30} color="white" fill="white" />
                    ) : pl.tracks[0]?.coverUrl ? (
                      <img src={pl.tracks[0].coverUrl} alt={pl.name} className={styles.coverImg} />
                    ) : (
                      <ListVideo size={26} color="rgba(255,255,255,0.25)" />
                    )}
                  </div>

                  {/* Text info */}
                  <div className={styles.itemInfo}>
                    <div className={`${styles.itemTitle} ${isLikedSongs ? styles.likedTitle : ''}`}>
                      {pl.name}
                    </div>
                    <div className={styles.itemMeta}>
                      {isLikedSongs
                        ? <>📌 เพลย์ลิสต์ • {pl.tracks.length} เพลง</>
                        : <>เพลย์ลิสต์ • {user.username}</>
                      }
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <Music size={48} opacity={0.2} />
            <p style={{ marginTop: 12 }}>ยังไม่มีเพลย์ลิสต์เลย</p>
            <Link href="/search" className={styles.browseBtn}>ไปหาเพลงกัน!</Link>
          </div>
        )}
      </div>
    </div>
  );
}
