import { Play } from 'lucide-react';
import { TrackData } from '@/lib/mediaSession';

interface TrackCardProps {
  track: TrackData;
  onClick: () => void;
}

export default function TrackCard({ track, onClick }: TrackCardProps) {
  return (
    <div className="track-card" onClick={onClick}>
      <div className="track-cover-container">
        <img src={track.coverUrl} alt={track.title} className="track-cover" />
        <div className="play-overlay">
          <div className="play-btn-circle">
            <Play size={24} fill="white" color="white" style={{ marginLeft: 2 }} />
          </div>
        </div>
      </div>
      <div className="track-info">
        <div className="track-name">{track.title}</div>
        <div className="track-artist">{track.artist}</div>
      </div>
    </div>
  );
}
