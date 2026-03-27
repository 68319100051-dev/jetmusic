'use client';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { TrackData } from '../lib/mediaSession';

export interface Playlist {
  id: string;
  name: string;
  tracks: TrackData[];
  createdAt: number;
}

interface PlaylistContextType {
  playlists: Playlist[];
  createPlaylist: (name: string) => void;
  deletePlaylist: (id: string) => void;
  addTrack: (playlistId: string, track: TrackData) => void;
  removeTrack: (playlistId: string, trackId: string) => void;
  toggleLike: (track: TrackData) => void;
  isLiked: (trackId: string) => boolean;
  isLoaded: boolean;
}

const LIKED_SONGS_ID = 'liked_songs_id';

const PlaylistContext = createContext<PlaylistContextType | undefined>(undefined);

export function PlaylistProvider({ children }: { children: React.ReactNode }) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const { user } = useAuth();

  // Load playlists for current user
  useEffect(() => {
    if (user?.id) {
      const saved = localStorage.getItem(`jet_playlists_${user.id}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          // Ensure Liked Songs exists
          if (!parsed.some((p: any) => p.id === LIKED_SONGS_ID)) {
             parsed.unshift({ 
               id: LIKED_SONGS_ID, 
               name: 'เพลงที่ชอบ', 
               tracks: [], 
               createdAt: Date.now() 
             });
          }
          setPlaylists(parsed);
        } catch (e) {
          console.error("Failed to parse playlists", e);
        }
      } else {
        setPlaylists([{ 
          id: LIKED_SONGS_ID, 
          name: 'เพลงที่ชอบ', 
          tracks: [], 
          createdAt: Date.now() 
        }]);
      }
    } else {
      setPlaylists([]);
    }
    setIsLoaded(true);
  }, [user?.id]);

  // Save playlists when they change
  useEffect(() => {
    if (user?.id && isLoaded) {
      localStorage.setItem(`jet_playlists_${user.id}`, JSON.stringify(playlists));
    }
  }, [playlists, user?.id, isLoaded]);

  const createPlaylist = (name: string) => {
    if (!user) return;
    const newPlaylist: Playlist = {
      id: `pl_${Date.now()}`,
      name,
      tracks: [],
      createdAt: Date.now()
    };
    setPlaylists(prev => [...prev, newPlaylist]);
  };

  const deletePlaylist = (id: string) => {
    if (id === LIKED_SONGS_ID) return; // Protected
    setPlaylists(prev => prev.filter(p => p.id !== id));
  };

  const addTrack = (playlistId: string, track: TrackData) => {
    setPlaylists(prev => prev.map(p => {
      if (p.id === playlistId) {
        if (p.tracks.some(t => t.id === track.id)) return p;
        return { ...p, tracks: [...p.tracks, track] };
      }
      return p;
    }));
  };

  const removeTrack = (playlistId: string, trackId: string) => {
    setPlaylists(prev => prev.map(p => {
      if (p.id === playlistId) {
        return { ...p, tracks: p.tracks.filter(t => t.id !== trackId) };
      }
      return p;
    }));
  };

  const toggleLike = (track: TrackData) => {
    const isAlreadyLiked = playlists.find(p => p.id === LIKED_SONGS_ID)?.tracks.some(t => t.id === track.id);
    if (isAlreadyLiked) {
      removeTrack(LIKED_SONGS_ID, track.id);
    } else {
      addTrack(LIKED_SONGS_ID, track);
    }
  };

  const isLiked = (trackId: string) => {
    return playlists.find(p => p.id === LIKED_SONGS_ID)?.tracks.some(t => t.id === trackId) || false;
  };

  return (
    <PlaylistContext.Provider value={{ playlists, createPlaylist, deletePlaylist, addTrack, removeTrack, toggleLike, isLiked, isLoaded }}>
      {children}
    </PlaylistContext.Provider>
  );
}

export function usePlaylist() {
  const context = useContext(PlaylistContext);
  if (context === undefined) {
    throw new Error('usePlaylist must be used within a PlaylistProvider');
  }
  return context;
}
