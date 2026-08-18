import React from 'react';
import { Download, Rocket, ShieldCheck } from 'lucide-react';
import styles from './ForceUpdateModal.module.css';

interface ForceUpdateModalProps {
  latestVersion: string;
  releaseNotes: string;
  onUpdate: () => void;
}

export default function ForceUpdateModal({ latestVersion, releaseNotes, onUpdate }: ForceUpdateModalProps) {
  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.glow} />
        
        <div className={styles.iconContainer}>
          <Rocket size={48} className={styles.rocketIcon} />
        </div>

        <h2 className={styles.title}>New Update Available</h2>
        <div className={styles.versionBadge}>{latestVersion} TRUE SYNC</div>
        
        <p className={styles.description}>
          A critical update is ready to enhance your experience. 
          Please update now for the non-overlapping UI and stable background playback.
        </p>

        <div className={styles.notesContainer}>
          <div className={styles.notesTitle}>What's New:</div>
          <p className={styles.notes}>{releaseNotes}</p>
        </div>

        <div className={styles.buttonGroup}>
          <button className={styles.updateButton} onClick={onUpdate}>
            <Download size={20} className="mr-2" />
            Update Now
          </button>
          
          <button 
            className={styles.copyButton} 
            onClick={(e) => {
              e.stopPropagation();
              navigator.clipboard.writeText('https://jet-music.vercel.app/jet-music.apk');
              alert('ลิงก์ดาวน์โหลดถูกคัดลอกแล้ว! นำไปวางใน Chrome เพื่อดาวน์โหลดได้เลยครับ');
            }}
          >
            Copy Link
          </button>
        </div>

        <div className={styles.manualLink}>
           Having trouble? <a href="https://jet-music.vercel.app/jet-music.apk" target="_system" className={styles.textLink}>Click here to download manually</a>
        </div>

        <div className={styles.footer}>
          <ShieldCheck size={14} />
          Certified Secure Update
        </div>
      </div>
    </div>
  );
}
