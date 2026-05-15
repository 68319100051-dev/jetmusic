'use client';
import { useRef, useEffect, useState } from 'react';
import {
  Play, Pause, SkipForward, SkipBack, ChevronDown, Heart,
  ListMusic, Loader2, X, Plus, Shuffle, Repeat, Repeat1, Volume2
} from 'lucide-react';
import { usePlayer } from '../contexts/PlayerContext';
import { useAuth } from '../contexts/AuthContext';
import { usePlaylist } from '../contexts/PlaylistContext';
import { useToast } from '../contexts/ToastContext';
import styles from './Player.module.css';
import dynamic from 'next/dynamic';

const ReactPlayer = dynamic(() => import('react-player'), { ssr: false });

export default function Player() {
  const {
    currentTrack, isPlaying, pauseTrack, resumeTrack,
    playNext, playPrevious, toggleShuffle, toggleRepeat,
    shuffle, repeatMode, onTrackEnded, queue, currentIndex
  } = usePlayer();
  const { showToast } = useToast();
  
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  
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
  
  const { user } = useAuth();
  const { playlists, createPlaylist, addTrack, toggleLike, isLiked } = usePlaylist();
  
  const [isHeartPopping, setIsHeartPopping] = useState(false);

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
  const silentAudioRef = useRef<HTMLAudioElement | null>(null);
  const wakeLockRef = useRef<any>(null);

  // Booster Refs
  const audioCtxRef = useRef<any>(null);
  const gainNodeRef = useRef<any>(null);
  const sourceNodeRef = useRef<any>(null);
  const attachedElementRef = useRef<HTMLMediaElement | null>(null);

  // Silent track to keep PWA alive in background
  const SILENT_TRACK = "data:audio/wav;base64,UklGRigAAABXQVZFRm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==";

  useEffect(() => {
    if (currentTrack) {
      if (isFirstLoad.current) {
        isFirstLoad.current = false;
        return;
      }
      setIsExpanded(true);
      setIsMinimized(false);
      setPlayedSeconds(0);
      setPlayedPercent(0);
      setIsReady(false);
    }
  }, [currentTrack?.id]);

  // Apply Volume Boost via Web Audio API
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('jet_v2_volume_boost', volumeBoost.toString());
    }
    
    const applyAudioBoost = () => {
      if (volumeBoost <= 1.0 && !gainNodeRef.current) return;
      
      const player = playerRef.current?.getInternalPlayer();
      if (!player || !(player instanceof HTMLMediaElement)) return;
      
      if (!player.crossOrigin && !player.src.startsWith('blob:')) {
         player.crossOrigin = 'anonymous';
      }

      try {
        if (!audioCtxRef.current) {
          const Ctx = window.AudioContext || (window as any).webkitAudioContext;
          if (!Ctx) return;
          audioCtxRef.current = new Ctx();
        }
        
        if (audioCtxRef.current.state === 'suspended') {
           audioCtxRef.current.resume();
        }

        if (attachedElementRef.current !== player) {
          if (gainNodeRef.current) gainNodeRef.current.disconnect();
          sourceNodeRef.current = audioCtxRef.current.createMediaElementSource(player);
          gainNodeRef.current = audioCtxRef.current.createGain();
          sourceNodeRef.current.connect(gainNodeRef.current);
          gainNodeRef.current.connect(audioCtxRef.current.destination);
          attachedElementRef.current = player;
        }
        
        if (gainNodeRef.current) {
          gainNodeRef.current.gain.value = volumeBoost;
        }
      } catch (e) {
         console.warn("Audio boost blocked by browser or CORS policy", e);
      }
    };
    
    applyAudioBoost();
  }, [volumeBoost, currentTrack, isPlaying]);

  // MediaSession API
  useEffect(() => {
    if (currentTrack && 'mediaSession' in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: currentTrack.title,
          artist: currentTrack.artist,
          album: 'Jet Music Premium',
          artwork: currentTrack.coverUrl
            ? [{ src: currentTrack.coverUrl, sizes: '300x300', type: 'image/jpeg' },
               { src: currentTrack.coverUrl, sizes: '512x512', type: 'image/jpeg' }]
            : []
        });

        navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';

        navigator.mediaSession.setActionHandler('play', () => resumeTrack());
        navigator.mediaSession.setActionHandler('pause', () => pauseTrack());
        navigator.mediaSession.setActionHandler('nexttrack', () => playNext());
        navigator.mediaSession.setActionHandler('previoustrack', () => playPrevious());
        
        navigator.mediaSession.setActionHandler('seekto', (details) => {
          if (details.seekTime !== undefined && playerRef.current) {
            playerRef.current.seekTo(details.seekTime);
          }
        });
        
        navigator.mediaSession.setActionHandler('seekbackward', (details) => {
          const skipTime = details.seekOffset || 10;
          if (playerRef.current) playerRef.current.seekTo(Math.max(playedSeconds - skipTime, 0));
        });
        
        navigator.mediaSession.setActionHandler('seekforward', (details) => {
          const skipTime = details.seekOffset || 10;
          if (playerRef.current) playerRef.current.seekTo(Math.min(playedSeconds + skipTime, duration));
        });

      } catch (e) {
        console.error("MediaSession error:", e);
      }
    }
  }, [currentTrack?.id, isPlaying, resumeTrack, pauseTrack, playNext, playPrevious, playedSeconds, duration]);

  // Update MediaSession position state
  useEffect(() => {
    if ('mediaSession' in navigator && duration > 0) {
      try {
        navigator.mediaSession.setPositionState({
          duration,
          playbackRate: 1,
          position: playedSeconds
        });
      } catch (e) {}
    }
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
  };

  const handleDuration = (total: number) => {
    if (total && total > 0) setDuration(total);
  };

  // Silent Audio: keep audio session alive in background
  useEffect(() => {
    const silent = silentAudioRef.current;
    if (!silent) return;
    if (isPlaying) {
      silent.play().catch(() => {});
    } else {
      silent.pause();
    }
  }, [isPlaying]);

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
        if (playerRef.current) {
          const ip = playerRef.current.getInternalPlayer?.();
          if (ip) {
            if (typeof ip.play === 'function') ip.play().catch(() => {});
            else if (typeof ip.playVideo === 'function') ip.playVideo();
          }
        }
        // Also resume silent track
        if (silentAudioRef.current?.paused) silentAudioRef.current.play().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
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
  const isYouTube = currentTrack?.id.includes('youtube.com') || currentTrack?.id.includes('youtu.be');
  const finalAudioSrc = isYouTube 
    ? `/api/stream?id=${encodeURIComponent(currentTrack.id)}` 
    : (currentTrack.audioSrc || '');

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
      {/* Silent audio to keep PWA audio session alive */}
      <audio 
        ref={silentAudioRef} 
        src={SILENT_TRACK} 
        loop 
        playsInline 
        style={{ display: 'none' }} 
      />

      {/* Preload next track */}
      {nextAudioSrc && (
        <audio preload="auto" src={nextAudioSrc} style={{ display: 'none' }} />
      )}

      {/* Main ReactPlayer */}
      <div style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <ReactPlayer
          ref={playerRef}
          url={finalAudioSrc}
          playing={isPlaying}
          volume={1}
          onProgress={handleProgress}
          onDuration={handleDuration}
          onReady={() => setIsReady(true)}
          onBuffer={() => setIsReady(false)}
          onBufferEnd={() => setIsReady(true)}
          onEnded={() => onTrackEnded()}
          onError={(e: any) => console.log("[JET] Player error:", e)}
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

      {isExpanded ? (
        <div className={styles.fullScreenPlayer}>
          <div className={styles.fullScreenHeader}>
            <button onClick={closePlayer} className={styles.controlButton}>
              <ChevronDown size={32} />
            </button>
            <span className={styles.playingLabel}>JET STREAM • {isReady ? 'คุณภาพสูง' : 'กำลังบุฟเฟอร์...'}</span>
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
                    onChange={(e) => setVolumeBoost(parseFloat(e.target.value))}
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

              <button className={styles.controlButton}>
                <ListMusic size={24} />
              </button>
            </div>
          </div>
          <div className={styles.fullScreenCoverWrapper}>
            {!isReady && <div className={styles.loaderOverlay}><Loader2 size={64} className={styles.spin} /></div>}
            <img src={currentTrack.coverUrl} alt={currentTrack.title} className={`${styles.fullScreenCover} ${!isReady ? styles.dimmed : ''}`} />
          </div>

          <div className={styles.fullScreenDetails}>
            <div className={styles.titleRow}>
              <div>
                <h2 className={styles.fullScreenTitle}>{currentTrack.title}</h2>
                <p className={styles.fullScreenArtist}>{currentTrack.artist}</p>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
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
            <button
              key={isHeartPopping ? `pop-mini-${currentTrack.id}` : `idle-mini-${currentTrack.id}`}
              className={`${styles.miniHeartBtn} ${isHeartPopping ? styles.heartPop : ''} ${liked ? styles.liked : ''}`}
              onClick={(e) => { e.stopPropagation(); handleToggleLike(); }}
              style={{ color: liked ? '#ff4d4d' : 'rgba(255,255,255,0.4)', marginLeft: 'auto', marginRight: 10, background: 'none', border: 'none', cursor: 'pointer', padding: 8 }}
            >
              <Heart size={20} fill={liked ? '#ff4d4d' : 'none'} stroke={liked ? '#ff4d4d' : 'currentColor'} />
            </button>
          </div>
          <div className={styles.miniControls}>
            {!isReady && <Loader2 size={24} className={styles.spin} style={{ marginRight: 10 }} />}
            <button onClick={(e) => { e.stopPropagation(); playPrevious(); }} className={styles.miniBtn}>
              <SkipBack size={22} fill="currentColor" />
            </button>
            <button onClick={togglePlay} className={styles.miniBtn}>
              {isPlaying ? <Pause size={28} fill="white" /> : <Play size={28} fill="white" style={{ marginLeft: 2 }} />}
            </button>
            <button onClick={(e) => { e.stopPropagation(); playNext(); }} className={styles.miniBtn}>
              <SkipForward size={22} fill="currentColor" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setIsMinimized(true); }}
              className={styles.miniBtn}
            >
              <ChevronDown size={24} />
            </button>
          </div>
          <div className={styles.miniProgressBar}>
            <div className={styles.miniProgressFill} style={{ width: `${playedPercent * 100}%` }} />
          </div>
        </div>
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
    </>
  );
}
