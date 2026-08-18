'use client';
import { useRef, useEffect, useState } from 'react';
import {
  Play, Pause, SkipForward, SkipBack, ChevronDown, Heart,
  ListMusic, Loader2, X, Plus, Shuffle, Repeat, Repeat1, Volume2, Mic, Radio, Share2
} from 'lucide-react';
import { usePlayer } from '../contexts/PlayerContext';
import { useAuth } from '../contexts/AuthContext';
import { usePlaylist } from '../contexts/PlaylistContext';
import { useToast } from '../contexts/ToastContext';
import styles from './Player.module.css';
import dynamic from 'next/dynamic';
import ShareStoryModal from './ShareStoryModal';
import { TrackData, setupMediaSession, updateMediaSessionState, updateMediaSessionPosition } from '@/lib/mediaSession';
import { Capacitor } from '@capacitor/core';
import { ForegroundService, Importance } from '@capawesome-team/capacitor-android-foreground-service';
import NativeAudioPlayer from '@/lib/nativePlayer';

type ParsedLyricLine = { time: number; text: string };

const parseLrc = (lrc: string): ParsedLyricLine[] => {
  const lines = lrc.split('\n');
  const parsed: ParsedLyricLine[] = [];
  const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/;
  for (const line of lines) {
    const match = timeRegex.exec(line);
    if (match) {
      const min = parseInt(match[1]);
      const sec = parseInt(match[2]);
      const ms = match[3].length === 2 ? parseInt(match[3]) * 10 : parseInt(match[3]);
      const time = min * 60 + sec + ms / 1000;
      const text = line.replace(timeRegex, '').trim();
      parsed.push({ time, text: text || '🎵' });
    }
  }
  return parsed;
};

const ReactPlayer = dynamic(() => import('react-player'), { ssr: false });

export default function Player() {
  const {
    currentTrack, isPlaying, pauseTrack, resumeTrack, playNext, playPrevious, toggleShuffle, toggleRepeat,
    shuffle, repeatMode, onTrackEnded, queue, currentIndex, playTrack, startRadio
  } = usePlayer();
  const { user, addToHistory, recordPlayStats } = useAuth();
  const { showToast } = useToast();
  
  // 🧬 V4.3.2: DNA check for native effects (ExoPlayer sync, listeners, etc.)
  // ReactPlayer is ALWAYS enabled for foreground — ExoPlayer handles background independently.
  const isNativeDNA = typeof window !== 'undefined'
    ? navigator.userAgent.includes('JetMusicNative')
    : false;
  const SERVER_URL = 'https://jet-music.vercel.app';

  const addDebugLog = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    console.log(`[JET-DEBUG] ${msg}`);
    if (typeof window !== 'undefined') {
      const logs = JSON.parse(localStorage.getItem('jet_debug_logs') || '[]');
      logs.push(`[${time}] ${msg}`);
      localStorage.setItem('jet_debug_logs', JSON.stringify(logs.slice(-20))); // Keep last 20
    }
  };

  useEffect(() => {
    if (!isNativeDNA) return;
    addDebugLog(`Native DNA Ready ✅`);
    
    let errorListener: any;
    let stateListener: any;

    const setupListeners = async () => {
      errorListener = await NativeAudioPlayer.addListener('error', (data: any) => {
          addDebugLog(`🚨 NATIVE ERROR: ${data.error}`);
          showToast('เกิดข้อผิดพลาดในการเล่นเพลงบนมือถือ กำลังเล่นเพลงถัดไป...', 'error');
          setTimeout(() => {
              playNext();
          }, 3000);
      });
      
      stateListener = await NativeAudioPlayer.addListener('playbackStateChanged', (data: any) => {
          addDebugLog(`🔄 State: ${data.isPlaying ? 'Playing' : 'Paused'}`);
      });
    };

    setupListeners();

    return () => { 
        if (errorListener) errorListener.remove(); 
        if (stateListener) stateListener.remove();
    };
  }, [isNativeDNA, playNext, showToast]);
  
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showDebugOverlay, setShowDebugOverlay] = useState(false);
  const [debugLogList, setDebugLogList] = useState<string[]>([]);

  const toggleDebugOverlay = () => {
    if (typeof window !== 'undefined') {
      const logs = JSON.parse(localStorage.getItem('jet_debug_logs') || '[]');
      setDebugLogList(logs);
    }
    setShowDebugOverlay(prev => !prev);
  };

  const handleStartRadio = () => {
    if (currentTrack) {
      startRadio(currentTrack);
      showToast('เริ่มเล่นวิทยุจากเพลงนี้ 📻', 'success');
    }
  };
  
  // Audio Booster State
  const [volumeBoost, setVolumeBoost] = useState(() => {
    if (typeof window !== 'undefined') {
       const saved = localStorage.getItem('jet_v2_volume_boost');
       return saved ? parseFloat(saved) : 1.0;
    }
    return 1.0;
  });
  
  const [playedSeconds, setPlayedSeconds] = useState(0);
  const [playedPercent, setPlayedPercent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [seeking, setSeeking] = useState(false);
  const [isReady, setIsReady] = useState(false);
  
  const { playlists, createPlaylist, addTrack, toggleLike, isLiked } = usePlaylist();
  
  const [isHeartPopping, setIsHeartPopping] = useState(false);
  const [proxyFailed, setProxyFailed] = useState(false);
  const [urlCache, setUrlCache] = useState<Record<string, {url: string; expiresAt: number}>>({});

  // Lyrics State
  const [showLyrics, setShowLyrics] = useState(false);
  const [lyricsData, setLyricsData] = useState<{ plainLyrics: string | null, syncedLyrics: string | null, parsedLines: ParsedLyricLine[] | null, isLoading: boolean, error: string | null }>({ plainLyrics: null, syncedLyrics: null, parsedLines: null, isLoading: false, error: null });

  const [activeLyricIndex, setActiveLyricIndex] = useState(-1);
  const [autoSyncOffset, setAutoSyncOffset] = useState(0);
  const activeLyricRef = useRef<HTMLParagraphElement>(null);

  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressingRef = useRef(false);
  const [pressingLineIndex, setPressingLineIndex] = useState<number | null>(null);
  const analyserNodeRef = useRef<AnalyserNode | null>(null);
  const detectionStartedRef = useRef(false);
  const detectedTimeRef = useRef<number | null>(null);

  const handleManualSync = (targetTime: number, lineIdx: number) => {
    // Correct Magic Math: MetadataTime - RealTime = Offset
    const offset = targetTime - playedSeconds;
    setAutoSyncOffset(offset);
    detectedTimeRef.current = playedSeconds; // Stop auto-detector from overriding
    setActiveLyricIndex(lineIdx); // Snap highlight immediately
    showToast(`ปรับจังหวะเนื้อเพลงแล้ว (${offset > 0 ? '+' : ''}${offset.toFixed(1)}s)`, 'success');
  };

  useEffect(() => {
    // If lyrics modal is open and track changes, fetch new lyrics
    if (showLyrics && currentTrack) {
      handleFetchLyrics();
    } else {
      setLyricsData({ plainLyrics: null, syncedLyrics: null, parsedLines: null, isLoading: false, error: null });
      setActiveLyricIndex(-1);
    }
  }, [currentTrack?.id, showLyrics]);

  const handleFetchLyrics = async () => {
    if (!currentTrack) return;
    setLyricsData({ plainLyrics: null, syncedLyrics: null, parsedLines: null, isLoading: true, error: null });
    try {
      const res = await fetch(`/api/lyrics?title=${encodeURIComponent(currentTrack.title)}&artist=${encodeURIComponent(currentTrack.artist)}`);
      const data = await res.json();
      if (data.plainLyrics) {
        let parsed = null;
        if (data.syncedLyrics) {
           parsed = parseLrc(data.syncedLyrics);
        }
        setLyricsData({ 
           plainLyrics: data.plainLyrics, 
           syncedLyrics: data.syncedLyrics, 
           parsedLines: parsed,
           isLoading: false, 
           error: null 
        });
      } else {
        setLyricsData({ plainLyrics: null, syncedLyrics: null, parsedLines: null, isLoading: false, error: 'ไม่พบเนื้อเพลงซิงเกิลนี้' });
      }
    } catch (e) {
      setLyricsData({ plainLyrics: null, syncedLyrics: null, parsedLines: null, isLoading: false, error: 'เกิดข้อผิดพลาดในการโหลดเนื้อเพลง' });
    }
  };

  // Track active lyric line
  useEffect(() => {
    if (showLyrics && lyricsData.parsedLines) {
       let matchIndex = -1;
       const delayThreshold = 0.1; // Reduced from 0.3 to be less "ahead"
       for (let i = 0; i < lyricsData.parsedLines.length; i++) {
          // Apply autoSyncOffset calculated by the detector
          if (playedSeconds + delayThreshold + autoSyncOffset >= lyricsData.parsedLines[i].time) {
             matchIndex = i;
          } else {
             break;
          }
       }
       if (matchIndex !== activeLyricIndex) {
          setActiveLyricIndex(matchIndex);
       }
    }
  }, [playedSeconds, showLyrics, lyricsData.parsedLines, autoSyncOffset]);

  // 🕵️ AUTO-VOCAL DETECTION LOOP
  useEffect(() => {
     if (!isPlaying || !isReady || !lyricsData.parsedLines || !analyserNodeRef.current || detectedTimeRef.current !== null) {
        return;
     }

     const firstLyricTime = lyricsData.parsedLines[0].time;
     // Only search around the expected start time (within +/- 15 seconds)
     if (playedSeconds > firstLyricTime + 15) return;

     const analyser = analyserNodeRef.current;
     const bufferLength = analyser.frequencyBinCount;
     const dataArray = new Uint8Array(bufferLength);
     let consecutiveHits = 0;

     const checkAudio = () => {
        if (!isPlaying || detectedTimeRef.current !== null) return;
        
        analyser.getByteFrequencyData(dataArray);
        
        let vocalEnergy = 0;
        for (let i = 14; i < 140; i++) {
           vocalEnergy += dataArray[i];
        }
        const avgVocalEnergy = vocalEnergy / (140 - 14);

        // Increased threshold to 80 and added sustainability check (3 consecutive hits)
        if (avgVocalEnergy > 80 && playedSeconds > 0.5) {
           consecutiveHits++;
           if (consecutiveHits > 5) { // Need ~100ms of sustained energy
              const offset = playedSeconds - firstLyricTime - 0.1; // Subtract the hit delay
              if (Math.abs(offset) < 15) {
                 console.log(`[JET AUTO-SYNC] Verified Vocal Start at ${playedSeconds.toFixed(2)}s. Applying Offset: ${offset.toFixed(2)}s`);
                 detectedTimeRef.current = playedSeconds;
                 setAutoSyncOffset(offset);
              }
           }
        } else {
           consecutiveHits = 0;
        }
        
        if (detectedTimeRef.current === null) {
            requestAnimationFrame(checkAudio);
         }
      };

      // Check once immediately then loop
      checkAudio();
   }, [isPlaying, isReady, lyricsData.parsedLines, playedSeconds]);

  // Reset detector on track change
  useEffect(() => {
     detectedTimeRef.current = null;
     setAutoSyncOffset(0);
     setProxyFailed(false); // Reset proxy failure state for each new track
     nextTrackPreloadedRef.current = false; // Reset preload ref
  }, [currentTrack?.id]);

  // Handle active line auto-scroll
  useEffect(() => {
     if (activeLyricIndex >= 0 && activeLyricRef.current) {
        activeLyricRef.current.scrollIntoView({
           behavior: 'smooth',
           block: 'center'
        });
     }
  }, [activeLyricIndex]);

  const handleToggleLike = () => {
    if (!user) { showToast('กรุณาเข้าสู่ระบบก่อนครับ', 'error'); return; }
    const currentlyLiked = isLiked(currentTrack!.id);
    toggleLike(currentTrack!);
    setIsHeartPopping(true);
    setTimeout(() => setIsHeartPopping(false), 400);
    showToast(currentlyLiked ? 'ลบออกจากเพลงที่ชอบ' : 'เพิ่มในเพลงที่ชอบ', 'success');
  };

  const playerRef = useRef<any>(null);
  const isFirstLoad = useRef(true);
  const wakeLockRef = useRef<any>(null);

  const isYouTube = currentTrack?.audioSrc?.includes('youtube.com') || currentTrack?.audioSrc?.includes('youtu.be');
  const finalAudioSrc = (isYouTube && !proxyFailed)
    ? (urlCache[currentTrack?.id || '']?.url || `/api/stream?id=${encodeURIComponent(currentTrack?.audioSrc || '')}`) 
    : (currentTrack?.audioSrc || '');

  // Booster Refs
  const audioCtxRef = useRef<any>(null);
  const gainNodeRef = useRef<any>(null);
  const sourceNodeRef = useRef<any>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const attachedElementRef = useRef<HTMLMediaElement | null>(null);
  
  // Stats tracker
  const statsLoggedRef = useRef(false);
  const nextTrackPreloadedRef = useRef(false);
  const playRetryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [dominantColor, setDominantColor] = useState('rgba(30, 27, 75, 1)'); // Default deep purple
  const [relatedTracks, setRelatedTracks] = useState<TrackData[]>([]);
  const visualizerCanvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  // 🕵️ Status Logger: Track when and why the player pauses
  useEffect(() => {
    const player = playerRef.current?.getInternalPlayer?.();
    if (!player || !(player instanceof HTMLMediaElement)) return;

    const onPause = () => console.log(`[JET-LOG] ⏸️ Audio Paused - Current Visibility: ${document.visibilityState}`);
    const onPlay = () => console.log(`[JET-LOG] ▶️ Audio Playing - Current Visibility: ${document.visibilityState}`);
    const onAbort = () => console.log(`[JET-LOG] ⚠️ Audio Aborted!`);
    const onWaiting = () => console.log(`[JET-LOG] ⏳ Audio Waiting (Buffering)...`);

    player.addEventListener('pause', onPause);
    player.addEventListener('play', onPlay);
    player.addEventListener('abort', onAbort);
    player.addEventListener('waiting', onWaiting);

    return () => {
      player.removeEventListener('pause', onPause);
      player.removeEventListener('play', onPlay);
      player.removeEventListener('abort', onAbort);
      player.removeEventListener('waiting', onWaiting);
    };
  }, [isReady]);

  useEffect(() => {
    console.log("[JET-SYSTEM] ✨ Jet Music Premium v2.2 (Dynamic + Visualizer) Loaded! ✨");
    if (currentTrack) {
      if (isFirstLoad.current) {
        isFirstLoad.current = false;
        return;
      }
      setIsExpanded(true);
      setIsMinimized(false);
      setDuration(0);
      setIsReady(false);
      statsLoggedRef.current = false;
      nextTrackPreloadedRef.current = false;
      if (playRetryTimeoutRef.current) clearTimeout(playRetryTimeoutRef.current);
    }
  }, [currentTrack?.id]);

  // Save volume preference and apply dynamically
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('jet_v2_volume_boost', volumeBoost.toString());
    }
    if (gainNodeRef.current && audioCtxRef.current) {
       // สลับความดังแบบ smooth ไม่กระตุก
       gainNodeRef.current.gain.setTargetAtTime(volumeBoost, audioCtxRef.current.currentTime, 0.05);
    }
  }, [volumeBoost]);

  // Bind Web Audio Graph (Run when player is ready)
  useEffect(() => {
    if (!isReady) return;
    
    // We bind it robustly with a slight delay if needed, or directly
    const player = playerRef.current?.getInternalPlayer?.();
    if (!player) return;

    try {
      if (!audioCtxRef.current) {
         const Ctx = window.AudioContext || (window as any).webkitAudioContext;
         if (!Ctx) return;
         audioCtxRef.current = new Ctx();
      }
      
      const ctx = audioCtxRef.current;
      
      // Resume if possible
      if (ctx.state === 'suspended') {
         ctx.resume().catch((e: any) => console.log('AudioContext wait for user gesture', e));
      }


      // 🔊 TRANSITION BRIDGE: Ensure MediaSession is primed for next track
      if (playedPercent >= 0.95) {
        if ('mediaSession' in navigator && navigator.mediaSession.playbackState !== 'playing') {
          navigator.mediaSession.playbackState = 'playing';
        }
      }

      // 🔊 MULTI-HEARTBEAT: Create an Indestructible 10s silent buffer + Pink Noise vibration
      if (ctx) {
        if (!oscillatorRef.current) {
          // 1. Silent PCM Buffer ( convincing enough for OS )
          const silentBuffer = ctx.createBuffer(1, ctx.sampleRate * 10, ctx.sampleRate);
          const silentSource = ctx.createBufferSource();
          silentSource.buffer = silentBuffer;
          silentSource.loop = true;
          
          const silentGain = ctx.createGain();
          silentGain.gain.value = 0.001; // -60dB (virtually silent)
          
          silentSource.connect(silentGain);
          silentGain.connect(ctx.destination);
          silentSource.start();
          (oscillatorRef as any).current = silentSource; // Reuse ref to track active heartbeat
          console.log("[JET-SYSTEM] 💓 Heartbeat Pulse Active");
        }

        // 2. Inaudible Sub-Bass Vibration ( keep hardware awake )
        // Fire bursts periodically, regardless of track state
        if (isPlaying) {
          const subBass = ctx.createOscillator();
          subBass.type = 'sine';
          subBass.frequency.setValueAtTime(1, ctx.currentTime);
          const subGain = ctx.createGain();
          subGain.gain.value = 0.001;
          subBass.connect(subGain);
          subGain.connect(ctx.destination);
          subBass.start();
          subBass.stop(ctx.currentTime + 5); // Short bursts to avoid driver suspension
        }
      }
      
      // Only create source node once per physical HTMLMediaElement
      if (attachedElementRef.current !== player) {
         if (sourceNodeRef.current) sourceNodeRef.current.disconnect();
         if (gainNodeRef.current) gainNodeRef.current.disconnect();
         
         sourceNodeRef.current = ctx.createMediaElementSource(player);
         gainNodeRef.current = ctx.createGain();
         gainNodeRef.current.gain.value = volumeBoost;
         
         // New: Create and add Analyser for Auto-Sync
         const analyser = ctx.createAnalyser();
         analyser.fftSize = 2048;
         analyserNodeRef.current = analyser;
         
         sourceNodeRef.current.connect(gainNodeRef.current);
         gainNodeRef.current.connect(analyser);
         analyser.connect(ctx.destination);
         
         attachedElementRef.current = player;
         console.log("[JET] Audio context effectively bound with Analyser! 🎛️📊");
      }
    } catch (e) {
      console.warn("Audio Context Binding Error: ", e);
    }
  }, [isReady]);

  // 🎨 Dynamic Color Extraction (runs on every track change)
  useEffect(() => {
    if (!currentTrack?.coverUrl) return;
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = currentTrack.coverUrl;
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 50;
        canvas.height = 50;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, 50, 50);
        const data = ctx.getImageData(0, 0, 50, 50).data;
        let rTotal = 0, gTotal = 0, bTotal = 0, count = 0;
        for (let i = 0; i < data.length; i += 16) {
          rTotal += data[i];
          gTotal += data[i + 1];
          bTotal += data[i + 2];
          count++;
        }
        const r = Math.round(rTotal / count);
        const g = Math.round(gTotal / count);
        const b = Math.round(bTotal / count);
        setDominantColor(`rgba(${r}, ${g}, ${b}, 1)`);
        console.log(`[JET] 🎨 Dominant color: rgb(${r},${g},${b})`);
      } catch (e) {
        console.warn('[JET] Color extraction failed (CORS?):', e);
        setDominantColor('rgba(30, 27, 75, 1)');
      }
    };
    img.onerror = () => {
      setDominantColor('rgba(30, 27, 75, 1)');
    };
  }, [currentTrack?.id]);

  // 🔍 Related Tracks (runs on every track change)
  useEffect(() => {
    if (!currentTrack?.id) return;
    fetch(`/api/related?id=${encodeURIComponent(currentTrack.id)}`)
      .then(res => res.json())
      .then(data => {
        if (data.results) setRelatedTracks(data.results.slice(0, 12));
        else setRelatedTracks([]);
      })
      .catch(() => setRelatedTracks([]));
  }, [currentTrack?.id]);


  // 📊 Visualizer Animation
  useEffect(() => {
    if (!isExpanded || !analyserNodeRef.current || !visualizerCanvasRef.current) return;

    const canvas = visualizerCanvasRef.current;
    const ctx = canvas.getContext('2d');
    const analyser = analyserNodeRef.current;
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationFrameRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const barWidth = (width / bufferLength) * 2.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * height;
        const opacity = isPlaying ? 0.3 + (dataArray[i] / 255) * 0.7 : 0.2;
        ctx.fillStyle = dominantColor.replace('1)', `${opacity})`);
        ctx.fillRect(x, height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
      }
    };

    draw();
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isExpanded, isPlaying, dominantColor]);
  useEffect(() => {
    if (currentTrack) {
      setupMediaSession({
        track: currentTrack,
        onPlay: () => resumeTrack(),
        onPause: () => pauseTrack(),
        onNext: () => playNext(),
        onPrev: () => playPrevious(),
        onSeekTo: (time) => { if (playerRef.current) playerRef.current.seekTo(time); },
        onSeekBackward: (skip) => { if (playerRef.current) playerRef.current.seekTo(Math.max(playedSeconds - skip, 0)); },
        onSeekForward: (skip) => { if (playerRef.current) playerRef.current.seekTo(Math.min(playedSeconds + skip, duration)); }
      });
    }
  }, [currentTrack?.id]);

  // ⏸️ Update MediaSession Playback State + Periodic Pulse
  useEffect(() => {
    updateMediaSessionState(isPlaying);
    
    let pulseInterval: any = null;
    if (isPlaying) {
      pulseInterval = setInterval(() => {
        if (document.visibilityState === 'hidden') {
          console.log("[JET-LOG] 🛡️ Periodic Heartbeat Pulse...");
          updateMediaSessionState(isPlaying);
        }
      }, 5000);
    }
    return () => { if (pulseInterval) clearInterval(pulseInterval); };
  }, [isPlaying]);

  // Update MediaSession position state
  useEffect(() => {
    updateMediaSessionPosition(playedSeconds, duration);
  }, [playedSeconds, duration]);

  const openPlayer = () => {
    setIsExpanded(true);
    window.history.pushState({ playerOpen: true }, '');
  };

  const closePlayer = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsExpanded(false);
    if (window.history.state?.playerOpen) {
      window.history.back();
    }
  };

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (isExpanded && !e.state?.playerOpen) {
         setIsExpanded(false);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isExpanded]);

  const handleProgress = (state: { played: number; playedSeconds: number }) => {
    if (!seeking) {
      setPlayedPercent(state.played);
      setPlayedSeconds(state.playedSeconds);
    }
    
    // Log stats at 50% completion
    if (state.played >= 0.5 && !statsLoggedRef.current && currentTrack) {
      statsLoggedRef.current = true;
      recordPlayStats(currentTrack.id);
      addToHistory(currentTrack);
    }

    // 🚀 Step G: Gapless Preload - Triggered earlier for app speed (at 65%)
    if (state.played >= 0.65 && !nextTrackPreloadedRef.current) {
        const nextIdx = (currentIndex + 1) % queue.length;
        const nextTrack = queue[nextIdx];
        if (nextTrack) {
            console.log("[JET-LOG] 🚀 Extacting direct URL early for gapless transition...");
            nextTrackPreloadedRef.current = true;
            const isYT = nextTrack.id.includes('youtube.com') || nextTrack.id.includes('youtu.be');
            
            if (isYT && (!urlCache[nextTrack.id] || urlCache[nextTrack.id].expiresAt < Date.now())) {
                fetch(`/api/stream?id=${encodeURIComponent(nextTrack.id)}&fmt=json`)
                   .then(async res => {
                       if (!res.ok) throw new Error(`Stream API failed: ${res.status}`);
                       return res.json();
                   })
                   .then(data => {
                        if (data.url) {
                            console.log("[JET-LOG] ⚡ Direct URL cached for next track (Early Preload)!");
                            setUrlCache(prev => ({ ...prev, [nextTrack.id]: { url: data.url, expiresAt: Date.now() + 2 * 60 * 60 * 1000 } }));
                       }
                   }).catch(e => console.warn('[JET-LOG] Failed to preload next track:', e.message));
            }
        }
    }
  };

  const handleDuration = (total: number) => {
    if (total && total > 0) setDuration(total);
  };

  const handleTrackEnded = () => {
    console.log("[JET-LOG] 🏁 Track Ended. Transitioning to next...");
    
    // 🛡️ Step H: Background Transition Guard
    if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'playing'; // Re-affirm even during gap
    }
    
    onTrackEnded();

    // Retry logic: If after 6 seconds the next track hasn't started (isReady is still false), kick it!
    if (playRetryTimeoutRef.current) clearTimeout(playRetryTimeoutRef.current);
    playRetryTimeoutRef.current = setTimeout(() => {
        if (!isReady && isPlaying) {
            console.log("[JET-LOG] 🔄 Next track transition stalled. Retrying...");
            resumeTrack(); 
        }
    }, 6000);
  };


  // ✅ NATIVE AUDIO ENGINE (Android only)
  // Sync playlist (current + next) to native ExoPlayer
  useEffect(() => {
    if (!isNativeDNA || !currentTrack) return;

    const fetchDirectUrl = async (track: any): Promise<string | null> => {
      try {
        const isYT = track.id?.includes('youtube.com') || track.id?.includes('youtu.be') || track.audioSrc?.includes('youtube');
        if (!isYT) return track.audioSrc || null;
        // Check cache first (respect 2hr expiry)
        const cached = urlCache[track.id];
        if (cached && cached.expiresAt > Date.now()) return cached.url;

        addDebugLog(`🔍 Fetching stream URL for ${track.title.substring(0, 15)}...`);
        const res = await fetch(`${SERVER_URL}/api/stream?id=${encodeURIComponent(track.id)}&fmt=json`);
        if (!res.ok) throw new Error(`API ${res.status}`);
        const data = await res.json();
        if (data.url) {
          setUrlCache(prev => ({ ...prev, [track.id]: { url: data.url, expiresAt: Date.now() + 2 * 60 * 60 * 1000 } }));
          addDebugLog(`✅ Stream URL acquired!`);
          return data.url;
        }
        return `${SERVER_URL}/api/stream?id=${encodeURIComponent(track.id)}`;
      } catch (e: any) {
        addDebugLog(`⚠️ URL fetch failed: ${e.message}`);
        return `${SERVER_URL}/api/stream?id=${encodeURIComponent(track.id)}`;
      }
    };

    const syncToExoPlayer = async () => {
      const currentUrl = await fetchDirectUrl(currentTrack);
      const nextIdx = (currentIndex + 1) % queue.length;
      const nextTrack = queue.length > 1 ? queue[nextIdx] : null;
      const nextUrl = nextTrack ? await fetchDirectUrl(nextTrack) : null;

      // ⚡ Pre-cache stream URLs for the next 5 tracks in the foreground
      if (queue.length > 2) {
        for (let i = 2; i <= 6; i++) {
          const aheadIdx = (currentIndex + i) % queue.length;
          const aheadTrack = queue[aheadIdx];
          if (aheadTrack && aheadTrack.id !== currentTrack.id) {
            // Fetch and cache without blocking the main transition
            fetchDirectUrl(aheadTrack).catch(() => {});
          }
        }
      }

      if (!currentUrl) {
        addDebugLog('❌ No URL for current track');
        return;
      }

      addDebugLog(`🎵 ExoPlayer Sync: ${currentTrack.title.substring(0, 15)}...`);

      NativeAudioPlayer.setPlaylist({
        current: {
          url: currentUrl,
          title: currentTrack.title,
          artist: currentTrack.artist,
          coverUrl: currentTrack.coverUrl || '',
        },
        next: (nextTrack && nextUrl) ? {
          url: nextUrl,
          title: nextTrack.title,
          artist: nextTrack.artist,
          coverUrl: nextTrack.coverUrl || '',
        } : undefined
      }).then(() => {
          addDebugLog(`✅ ExoPlayer Ready (Next: ${nextTrack?.title.substring(0, 10) || 'None'})`);
      }).catch((e: any) => {
          addDebugLog(`❌ ExoPlayer Error: ${e.message}`);
      });
    };

    syncToExoPlayer();
  }, [currentTrack?.id, isNativeDNA]);

  // Sync pause / resume with native ExoPlayer
  useEffect(() => {
    if (!isNativeDNA) return;
    if (isPlaying) {
      NativeAudioPlayer.resume().catch(() => {});
    } else {
      if (document.visibilityState === 'visible') {
        NativeAudioPlayer.pause().catch(() => {});
      } else {
        console.log("[JET-LOG] 🛡️ Blocked background pause to keep ExoPlayer alive.");
      }
    }
  }, [isPlaying, isNativeDNA]);

  // Listen for track-ended event from native ExoPlayer
  useEffect(() => {
    if (!isNativeDNA) return;
    let cleanup: (() => void) | null = null;
    NativeAudioPlayer.addListener('trackEnded', () => {
      handleTrackEnded();
    }).then(handle => { cleanup = () => handle.remove(); });
    return () => { if (cleanup) cleanup(); };
  }, [isNativeDNA]);

  // Poll native progress every second for UI updates
  useEffect(() => {
    if (!isNativeDNA) return;
    const timer = setInterval(async () => {
      try {
        const s = await NativeAudioPlayer.getStatus();
        setIsReady(s.ready);
        if (!s.ready) return;
        const posSec = s.currentPosition / 1000;
        const durSec = s.duration > 0 ? s.duration / 1000 : 0;
        setPlayedSeconds(posSec);
        if (durSec > 0) {
          setDuration(durSec);
          setPlayedPercent(posSec / durSec);
        }
      } catch { /* silent */ }
    }, 1000);
    return () => clearInterval(timer);
  }, [isNativeDNA]);

  // 🛡️ Legacy Foreground Service (web only - MusicService.java handles native)
  useEffect(() => {
    if (isNativeDNA || !currentTrack) return;

    // Web-only foreground service attempt (won't have real effect on web but keeps code path alive)
    const manageService = async () => {
      try {
        if (isPlaying) {
          const check = await ForegroundService.checkPermissions();
          if (check.display !== 'granted') await ForegroundService.requestPermissions();
          await ForegroundService.createNotificationChannel({
            id: 'jet_music_media',
            name: 'Jet Music Playback',
            description: 'Controls for background music playback',
            importance: Importance.Max,
          });
          await ForegroundService.startForegroundService({
            id: 1001,
            title: currentTrack.title,
            body: currentTrack.artist,
            smallIcon: 'ic_stat_music',
            largeIcon: currentTrack.coverUrl,
            notificationChannelId: 'jet_music_media',
            buttons: [
              { id: 1, title: 'Previous' },
              { id: 2, title: isPlaying ? 'Pause' : 'Play' },
              { id: 3, title: 'Next' }
            ]
          } as any);
        } else {
          setTimeout(async () => {
            await ForegroundService.stopForegroundService().catch(() => {});
          }, 5000);
        }
      } catch (e) {
        console.error('ForegroundService error:', e);
      }
    };
    manageService();
  }, [isPlaying, currentTrack?.id, isNativeDNA]);

  // Wake Lock: prevent screen from sleeping while playing
  useEffect(() => {
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        }
      } catch (err) {}
    };
    if (isPlaying) requestWakeLock();
    else if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(() => {});
      wakeLockRef.current = null;
    }
  }, [isPlaying]);

  // Re-acquire wake lock + resume audio on tab/app return
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && isPlaying) {
        if ('wakeLock' in navigator && !wakeLockRef.current) {
          try { wakeLockRef.current = await (navigator as any).wakeLock.request('screen'); } catch (e) {}
        }
        // Resume main player if paused by OS
        if (playerRef.current && isPlaying) {
          const ip = playerRef.current.getInternalPlayer?.();
          if (ip) {
            if (typeof ip.play === 'function') ip.play().catch(() => {});
            else if (typeof ip.playVideo === 'function') ip.playVideo();
          }
        }
      }
    };
    
    // 🛡️ Added: Protection against browser aggressive cleanup
    const handleKeepAlive = () => {
      if (isPlaying && playerRef.current) {
        console.log("[JET-LOG] 🛡️ PageHide/Unload detected - Re-affirming playback...");
        // Re-affirm to OS that we are still playing
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handleKeepAlive);
    window.addEventListener('beforeunload', handleKeepAlive);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handleKeepAlive);
      window.removeEventListener('beforeunload', handleKeepAlive);
    };
  }, [isPlaying]);

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setPlayedPercent(val);
    setPlayedSeconds(duration * val);
  };

  const handleSeekMouseUp = (e: React.MouseEvent<HTMLInputElement> | React.TouchEvent<HTMLInputElement>) => {
    setSeeking(false);
    if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
      playerRef.current.seekTo(parseFloat((e.target as HTMLInputElement).value));
    }
  };

  const togglePlay = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (isPlaying) pauseTrack();
    else resumeTrack();
  };

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mm = Math.floor(seconds / 60);
    const ss = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${mm}:${ss}`;
  };

  const repeatIcon = repeatMode === 'one'
    ? <Repeat1 size={22} color="#818cf8" />
    : repeatMode === 'all'
    ? <Repeat size={22} color="#818cf8" />
    : <Repeat size={22} color="rgba(255,255,255,0.7)" />;

  if (!currentTrack) {
    return (
      <div className={styles.miniPlayer} style={{ opacity: 0.8, pointerEvents: 'none' }}>
        <div className={styles.miniTrackInfo}>
          <div className={styles.miniCover} style={{ background: '#222' }} />
          <div className={styles.miniText}>
            <div className={styles.miniTitle} style={{ color: 'rgba(255,255,255,0.5)' }}>ยังไม่มีเพลงที่เล่น</div>
            <div className={styles.miniArtist} style={{ color: 'rgba(255,255,255,0.3)' }}>เลือกเพลงเพื่อเริ่มฟัง</div>
          </div>
        </div>
        <div className={styles.miniControls}>
          <button className={styles.miniBtn} disabled>
            <Play size={28} color="rgba(255,255,255,0.2)" />
          </button>
        </div>
        <div className={styles.miniProgressBar}>
          <div className={styles.miniProgressFill} style={{ width: '0%' }} />
        </div>
      </div>
    );
  }

  const liked = isLiked(currentTrack.id);

  // Preload next track
  let nextTrack = null;
  if (!shuffle && queue.length > 1) {
    let nextIdx = currentIndex + 1;
    if (nextIdx >= queue.length && repeatMode === 'all') nextIdx = 0;
    if (nextIdx < queue.length) nextTrack = queue[nextIdx];
  }
  const nextAudioSrc = nextTrack 
    ? (nextTrack.id.includes('youtube') || nextTrack.id.includes('youtu.be')
        ? `/api/stream?id=${encodeURIComponent(nextTrack.id)}`
        : nextTrack.audioSrc)
    : '';

  return (
    <>
      {/* Preload next track */}
      {/* Step G: Hidden Next Track Preloader (Keeps network warm) */}
      {(() => {
          const nextIdx = (currentIndex + 1) % queue.length;
          const nextTrack = queue[nextIdx];
          if (nextTrack && nextTrackPreloadedRef.current) {
              const isYT = nextTrack.id.includes('youtube.com') || nextTrack.id.includes('youtu.be');
              const nextUrl = isYT ? `/api/stream?id=${encodeURIComponent(nextTrack.id)}` : nextTrack.audioSrc;
              return <audio preload="auto" src={nextUrl} style={{ display: 'none' }} />;
          }
          return null;
      })()}

      {/* 🛡️ Silent Keep-Alive Audio Loop (Moved to top level so it runs in expanded, minimized, and background modes) */}
      <audio src="/silent.mp3" autoPlay loop style={{ display: 'none' }} />

      {/* Main ReactPlayer - Using Full-screen invisible container for better background priority */}
      {!isNativeDNA && (
        <div style={{ 
          position: 'fixed', 
          inset: 0, 
          zIndex: -5,
          background: '#000',
          pointerEvents: 'none'
        }}>
          <div style={{ position: 'absolute', inset: 0, opacity: 0.001 }}>
            <ReactPlayer
              ref={playerRef}
              url={finalAudioSrc}
              playing={isPlaying}
              volume={1}
              onProgress={handleProgress}
              onDuration={handleDuration}
              onReady={() => {
                setIsReady(true);
                if (playRetryTimeoutRef.current) clearTimeout(playRetryTimeoutRef.current);
              }}
              onBuffer={() => setIsReady(false)}
              onBufferEnd={() => setIsReady(true)}
              onEnded={() => handleTrackEnded()}
              onError={(e: any) => {
                console.log("[JET] Player error:", e);
                if (isYouTube && !proxyFailed) {
                   console.log("[JET] Proxy failed, falling back to direct YouTube source...");
                   setProxyFailed(true);
                } else {
                   // Final resort: skip to next
                   setTimeout(() => playNext(), 3000);
                }
              }}
              config={{
                file: {
                  forceAudio: true,
                  attributes: {
                    playsInline: true,
                    controlsList: 'nodownload',
                    preload: 'auto',
                    crossOrigin: 'anonymous'
                  }
                }
              }}
            />
          </div>
        </div>
      )}

      {isExpanded ? (
        <div className={styles.fullScreenPlayer} style={{ background: `linear-gradient(180deg, ${dominantColor} 0%, rgba(0,0,0,0.95) 40%, #050505 100%)`, transition: 'background 1.5s ease' }}>
          <div className={styles.fullScreenHeader}>
            <button onClick={closePlayer} className={styles.controlButton}>
              <ChevronDown size={32} />
            </button>
             <span className={styles.playingLabel} onClick={toggleDebugOverlay} style={{ cursor: 'pointer' }}>
               JET STREAM • {isReady ? 'คุณภาพสูง' : 'กำลังบุฟเฟอร์...'} 🛠️
             </span>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6 }}>
              <button className={styles.controlButton} onClick={() => setShowVolumeSlider(!showVolumeSlider)}>
                <Volume2 size={24} color={volumeBoost > 1.0 ? '#ff4d4d' : 'white'} />
              </button>
              
              {showVolumeSlider && (
                <div className={styles.volumePopover}>
                  <div className={styles.volumePopoverHeader}>
                    <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', fontWeight: 'bold' }}>บูสเสียง</span>
                    <button className={styles.volumePopoverClose} onClick={() => setShowVolumeSlider(false)}>
                      <X size={16} />
                    </button>
                  </div>
                  <input
                    type="range"
                    min="1" max="3" step="0.1"
                    value={volumeBoost}
                    onChange={(e) => {
                       setVolumeBoost(parseFloat(e.target.value));
                       if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
                          audioCtxRef.current.resume().catch(() => {});
                       }
                    }}
                    onTouchStart={() => {
                       if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
                          audioCtxRef.current.resume().catch(() => {});
                       }
                    }}
                    onMouseDown={() => {
                       if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
                          audioCtxRef.current.resume().catch(() => {});
                       }
                    }}
                    className={`${styles.volumeScrubber} ${volumeBoost > 1.0 ? styles.boosted : ''}`}
                    style={{ margin: '14px 0' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
                    <span>1.0x</span>
                    <span style={{ color: volumeBoost > 1.0 ? '#ff4d4d' : 'white', fontWeight: 'bold', fontSize: '0.85rem' }}>{volumeBoost.toFixed(1)}x</span>
                    <span>3.0x</span>
                  </div>
                </div>
              )}

              <button className={`${styles.controlButton} ${showLyrics ? styles.activeText : ''}`} onClick={() => setShowLyrics(!showLyrics)}>
                <Mic size={24} color={showLyrics ? '#C6A0FF' : 'white'} />
              </button>

              <button className={styles.controlButton} onClick={handleStartRadio}>
                <Radio size={24} color="white" />
              </button>

              <button className={styles.controlButton} onClick={() => setShowQueue(!showQueue)}>
                <ListMusic size={24} color={showQueue ? '#C6A0FF' : 'white'} />
              </button>
            </div>
          </div>
          <div className={styles.fullScreenCoverWrapper}>
            {!isReady && <div className={styles.loaderOverlay}><Loader2 size={64} className={styles.spin} /></div>}
            <div className={styles.coverWrapper}>
              {/* Visualizer Canvas behind cover */}
              <canvas 
                ref={visualizerCanvasRef} 
                className={styles.visualizerCanvas}
                width={800}
                height={400}
              />
              <img 
                src={currentTrack.coverUrl} 
                className={`${styles.fullScreenCover} ${isPlaying ? styles.coverPlaying : ''}`} 
                alt="" 
              />
            </div>
            
            {showLyrics && (
              <div className={styles.lyricsContainer}>
                {lyricsData.isLoading ? (
                  <Loader2 size={48} className={styles.spin} style={{ color: 'rgba(255,255,255,0.7)', margin: 'auto' }} />
                ) : lyricsData.error ? (
                  <p style={{ color: 'rgba(255,255,255,0.5)', margin: 'auto', textAlign: 'center' }}>{lyricsData.error}</p>
                ) : lyricsData.parsedLines && lyricsData.parsedLines.length > 0 ? (
                  <div className={styles.lyricsText}>
                    {lyricsData.parsedLines.map((line, idx) => (
                       <p 
                          key={idx}
                          ref={idx === activeLyricIndex ? activeLyricRef : null}
                          className={`${idx === activeLyricIndex ? styles.activeLyricLine : styles.lyricLine} ${pressingLineIndex === idx ? styles.pressing : ''}`}
                          onContextMenu={(e) => e.preventDefault()}
                          onPointerDown={() => {
                             isLongPressingRef.current = false;
                             setPressingLineIndex(idx);
                             longPressTimerRef.current = setTimeout(() => {
                                isLongPressingRef.current = true;
                                handleManualSync(line.time, idx);
                                setPressingLineIndex(null);
                             }, 500);
                          }}
                          onPointerUp={(e) => {
                             if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
                             setPressingLineIndex(null);
                             if (!isLongPressingRef.current) {
                                if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
                                   playerRef.current.seekTo(line.time);
                                }
                             }
                             isLongPressingRef.current = false;
                          }}
                          onPointerCancel={() => {
                             if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
                             setPressingLineIndex(null);
                          }}
                       >
                          {line.text}
                       </p>
                    ))}
                  </div>
                ) : (
                  <div className={styles.lyricsText}>
                    <p style={{ color: '#ff4d4d', fontSize: '0.9rem', marginBottom: '20px', fontWeight: 'bold' }}>⚠️ ไม่มีข้อมูลคาราโอเกะสำหรับเพลงนี้ (แสดงเนื้อเพลงดั้งเดิม)</p>
                    <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }}>{lyricsData.plainLyrics}</pre>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className={styles.fullScreenDetails}>
            <div className={styles.titleRow}>
              <div className={styles.titleText}>
                <h2 className={styles.fullScreenTitle}>{currentTrack.title}</h2>
                <p className={styles.fullScreenArtist}>{currentTrack.artist}</p>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <button
                  className={styles.secondaryControl}
                  onClick={() => setShowShareModal(true)}
                  style={{ padding: 0, margin: 0, height: 28, background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  <Share2 size={24} color="rgba(255,255,255,0.7)" />
                </button>
                <button
                  key={isHeartPopping ? `pop-${currentTrack.id}` : `idle-${currentTrack.id}`}
                  className={`${styles.heartBtn} ${isHeartPopping ? styles.heartPop : ''}`}
                  onClick={handleToggleLike}
                  style={{ color: liked ? '#ff4d4d' : 'rgba(255,255,255,0.6)' }}
                >
                  <Heart size={28} fill={liked ? '#ff4d4d' : 'none'} stroke={liked ? '#ff4d4d' : 'currentColor'} />
                </button>
                <button
                  className={styles.secondaryControl}
                  onClick={() => {
                    if (!user) { showToast('กรุณาเข้าสู่ระบบก่อนครับ', 'error'); return; }
                    setShowPlaylistModal(true);
                  }}
                  style={{ padding: 0 }}
                >
                  <Plus size={28} />
                </button>
              </div>
            </div>
          </div>

          <div className={styles.scrubberContainer}>
            <input
              type="range" min={0} max={1} step="any"
              value={playedPercent}
              onMouseDown={() => setSeeking(true)}
              onChange={handleSeekChange}
              onMouseUp={handleSeekMouseUp as any}
              onTouchStart={() => setSeeking(true)}
              onTouchEnd={handleSeekMouseUp as any}
              className={styles.scrubber}
            />
            <div className={styles.timeLabels}>
              <span>{formatTime(playedSeconds)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          <div className={styles.fullScreenControls}>
            <button
              className={`${styles.secondaryControl} ${shuffle ? styles.active : ''}`}
              onClick={toggleShuffle}
            >
              <Shuffle size={22} />
            </button>

            <button onClick={() => playPrevious()} className={styles.secondaryControl}>
              <SkipBack size={32} fill="currentColor" />
            </button>

            <button onClick={togglePlay} className={`${styles.playPauseBtn} ${isPlaying ? styles.isPlaying : ''}`}>
              {isPlaying ? <Pause size={38} fill="currentColor" /> : <Play size={38} fill="currentColor" style={{ marginLeft: 4 }} />}
            </button>

            <button onClick={() => playNext()} className={styles.secondaryControl}>
              <SkipForward size={32} fill="currentColor" />
            </button>

            <button
              className={`${styles.secondaryControl} ${repeatMode !== 'off' ? styles.active : ''}`}
              onClick={toggleRepeat}
            >
              {repeatIcon}
            </button>
          </div>

          {/* 🔍 Related Songs Section */}
          {relatedTracks.length > 0 && (
            <div className={styles.relatedSection}>
              <h3 className={styles.relatedTitle}>ที่คุณอาจจะชอบ</h3>
              <div className={styles.relatedScroll}>
                {relatedTracks.map((track) => (
                  <div key={track.id} className={styles.relatedItem} onClick={() => playTrack(track, [track, ...relatedTracks])}>
                    <img src={track.coverUrl} alt="" className={styles.relatedCover} />
                    <div className={styles.relatedText}>
                      <span className={styles.relatedName}>{track.title}</span>
                      <span className={styles.relatedArtist}>{track.artist}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : isMinimized ? (
        <button className={styles.fabPlayer} onClick={() => setIsMinimized(false)}>
          <img src={currentTrack.coverUrl} className={`${styles.fabCover} ${isPlaying ? styles.spinSlow : ''}`} alt="" />
          <div className={styles.fabIconOverlay}>
            {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" style={{ marginLeft: 2 }} />}
          </div>
        </button>
      ) : (
        <div className={styles.miniPlayer} onClick={openPlayer}>
          <div className={styles.miniTrackInfo}>
            <img src={currentTrack.coverUrl} className={styles.miniCover} alt="" />
            <div className={styles.miniText}>
              <div className={styles.miniTitle}>{currentTrack.title}</div>
              <div className={styles.miniArtist}>{currentTrack.artist}</div>
            </div>
          </div>
          
          <div className={styles.miniControls}>
            {!isReady && <Loader2 size={24} className={styles.spin} style={{ marginRight: 10 }} />}
             <button onClick={(e) => { e.stopPropagation(); playPrevious(); }} className={styles.miniBtn}>
              <SkipBack size={24} fill="currentColor" />
            </button>
            <button onClick={togglePlay} className={styles.miniBtn}>
              {isPlaying ? <Pause size={34} fill="white" /> : <Play size={34} fill="white" style={{ marginLeft: 2 }} />}
            </button>
            <button onClick={(e) => { e.stopPropagation(); playNext(); }} className={styles.miniBtn}>
              <SkipForward size={24} fill="currentColor" />
            </button>
          </div>
          <div className={styles.miniProgressBar}>
            <div className={styles.miniProgressFill} style={{ width: `${playedPercent * 100}%` }} />
          </div>
        </div>
      )}

      {/* QUEUE MODAL */}
      {showQueue && (
        <div className={styles.modalOverlay} onClick={() => setShowQueue(false)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div className={styles.modalTitle}>
              คิวเพลงปัจจุบัน
              <button className={styles.closeModalBtn} onClick={() => setShowQueue(false)}><X size={24} /></button>
            </div>
            <div className={styles.queueList}>
              {queue.map((track, idx) => (
                <div 
                  key={`${track.id}-${idx}`} 
                  className={`${styles.queueItem} ${idx === currentIndex ? styles.activeQueueItem : ''}`}
                  onClick={() => {
                    playTrack(track, queue);
                    setShowQueue(false);
                  }}
                >
                  <img src={track.coverUrl} className={styles.queueCover} alt="" />
                  <div className={styles.queueInfo}>
                    <div className={styles.queueName}>{track.title}</div>
                    <div className={styles.queueArtist}>{track.artist}</div>
                  </div>
                  {idx === currentIndex && isPlaying && <div className={styles.queuePlaying}><Play size={14} fill="currentColor" /></div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SHARE MODAL */}
      {showShareModal && (
        <ShareStoryModal 
          track={currentTrack} 
          activeLyricText={lyricsData.parsedLines?.[activeLyricIndex]?.text || ''} 
          onClose={() => setShowShareModal(false)} 
        />
      )}

      {/* PLAYLIST MODAL */}
      {showPlaylistModal && (
        <div className={styles.modalOverlay} onClick={() => setShowPlaylistModal(false)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div className={styles.modalTitle}>
              เพิ่มลงเพลย์ลิสต์
              <button className={styles.closeModalBtn} onClick={() => setShowPlaylistModal(false)}><X size={24} /></button>
            </div>
            <div style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: 16 }}>
              {playlists.length > 0 ? playlists.map(pl => {
                const isAdded = pl.tracks.some(t => t.id === currentTrack.id);
                return (
                  <div
                    key={pl.id}
                    className={styles.playlistItem}
                    onClick={() => {
                      if (!isAdded) {
                        addTrack(pl.id, currentTrack);
                        showToast(`เพิ่มลง ${pl.name} แล้ว`, 'success');
                        setShowPlaylistModal(false);
                      }
                    }}
                    style={{ opacity: isAdded ? 0.5 : 1, cursor: isAdded ? 'default' : 'pointer' }}
                  >
                    <span style={{ color: 'white', fontWeight: 600 }}>{pl.name}</span>
                    <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>
                      {isAdded ? 'เพิ่มแล้ว' : pl.tracks.length + ' เพลง'}
                    </span>
                  </div>
                );
              }) : (
                <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)', padding: '20px 0' }}>ไม่พบเพลย์ลิสต์</div>
              )}
            </div>
            <form
              className={styles.createPlaylistForm}
              onSubmit={(e) => {
                e.preventDefault();
                if (newPlaylistName.trim()) {
                  createPlaylist(newPlaylistName.trim());
                  showToast(`สร้างเพลย์ลิสต์ "${newPlaylistName}" สำเร็จ`, 'success');
                  setNewPlaylistName('');
                }
              }}
            >
              <input
                type="text"
                placeholder="ชื่อเพลย์ลิสต์ใหม่..."
                className={styles.createInput}
                value={newPlaylistName}
                onChange={e => setNewPlaylistName(e.target.value)}
              />
              <button type="submit" className={styles.createBtn}><Plus size={20} /></button>
            </form>
          </div>
        </div>
      )}
      {/* DEBUG OVERLAY */}
      {showDebugOverlay && (
        <div style={{
          position: 'fixed',
          top: '12%',
          left: '5%',
          right: '5%',
          bottom: '12%',
          background: 'rgba(0,0,0,0.96)',
          color: '#39ff14',
          fontFamily: 'monospace',
          padding: '16px',
          borderRadius: '12px',
          border: '2px solid #39ff14',
          zIndex: 99999,
          overflowY: 'auto',
          fontSize: '0.8rem',
          boxShadow: '0 0 20px rgba(57, 255, 20, 0.4)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', borderBottom: '1px solid #39ff14', paddingBottom: '6px' }}>
            <strong style={{ textShadow: '0 0 5px rgba(57, 255, 20, 0.8)' }}>JET SYSTEM LOGS (V4.4)</strong>
            <button onClick={() => setShowDebugOverlay(false)} style={{ color: '#39ff14', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>[X] CLOSE</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {debugLogList.length === 0 ? (
              <div>No logs recorded yet. Tap some items to play!</div>
            ) : (
              debugLogList.map((log, i) => <div key={i} style={{ wordBreak: 'break-all' }}>{log}</div>)
            )}
          </div>
          <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
            <button onClick={() => { localStorage.removeItem('jet_debug_logs'); setDebugLogList([]); }} style={{ color: '#ff4d4d', background: 'transparent', border: '1px solid #ff4d4d', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem' }}>CLEAR LOGS</button>
            <button onClick={() => {
              if (typeof window !== 'undefined') {
                const logs = JSON.parse(localStorage.getItem('jet_debug_logs') || '[]');
                setDebugLogList(logs);
              }
            }} style={{ color: '#39ff14', background: 'transparent', border: '1px solid #39ff14', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem' }}>REFRESH</button>
          </div>
        </div>
      )}
    </>
  );
}
