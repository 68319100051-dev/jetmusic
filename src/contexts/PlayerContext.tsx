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
  startRadio: (track: TrackData) => void;
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
  const [shuffledIndices, setShuffledIndices] = useState<number[]>([]);

  const history = user?.history || [];

  // Generate shuffled indices when shuffle is turned on or queue changes
  useEffect(() => {
    if (shuffle && queue.length > 0) {
      const indices = Array.from({ length: queue.length }, (_, i) => i);
      // Remove current index from shuffle pool to avoid immediate repeat if possible
      const otherIndices = indices.filter(i => i !== currentIndex);
      for (let i = otherIndices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [otherIndices[i], otherIndices[j]] = [otherIndices[j], otherIndices[i]];
      }
      setShuffledIndices([currentIndex, ...otherIndices]);
    } else {
      setShuffledIndices([]);
    }
  }, [shuffle, queue.length]);

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
    if (shuffle && shuffledIndices.length > 0) {
      const currentPosInShuffle = shuffledIndices.indexOf(currentIndex);
      nextIndex = shuffledIndices[(currentPosInShuffle + 1) % shuffledIndices.length];
    } else {
      nextIndex = (currentIndex + 1) % queue.length;
    }
    const nextTrack = queue[nextIndex];
    if (!nextTrack) return;
    setCurrentIndex(nextIndex);
    setCurrentTrack(nextTrack);
    setIsPlaying(true);
    addToHistory(nextTrack);
  }, [queue, currentIndex, shuffle, shuffledIndices, addToHistory]);

  const playPrevious = useCallback(() => {
    if (queue.length === 0) return;
    let prevIndex: number;
    if (shuffle && shuffledIndices.length > 0) {
      const currentPosInShuffle = shuffledIndices.indexOf(currentIndex);
      prevIndex = shuffledIndices[currentPosInShuffle - 1 < 0 ? shuffledIndices.length - 1 : currentPosInShuffle - 1];
    } else {
      prevIndex = currentIndex - 1 < 0 ? queue.length - 1 : currentIndex - 1;
    }
    const prevTrack = queue[prevIndex];
    if (!prevTrack) return;
    setCurrentIndex(prevIndex);
    setCurrentTrack(prevTrack);
    setIsPlaying(true);
    addToHistory(prevTrack);
  }, [queue, currentIndex, shuffle, shuffledIndices, addToHistory]);

  const startRadio = useCallback(async (track: TrackData) => {
    if (isGuest) { setShowAuthModal(true); return; }
    try {
      console.log(`[JET-RADIO] 📻 Starting Radio for: ${track.title}`);
      const res = await fetch(`/api/related?id=${encodeURIComponent(track.id)}`);
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        const radioQueue = [track, ...data.results.slice(0, 19)];
        setQueue(radioQueue);
        setCurrentIndex(0);
        setCurrentTrack(track);
        setIsPlaying(true);
        setPlaySource('discovery');
        addToHistory(track);
      }
    } catch (e) {
      console.error("[JET-RADIO] Error starting radio:", e);
    }
  }, [isGuest, setShowAuthModal, addToHistory]);

  const onTrackEnded = useCallback(async () => {
    updateStats({ songsPlayed: 1 });
    
    if (repeatMode === 'one') {
      setIsPlaying(false);
      setTimeout(() => setIsPlaying(true), 100);
      return;
    }

    const isAtEndOfQueue = currentIndex >= queue.length - 1;

    // Normal play next if we are not at end, or if repeat all
    if (!isAtEndOfQueue || repeatMode === 'all') {
      playNext();
      return;
    }

    // 🎵 AUTO DJ: We reached the end of the queue — find similar songs and keep playing!
    if (currentTrack) {
      try {
        console.log("[JET-AUTO-DJ] 🎵 Queue ended! Finding more songs...");
        const res = await fetch(`/api/related?id=${encodeURIComponent(currentTrack.id)}`);
        const data = await res.json();
        if (data.results && data.results.length > 0) {
          const queueIds = new Set(queue.map(t => t.id));
          const newTracks = data.results
            .filter((t: TrackData) => !queueIds.has(t.id))
            .slice(0, 5); // Add up to 5 new tracks

          if (newTracks.length > 0) {
            setQueue(prev => [...prev, ...newTracks]);
            setCurrentIndex(queue.length); // Jump to first new track
            setCurrentTrack(newTracks[0]);
            setIsPlaying(true);
            addToHistory(newTracks[0]);
            console.log(`[JET-AUTO-DJ] ✅ Added ${newTracks.length} tracks to queue!`);
            return;
          }
        }
        setIsPlaying(false);
      } catch (e) {
        console.error("[JET-AUTO-DJ] Error:", e);
        setIsPlaying(false);
      }
    } else {
      setIsPlaying(false);
    }
  }, [repeatMode, queue, currentIndex, playNext, currentTrack, updateStats, addToHistory]);

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
      playNext, playPrevious, toggleShuffle, toggleRepeat, onTrackEnded, startRadio, resetPlayer
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
