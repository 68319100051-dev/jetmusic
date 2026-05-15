'use client';
import { useState } from 'react';
import { Heart, Plus, Play, X } from 'lucide-react';
import { TrackData } from '@/lib/mediaSession';
import { usePlaylist } from '@/contexts/PlaylistContext';
import { usePlayer, PlaySource } from '@/contexts/PlayerContext';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import styles from './TrackRow.module.css';

interface TrackRowProps {
  track: TrackData;
  index?: number;
  showIndex?: boolean;
  queue?: TrackData[];
  playSource?: PlaySource;
}

export default function TrackRow({ track, index, showIndex = false, queue, playSource = 'discovery' }: TrackRowProps) {
  const { playTrack, currentTrack, isPlaying } = usePlayer();
  const { playlists, addTrack, toggleLike, isLiked } = usePlaylist();
  const { showToast } = useToast();
  const { user, setShowAuthModal } = useAuth();
  const [showModal, setShowModal] = useState(false);

  const isActive = currentTrack?.id === track.id;
  const liked = isLiked(track.id);

  const handlePlay = () => {
    playTrack(track, queue, playSource);
  };

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) { setShowAuthModal(true); return; }
    toggleLike(track);
    showToast(liked ? 'ลบออกจากเพลงที่ชอบ' : 'เพิ่มในเพลงที่ชอบ', 'success');
  };

  const handlePlusClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) { setShowAuthModal(true); return; }
    setShowModal(true);
  };

  return (
    <>
      <div
        className={`${styles.row} ${isActive ? styles.active : ''}`}
        onClick={handlePlay}
      >
        {showIndex && index !== undefined && (
          <div className={styles.index}>
            {isActive && isPlaying ? <div className={styles.pulse} /> : index + 1}
          </div>
        )}

        <div className={styles.thumbnailWrapper}>
          <img src={track.coverUrl} alt={track.title} className={styles.thumbnail} />
          {isActive && isPlaying && <div className={styles.playingOverlay}><Play size={16} fill="white" /></div>}
        </div>

        <div className={styles.info}>
          <div className={styles.title} style={{ color: isActive ? 'var(--accent-primary)' : 'white' }}>
            {track.title}
          </div>
          <div className={styles.artist}>เพลง • {track.artist}</div>
        </div>

        <div className={styles.actions}>
          <button className={styles.iconBtn} onClick={handleLike}>
            <Heart size={20} fill={liked ? '#ef4444' : 'none'} color={liked ? '#ef4444' : 'rgba(255,255,255,0.4)'} />
          </button>
          <button className={styles.iconBtn} onClick={handlePlusClick}>
            <Plus size={20} color="rgba(255,255,255,0.6)" />
          </button>
        </div>
      </div>

      {/* Playlist Picker Modal */}
      {showModal && (
        <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div className={styles.modalSheet} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>เพิ่มลงเพลย์ลิสต์</span>
              <button className={styles.closeBtn} onClick={() => setShowModal(false)}>
                <X size={22} />
              </button>
            </div>

            {/* Song preview */}
            <div className={styles.trackPreview}>
              <img src={track.coverUrl} alt={track.title} className={styles.previewCover} />
              <div className={styles.previewInfo}>
                <div className={styles.previewTitle}>{track.title}</div>
                <div className={styles.previewArtist}>{track.artist}</div>
              </div>
            </div>

            <div className={styles.playlistOptions}>
              {playlists.filter(pl => pl.id !== 'liked_songs_id').map(pl => {
                const isAdded = pl.tracks.some(t => t.id === track.id);
                return (
                  <button
                    key={pl.id}
                    className={`${styles.playlistOption} ${isAdded ? styles.addedOption : ''}`}
                    disabled={isAdded}
                    onClick={() => {
                      addTrack(pl.id, track);
                      showToast(`เพิ่มลง "${pl.name}" แล้ว`, 'success');
                      setShowModal(false);
                    }}
                  >
                    <span className={styles.optionName}>{pl.name}</span>
                    <span className={styles.optionCount}>{isAdded ? '✓ เพิ่มแล้ว' : `${pl.tracks.length} เพลง`}</span>
                  </button>
                );
              })}
              {playlists.filter(pl => pl.id !== 'liked_songs_id').length === 0 && (
                <p className={styles.noPlaylists}>ยังไม่มีเพลย์ลิสต์ ลองสร้างในหน้าคลังเพลงก่อนนะครับ</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
