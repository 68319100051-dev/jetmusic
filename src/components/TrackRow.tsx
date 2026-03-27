'use client';
import { Heart, Plus, Play } from 'lucide-react';
import { TrackData } from '@/lib/mediaSession';
import { usePlaylist } from '@/contexts/PlaylistContext';
import { usePlayer, PlaySource } from '@/contexts/PlayerContext';
import { useToast } from '@/contexts/ToastContext';
import styles from './TrackRow.module.css';

interface TrackRowProps {
  track: TrackData;
  index?: number;
  showIndex?: boolean;
  // Optional: pass the surrounding list so Next/Prev work correctly
  queue?: TrackData[];
  playSource?: PlaySource;
}

export default function TrackRow({ track, index, showIndex = false, queue, playSource = 'discovery' }: TrackRowProps) {
  const { playTrack, currentTrack, isPlaying } = usePlayer();
  const { toggleLike, isLiked } = usePlaylist();
  const { showToast } = useToast();

  const isActive = currentTrack?.id === track.id;
  const liked = isLiked(track.id);

  const handlePlay = () => {
    playTrack(track, queue, playSource);
  };

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleLike(track);
    showToast(liked ? 'ลบออกจากเพลงที่ชอบ' : 'เพิ่มในเพลงที่ชอบ', 'success');
  };

  return (
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
        <div className={styles.artist}>
           เพลง • {track.artist}
        </div>
      </div>

      <div className={styles.actions}>
        <button className={styles.iconBtn} onClick={handleLike}>
          <Heart size={20} fill={liked ? '#ef4444' : 'none'} color={liked ? '#ef4444' : 'rgba(255,255,255,0.4)'} />
        </button>
        <button className={styles.iconBtn} onClick={(e) => e.stopPropagation()}>
          <Plus size={20} color="rgba(255,255,255,0.4)" />
        </button>
      </div>
    </div>
  );
}
