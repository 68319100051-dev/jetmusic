export interface TrackData {
  id: string; // Unique ID for key-based React reset
  title: string;
  artist: string;
  album?: string;
  coverUrl: string;
  audioSrc?: string;
  duration?: number;
}

export function setupMediaSession(
  audioElement: HTMLAudioElement,
  track: TrackData,
  onPlay: () => void,
  onPause: () => void,
  onNext?: () => void,
  onPrev?: () => void
) {
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist,
      album: track.album || 'Unknown Album',
      artwork: [
        { src: track.coverUrl, sizes: '96x96', type: 'image/jpeg' },
        { src: track.coverUrl, sizes: '128x128', type: 'image/jpeg' },
        { src: track.coverUrl, sizes: '192x192', type: 'image/jpeg' },
        { src: track.coverUrl, sizes: '256x256', type: 'image/jpeg' },
        { src: track.coverUrl, sizes: '512x512', type: 'image/jpeg' },
      ]
    });

    navigator.mediaSession.setActionHandler('play', () => {
      audioElement.play().then(() => onPlay()).catch(console.error);
    });

    navigator.mediaSession.setActionHandler('pause', () => {
      audioElement.pause();
      onPause();
    });

    if (onPrev) {
      navigator.mediaSession.setActionHandler('previoustrack', () => onPrev());
    }

    if (onNext) {
      navigator.mediaSession.setActionHandler('nexttrack', () => onNext());
    }
  }
}
