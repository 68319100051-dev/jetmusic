export interface TrackData {
  id: string; // Unique ID for key-based React reset
  title: string;
  artist: string;
  album?: string;
  coverUrl: string;
  audioSrc?: string;
  duration?: number;
}

// Helper to convert typical YouTube MQ/HQ thumbnails to Max Res if possible
const getHighResCoverUrl = (url: string) => {
  if (!url) return '';
  if (url.includes('ytimg.com/vi/')) {
    // If it's a youtube thumbnail, return maxresdefault for best quality (1280x720)
    // Mobile OS will center-crop it to 1:1, but starting with a high-res image is crucial.
    return url.replace(/(hqdefault|mqdefault|default|sddefault)\.jpg/i, 'maxresdefault.jpg');
  }
  return url;
};

export function setupMediaSession(opts: {
  track: TrackData;
  onPlay: () => void;
  onPause: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  onSeekTo?: (time: number) => void;
  onSeekForward?: (skipTime: number) => void;
  onSeekBackward?: (skipTime: number) => void;
}) {
  if ('mediaSession' in navigator) {
    const hdCover = getHighResCoverUrl(opts.track.coverUrl);
    
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: opts.track.title,
        artist: opts.track.artist || 'Jet Music',
        album: opts.track.album || 'Jet Music Premium',
        artwork: [
          { src: hdCover || opts.track.coverUrl, sizes: '96x96', type: 'image/jpeg' },
          { src: hdCover || opts.track.coverUrl, sizes: '128x128', type: 'image/jpeg' },
          { src: hdCover || opts.track.coverUrl, sizes: '192x192', type: 'image/jpeg' },
          { src: hdCover || opts.track.coverUrl, sizes: '256x256', type: 'image/jpeg' },
          { src: hdCover || opts.track.coverUrl, sizes: '384x384', type: 'image/jpeg' },
          { src: hdCover || opts.track.coverUrl, sizes: '512x512', type: 'image/jpeg' },
          { src: hdCover || opts.track.coverUrl, sizes: '1024x1024', type: 'image/jpeg' } // Vital for iOS/Android native feel
        ]
      });

      // Actions
      navigator.mediaSession.setActionHandler('play', () => opts.onPlay());
      navigator.mediaSession.setActionHandler('pause', () => opts.onPause());
      
      if (opts.onPrev) {
        navigator.mediaSession.setActionHandler('previoustrack', () => opts.onPrev && opts.onPrev());
      }
      
      if (opts.onNext) {
        navigator.mediaSession.setActionHandler('nexttrack', () => opts.onNext && opts.onNext());
      }

      if (opts.onSeekTo) {
         navigator.mediaSession.setActionHandler('seekto', (details) => {
            if (details.seekTime !== undefined && opts.onSeekTo) {
               opts.onSeekTo(details.seekTime);
            }
         });
      }

      if (opts.onSeekBackward) {
         navigator.mediaSession.setActionHandler('seekbackward', (details) => {
            const skipTime = details.seekOffset || 10;
            if (opts.onSeekBackward) opts.onSeekBackward(skipTime);
         });
      }

      if (opts.onSeekForward) {
         navigator.mediaSession.setActionHandler('seekforward', (details) => {
            const skipTime = details.seekOffset || 10;
            if (opts.onSeekForward) opts.onSeekForward(skipTime);
         });
      }

    } catch (e) {
      console.warn("MediaSession initialization failed:", e);
    }
  }
}

export function updateMediaSessionState(isPlaying: boolean) {
  if ('mediaSession' in navigator) {
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  }
}

export function updateMediaSessionPosition(playedSeconds: number, duration: number) {
  if ('mediaSession' in navigator && duration > 0 && playedSeconds >= 0) {
    try {
      navigator.mediaSession.setPositionState({
        duration: Math.max(duration, 0),
        playbackRate: 1,
        position: Math.min(Math.max(playedSeconds, 0), duration)
      });
    } catch (e) {
      // Ignored: Sometimes OS reports temporary incorrect state
    }
  }
}
