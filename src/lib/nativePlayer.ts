import { registerPlugin } from '@capacitor/core';

export interface NativeAudioPlayerPlugin {
  play(options: {
    url: string;
    title: string;
    artist: string;
    coverUrl: string;
  }): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  stop(): Promise<void>;
  seekTo(options: { posMs: number }): Promise<void>;
  getStatus(): Promise<{
    ready: boolean;
    isPlaying: boolean;
    currentPosition: number;
    duration: number;
    serviceAlive?: boolean;
  }>;
  openSettings(): Promise<void>;
  addListener(
    eventName: 'trackEnded',
    listenerFunc: () => void
  ): Promise<{ remove: () => void }>;
  addListener(
    eventName: 'playbackStateChanged',
    listenerFunc: (data: { isPlaying: boolean }) => void
  ): Promise<{ remove: () => void }>;
  addListener(
    eventName: 'error',
    listenerFunc: (data: { error: string }) => void
  ): Promise<{ remove: () => void }>;
  setPlaylist(options: {
    current: { url: string; title: string; artist: string; coverUrl: string };
    next?: { url: string; title: string; artist: string; coverUrl: string };
  }): Promise<void>;
}

const NativeAudioPlayer = registerPlugin<NativeAudioPlayerPlugin>('NativeAudioPlayer');

export default NativeAudioPlayer;
