'use client';
import { usePlayer } from '@/contexts/PlayerContext';
import { Clock, Play } from 'lucide-react';
import styles from './RecentlyPlayed.module.css';

export default function RecentlyPlayed() {
  const { history, playTrack } = usePlayer();

  if (!history || history.length === 0) return null;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Clock size={20} color="var(--accent-primary)" />
        <h2 className={styles.title}>ฟังล่าสุด</h2>
      </div>
      
      <div className={styles.scrollContainer}>
        {history.map((track) => (
          <div 
            key={track.id} 
            className={styles.trackCard}
            onClick={() => playTrack(track, history, 'discovery')}
          >
            <div className={styles.imageWrapper}>
              <img src={track.coverUrl} alt={track.title} className={styles.cover} />
              <div className={styles.playOverlay}>
                <Play size={20} fill="white" />
              </div>
            </div>
            <div className={styles.info}>
              <div className={styles.trackTitle}>{track.title}</div>
              <div className={styles.artist}>{track.artist}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
