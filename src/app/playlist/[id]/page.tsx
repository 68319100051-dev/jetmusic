'use client';
import { useParams, useRouter } from 'next/navigation';
import { usePlaylist } from '@/contexts/PlaylistContext';
import { usePlayer } from '@/contexts/PlayerContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useModal } from '@/contexts/ModalContext';
import styles from './page.module.css';
import { Play, Heart, Trash2, ArrowLeft, MoreHorizontal, Clock, Music, MapPin, ListVideo, Pause } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function PlaylistPage() {
  const { id } = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const { confirm } = useModal();
  const { user, isLoaded: authLoaded } = useAuth();
  const { playlists, removeTrack, toggleLike, isLiked, isLoaded: plLoaded, deletePlaylist } = usePlaylist();
  const { playTrack, currentTrack, isPlaying, pauseTrack, resumeTrack } = usePlayer();

  const playlist = playlists.find(p => p.id === id);

  if (!authLoaded || !plLoaded) return null;

  if (!playlist) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <Music size={64} opacity={0.2} />
          <h2>ไม่พบเพลย์ลิสต์</h2>
          <button onClick={() => router.back()} className={styles.actionBtn} style={{ marginTop: 20 }}>
            กลับไปหน้าก่อนหน้า
          </button>
        </div>
      </div>
    );
  }

  const handleRemoveTrack = async (e: React.MouseEvent, trackId: string) => {
    e.stopPropagation();
    const ok = await confirm({
      title: 'ลบเพลง',
      message: 'คุณต้องการลบเพลงนี้ออกจากเพลย์ลิสต์ใช่ไหม?',
      confirmLabel: 'ลบทิ้ง',
      cancelLabel: 'ยกเลิก'
    });
    
    if (ok) {
      removeTrack(playlist.id, trackId);
      showToast('ลบเพลงออกแล้ว', 'success');
    }
  };

  const handlePlayAll = () => {
    if (playlist.tracks.length > 0) {
      playTrack(playlist.tracks[0], playlist.tracks, 'playlist');
      showToast('กำลังเล่นเพลงทั้งหมด', 'info');
    }
  };

  const handleDeletePlaylist = async () => {
    if (playlist.id === 'liked_songs_id') return;
    const ok = await confirm({
      title: 'ลบเพลย์ลิสต์',
      message: `คุณต้องการลบเพลย์ลิสต์ "${playlist.name}" ใช่หรือไม่?`,
      confirmLabel: 'ลบเลย',
      cancelLabel: 'ไม่ลบ'
    });

    if (ok) {
      deletePlaylist(playlist.id);
      showToast('ลบเพลย์ลิสต์สำเร็จ', 'success');
      router.push('/library');
    }
  };

  const isLikedPlaylist = playlist.id === 'liked_songs_id';

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={`${styles.coverLarge} ${isLikedPlaylist ? styles.likedCover : ''}`}>
          {isLikedPlaylist ? (
            <Heart size={120} color="white" fill="white" />
          ) : (
            <ListVideo size={100} color="rgba(255,255,255,0.2)" />
          )}
        </div>
        <div className={styles.details}>
          <div className={styles.playlistType}>{isLikedPlaylist ? 'Collection' : 'Playlist'}</div>
          <h1 className={styles.playlistName}>{playlist.name}</h1>
          <div className={styles.playlistMeta}>
            <span style={{ fontWeight: 700, color: 'white' }}>{user?.username}</span>
            <span>•</span>
            <span>{playlist.tracks.length} เพลง</span>
          </div>
          <div className={styles.btnRow}>
            <button 
              className={styles.playBtn}
              onClick={handlePlayAll}
            >
              <Play size={28} fill="white" />
            </button>
            <button 
              className={styles.actionBtn}
              onClick={handleDeletePlaylist}
              title="ลบเพลย์ลิสต์"
              style={{ display: isLikedPlaylist ? 'none' : 'flex' }}
            >
              <Trash2 size={24} />
            </button>
          </div>
        </div>
      </header>

      <div className={styles.trackList}>
        <div className={styles.trackRow} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'default', opacity: 0.5 }}>
          <div className={styles.trackIndex}>#</div>
          <div className={styles.trackTitle}>ชื่อเพลง</div>
          <div className={styles.trackDuration} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Clock size={16} /> ระยะเวลา
          </div>
          <div></div>
        </div>

        {playlist.tracks.length > 0 ? (
          playlist.tracks.map((track, index) => {
            const isActive = currentTrack?.id === track.id;
            const liked = isLiked(track.id);
            return (
              <div 
                key={track.id} 
                className={styles.trackRow}
                onClick={() => playTrack(track, playlist.tracks, 'playlist')}
              >
                <div className={styles.trackIndex}>
                  {isActive && isPlaying ? <div className="pulse-mini" /> : index + 1}
                </div>
                <div className={styles.trackInfo}>
                  <img src={track.coverUrl} alt="" className={styles.trackThumb} />
                  <div>
                    <span className={styles.trackTitle} style={{ color: isActive ? 'var(--accent-primary)' : 'white' }}>
                      {track.title}
                    </span>
                    <span className={styles.trackArtist}>{track.artist}</span>
                  </div>
                </div>
                <div className={styles.trackDuration}>
                  {track.duration ? `${Math.floor(track.duration / 60)}:${(track.duration % 60).toString().padStart(2, '0')}` : '3:45'}
                </div>
                <div className={styles.trackActions}>
                   <button 
                    className={styles.heartSmallBtn}
                    onClick={(e) => { e.stopPropagation(); toggleLike(track); showToast(isLiked(track.id) ? 'ลบออกจากเพลงที่ชอบ' : 'เพิ่มในเพลงที่ชอบ', 'success'); }}
                    style={{ color: liked ? '#ff4d4d' : 'rgba(255,255,255,0.2)', background: 'none', border: 'none', cursor: 'pointer', padding: 8 }}
                  >
                    <Heart size={18} fill={liked ? '#ff4d4d' : 'none'} stroke={liked ? '#ff4d4d' : 'currentColor'} />
                  </button>
                  <button 
                    className={styles.removeBtn}
                    onClick={(e) => handleRemoveTrack(e, track.id)}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className={styles.emptyState}>
            <p>เพลย์ลิสต์นี้ยังไม่มีเพลง</p>
            <Link href="/search" style={{ color: 'var(--accent-primary)', marginTop: 12, display: 'inline-block' }}>
              ไปค้นหาเพลงมาเพิ่มกันเลย!
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
