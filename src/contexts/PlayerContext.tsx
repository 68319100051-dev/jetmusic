'use client';
import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { TrackData } from '../lib/mediaSession';
import { useAuth } from './AuthContext';

export type RepeatMode = 'off' | 'all' | 'one';
export type PlaySource = 'playlist' | 'search' | 'discovery' | 'history';

export interface PlayerContextType {
  currentTrack: TrackData | null;
  queue: TrackData[];
  currentIndex: number;
  isPlaying: boolean;
  shuffle: boolean;
  repeatMode: RepeatMode;
  playSource: PlaySource;
  history: TrackData[]; // Exposed History
  playTrack: (track: TrackData, queue?: TrackData[], source?: PlaySource) => void;
  pauseTrack: () => void;
  resumeTrack: () => void;
  playNext: () => void;
  playPrevious: () => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  onTrackEnded: () => void;
  resetPlayer: () => void;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const { user, isGuest, setShowAuthModal, updateStats, addToHistory } = useAuth();
  const [currentTrack, setCurrentTrack] = useState<TrackData | null>(null);
  const [queue, setQueue] = useState<TrackData[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const [playSource, setPlaySource] = useState<PlaySource>('discovery');

  const history = user?.history || [];

  // Hydrate from LocalStorage
  useEffect(() => {
    if (user?.email) {
      const saved = localStorage.getItem(`jet_player_state_${user.email}`);
      if (saved) {
        try {
          const state = JSON.parse(saved);
          setCurrentTrack(state.currentTrack || null);
          setQueue(state.queue || []);
          setCurrentIndex(state.currentIndex || 0);
          setShuffle(state.shuffle || false);
          setRepeatMode(state.repeatMode || 'off');
          setPlaySource(state.playSource || 'discovery');
        } catch (e) {
          console.error("Player hydration error:", e);
        }
      }
    }
  }, [user?.email]);


  // Persist to LocalStorage
  useEffect(() => {
    if (user?.email && (currentTrack || history.length > 0)) {
      const state = {
        currentTrack,
        queue,
        currentIndex,
        shuffle,
        repeatMode,
        playSource
      };
      localStorage.setItem(`jet_player_state_${user.email}`, JSON.stringify(state));
    }
  }, [user?.email, currentTrack, queue, currentIndex, shuffle, repeatMode, playSource]);

  const playTrack = useCallback((track: TrackData, newQueue?: TrackData[], source: PlaySource = 'discovery') => {
    if (isGuest) {
      setShowAuthModal(true);
      return;
    }
    
    // Increment songs played stat
    updateStats({ songsPlayed: 1 });

    const finalQueue = newQueue || [track];
    const idx = finalQueue.findIndex(t => t.id === track.id);
    setQueue(finalQueue);
    setCurrentIndex(idx >= 0 ? idx : 0);
    setCurrentTrack(track);
    setIsPlaying(true);
    setPlaySource(source);
    
    // Add to Cloud-synced History
    addToHistory(track);
  }, [isGuest, setShowAuthModal, updateStats, addToHistory]);

  const pauseTrack = useCallback(() => setIsPlaying(false), []);
  const resumeTrack = useCallback(() => setIsPlaying(true), []);

  const toggleShuffle = useCallback(() => setShuffle(s => !s), []);
  const toggleRepeat = useCallback(() => {
    setRepeatMode(m => m === 'off' ? 'all' : m === 'all' ? 'one' : 'off');
  }, []);

  const playNext = useCallback(() => {
    if (queue.length === 0) return;
    let nextIndex: number;
    if (shuffle) {
      const candidates = queue.map((_, i) => i).filter(i => i !== currentIndex);
      nextIndex = candidates.length > 0
        ? candidates[Math.floor(Math.random() * candidates.length)]
        : currentIndex;
    } else {
      nextIndex = (currentIndex + 1) % queue.length;
    }
    const nextTrack = queue[nextIndex];
    if (!nextTrack) return;
    setCurrentIndex(nextIndex);
    setCurrentTrack(nextTrack);
    setIsPlaying(true);
    addToHistory(nextTrack);
  }, [queue, currentIndex, shuffle, addToHistory]);

  const playPrevious = useCallback(() => {
    if (queue.length === 0) return;
    let prevIndex: number;
    if (shuffle) {
      const candidates = queue.map((_, i) => i).filter(i => i !== currentIndex);
      prevIndex = candidates.length > 0
        ? candidates[Math.floor(Math.random() * candidates.length)]
        : currentIndex;
    } else {
      prevIndex = currentIndex - 1 < 0 ? queue.length - 1 : currentIndex - 1;
    }
    const prevTrack = queue[prevIndex];
    if (!prevTrack) return;
    setCurrentIndex(prevIndex);
    setCurrentTrack(prevTrack);
    setIsPlaying(true);
    addToHistory(prevTrack);
  }, [queue, currentIndex, shuffle, addToHistory]);

  const onTrackEnded = useCallback(async () => {
    updateStats({ songsPlayed: 1 });
    
    if (repeatMode === 'one') {
      setIsPlaying(false);
      setTimeout(() => setIsPlaying(true), 100);
      return;
    }

    if (queue.length > 1) {
      if (repeatMode === 'all' || currentIndex < queue.length - 1) {
        playNext();
      } else {
        setIsPlaying(false);
      }
      return;
    }

    // If queue has 0 or 1 track, and not repeating one
    // Implement smart autoplay for 'search' or 'discovery' sources
    if (playSource === 'search' || playSource === 'discovery') {
      if (!currentTrack) return;
      try {
        const artistQuery = `${currentTrack.artist} เพลงใหม่`;
        const res = await fetch(`/api/search?q=${encodeURIComponent(artistQuery)}`);
        const data = await res.json();
        if (data.results && data.results.length > 0) {
          const similar = data.results.filter((t: TrackData) => t.id !== currentTrack.id);
          if (similar.length > 0) {
            const nextTrack = similar[Math.floor(Math.random() * Math.min(similar.length, 5))];
            setQueue([currentTrack, ...similar]);
            setCurrentIndex(1);
            setCurrentTrack(nextTrack);
            setIsPlaying(true);
            setPlaySource('discovery');
            addToHistory(nextTrack);
          } else {
            setIsPlaying(false); // No similar tracks found
          }
        } else {
          setIsPlaying(false); // No search results
        }
      } catch (e) {
        console.error("Smart autoplay error:", e);
        setIsPlaying(false);
      }
    } else {
      setIsPlaying(false); // Stop playing if no more tracks and not in smart autoplay mode
    }
  }, [repeatMode, queue.length, currentIndex, playNext, playSource, currentTrack, updateStats, addToHistory]);

  const resetPlayer = useCallback(() => {
    setCurrentTrack(null);
    setQueue([]);
    setCurrentIndex(0);
    setIsPlaying(false);
  }, []);

  // Auto-reset player on logout/session end
  useEffect(() => {
    if (!user && !isGuest && currentTrack) {
      resetPlayer();
    }
  }, [user, isGuest, currentTrack, resetPlayer]);

  return (
    <PlayerContext.Provider value={{
      currentTrack, queue, currentIndex, isPlaying,
      shuffle, repeatMode, playSource, history,
      playTrack, pauseTrack, resumeTrack,
      playNext, playPrevious, toggleShuffle, toggleRepeat, onTrackEnded, resetPlayer
    }}>
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (context === undefined) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
}
