'use client';
import React, { useEffect, useState } from 'react';
import { Disc3 } from 'lucide-react';
import styles from './SplashScreen.module.css';

export default function SplashScreen() {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, 1800);
    return () => clearTimeout(timer);
  }, []);

  if (!isVisible) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.content}>
        <div className={styles.logoWrapper}>
          <Disc3 className={styles.logo} size={80} color="#818cf8" />
          <div className={styles.pulse}></div>
        </div>
        <h1 className={styles.title}>Jet Music</h1>
        <div className={styles.loaderLine}>
          <div className={styles.progress}></div>
        </div>
        <p className={styles.tagline}>Premium Streaming Experience</p>
      </div>
    </div>
  );
}
