'use client';
import React, { useState, useEffect } from 'react';
import { Smartphone, Download, X } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import styles from './AppPromotionPopup.module.css';

export default function AppPromotionPopup() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // 🛡️ Logic to show ONLY on mobile web (Android) and NOT in the Native App
    const isNative = Capacitor.isNativePlatform();
    if (isNative) return;

    const isAndroidWeb = /Android/i.test(navigator.userAgent);
    const isDismissed = localStorage.getItem('jet_app_promo_dismissed') === 'true';

    if (isAndroidWeb && !isDismissed) {
      // Delay slightly for better UX
      const timer = setTimeout(() => setIsVisible(true), 3000);
      return () => clearTimeout(timer);
    }
  }, []);

  const dismiss = () => {
    setIsVisible(false);
    localStorage.setItem('jet_app_promo_dismissed', 'true');
  };

  if (!isVisible) return null;

  return (
    <div className={styles.overlay}>
       <div className={styles.popup}>
          <button className={styles.closeBtn} onClick={dismiss}>
            <X size={20} />
          </button>
          
          <div className={styles.iconWrapper}>
            <Smartphone size={40} color="#818cf8" />
          </div>

          <div className={styles.content}>
            <h3>ย้ายไปเล่นบนแอปมั้ย? 🚀</h3>
            <p>ฟังเพลงลื่นไหล ไม่มีสะดุด แม้พับหน้าจอ หรือล็อกเครื่อง ประสบการณ์ที่ดีกว่ารอคุณอยู่!</p>
          </div>

          <div className={styles.actions}>
            <a 
              href="/jet-music.apk" 
              download 
              className={styles.downloadBtn}
              onClick={dismiss}
            >
              <Download size={18} />
              ดาวน์โหลด Android App
            </a>
            <button className={styles.notNowBtn} onClick={dismiss}>
              ไว้ทีหลัง
            </button>
          </div>
       </div>
    </div>
  );
}
