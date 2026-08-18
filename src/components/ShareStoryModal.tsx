import React, { useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { X, Share2, Download, Music2, Loader2 } from 'lucide-react';
import styles from './ShareStoryModal.module.css';

interface ShareStoryModalProps {
  track: any;
  activeLyricText: string;
  onClose: () => void;
}

export default function ShareStoryModal({ track, activeLyricText, onClose }: ShareStoryModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const generateImage = async (): Promise<string | null> => {
    if (!cardRef.current) return null;
    try {
      // Use pixelRatio: 3 for high-res output fit for IG Story (e.g. 1080x1920)
      const dataUrl = await toPng(cardRef.current, { 
        cacheBust: true, 
        pixelRatio: 3, 
        quality: 1.0,
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left',
          borderRadius: '0px' // Remove border radius for the export to fill edge-to-edge if needed, though rounded looks nice too
        }
      });
      return dataUrl;
    } catch (err) {
      console.error('Failed to generate image', err);
      return null;
    }
  };

  const handleShare = async () => {
    setIsGenerating(true);
    const dataUrl = await generateImage();
    setIsGenerating(false);
    
    if (!dataUrl) {
      alert("เกิดข้อผิดพลาดในการสร้างรูปภาพครับ");
      return;
    }

    try {
      // Convert Data URL to Blob
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const file = new File([blob], 'jet-music-story.png', { type: 'image/png' });

      // check if Web Share API is supported and can share files
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'ฟังเพลง ' + track.title + ' บน Jet Music',
        });
      } else {
        // Fallback: trigger download
        handleDownload(dataUrl);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
         console.error('Share failed', err);
         handleDownload(dataUrl);
      }
    }
  };

  const handleDownload = (dataUrl?: string) => {
    const triggerDownload = async () => {
       setIsGenerating(true);
       const url = dataUrl || await generateImage();
       setIsGenerating(false);
       
       if (url) {
         const link = document.createElement('a');
         link.download = `JET-Story-${track.title.replace(/\s+/g, '-').slice(0, 20)}.png`;
         link.href = url;
         link.click();
       }
    };
    triggerDownload();
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalHeader}>
        <h2 className={styles.modalTitle}><Share2 size={20} /> Share to Story</h2>
        <button onClick={onClose} className={styles.closeBtn}><X size={24} /></button>
      </div>

      {/* The 9:16 Card representing the Story */}
      <div className={styles.captureFrame} ref={cardRef}>
        <div 
          className={styles.storyBackground} 
          style={{ backgroundImage: `url(${track.coverUrl})` }}
        />
        <div className={styles.storyContent}>
          <div className={styles.branding}>
            <Music2 size={18} color="white" />
            <p className={styles.brandText}>JET MUSIC</p>
          </div>

          {activeLyricText ? (
            <>
              {/* Lyrics Layout */}
              <div className={styles.lyricContainer}>
                 <p className={styles.lyricText}>"{activeLyricText}"</p>
              </div>
              
              <div className={styles.badgeContainer}>
                <img src={track.coverUrl} alt="Cover" className={styles.badgeCover} crossOrigin="anonymous" />
                <div className={styles.badgeInfo}>
                  <p className={styles.badgeTitle}>{track.title}</p>
                  <p className={styles.badgeArtist}>{track.artist}</p>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Default Cover Layout */}
              <div className={styles.coverArtContainer}>
                <img src={track.coverUrl} alt="Cover" className={styles.coverArtBig} crossOrigin="anonymous" />
              </div>
              <div className={styles.infoSection}>
                <h3 className={styles.infoTitleBig}>{track.title}</h3>
                <p className={styles.infoArtistBig}>{track.artist}</p>
              </div>
            </>
          )}
        </div>
      </div>

      <div className={styles.actionsContainer}>
        <button className={styles.secondaryBtn} onClick={() => handleDownload()} disabled={isGenerating}>
          <Download size={20} />
          Save
        </button>
        <button className={styles.primaryBtn} onClick={handleShare} disabled={isGenerating}>
          {isGenerating ? <Loader2 size={20} className={styles.loadingSpinner} /> : <Share2 size={20} />}
          {isGenerating ? 'Generating...' : 'Share to IG'}
        </button>
      </div>
    </div>
  );
}
