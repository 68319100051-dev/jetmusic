'use client';
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePWA } from '@/contexts/PWAContext';
import { 
  LogIn, UserPlus, ExternalLink, Star, CheckCircle2, Share, PlusSquare, X, Download
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import Image from 'next/image';
import styles from './LandingPage.module.css';

export default function LandingPage() {
  const { setShowAuthModal, continueAsGuest } = useAuth();
  const { isInstallable, isStandalone, installApp } = usePWA();
  
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);

  useEffect(() => {
    const ua = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(ua));
  }, []);

  return (
    <div className={styles.container}>
      {/* 🚀 HERO SECTION 🚀 */}
      <div className={styles.hero}>
        <div className={styles.logoBadge}>
          <Image 
            src="/icon.png" 
            alt="Jet Music Logo" 
            width={100} 
            height={100} 
            className={styles.logoImgMain}
          />
        </div>
        <h1 className={styles.title}>Jet Music Premium</h1>
        <p className={styles.subtitle}>สัมผัสประสบการณ์เสียงที่สมบูรณ์แบบที่สุด พร้อมคลังเพลงส่วนตัวของคุณ</p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 40, width: '100%', maxWidth: 320, margin: '40px auto 0' }}>
          <button className={styles.signupBtn} onClick={() => setShowAuthModal(true)}>
            <UserPlus size={20} /> สร้างบัญชีใหม่
          </button>
          <button className={styles.loginBtn} onClick={() => setShowAuthModal(true)} style={{ marginTop: 0 }}>
            <LogIn size={20} /> เข้าสู่ระบบ
          </button>
          <button className={styles.guestBtn} onClick={() => continueAsGuest()}>
            ใช้งานในโหมด Guest
          </button>
        </div>
      </div>

      {/* 📱 PWA INSTALL SECTION 📱 */}
      <section className={styles.installSection}>
        <div className={styles.storeHeader}>
          <h3>ติดตั้ง Jet Music ลงในเครื่อง</h3>
          <p>เปิดฟังเพลงได้จากหน้าโฮม เหมือนแอปจริง 100%</p>
        </div>
        
        <div className={styles.appStoreCard}>
          <div className={styles.appIcon}>
            <Image 
              src="/icon.png" 
              alt="App Icon" 
              width={64} 
              height={64} 
              className={styles.appIconImg}
            />
          </div>
          <div className={styles.appMetadata}>
            <div className={styles.appName}>Jet Music Premium</div>
            <div className={styles.appVendor}>Jet Digital Music Ltd.</div>
            <div className={styles.appRating}>
              <Star size={12} fill="#fbbf24" color="#fbbf24" />
              <Star size={12} fill="#fbbf24" color="#fbbf24" />
              <Star size={12} fill="#fbbf24" color="#fbbf24" />
              <Star size={12} fill="#fbbf24" color="#fbbf24" />
              <Star size={12} fill="#fbbf24" color="#fbbf24" />
              <span>4.9 • 1.2M รีวิว</span>
            </div>
          </div>
          <div className={styles.actionArea}>
            {isStandalone || Capacitor.isNativePlatform() ? (
              <div className={styles.installedBadge}>
                <CheckCircle2 size={14} /> ติดตั้งแล้ว
              </div>
            ) : (/Android/i.test(window.navigator.userAgent)) ? (
              <a 
                href="/jet-music.apk" 
                download 
                className={styles.getBtn} 
                style={{ backgroundColor: '#4ade80', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 'auto', padding: '0 24px' }}
              >
                <Download size={16} style={{ marginRight: 6 }} /> DOWNLOAD APK
              </a>
            ) : (isInstallable || isIOS) ? (
              <button 
                className={styles.getBtn} 
                onClick={() => {
                  if (isInstallable) {
                    installApp();
                  } else if (isIOS) {
                    setShowIOSPrompt(true);
                  }
                }}
              >
                GET
              </button>
            ) : (
              <div className={styles.guideBadge}>
                <ExternalLink size={14} /> SHARE
              </div>
            )}
          </div>
        </div>
        
        {!isStandalone && !isInstallable && !isIOS && (
          <div className={styles.installGuide}>
             💡 วิธีติดตั้ง: กดปุ่ม <strong>แชร์</strong> บนบราวเซอร์ แล้วเลือก <strong>"เพิ่มลงหน้าจอหลัก"</strong>
          </div>
        )}
      </section>

      <div className={styles.features}>
        <div className={styles.feature}>
          <div className={styles.featureIcon}>💎</div>
          <div className={styles.featureText}>Premium Account</div>
        </div>
        <div className={styles.feature}>
          <div className={styles.featureIcon}>📧</div>
          <div className={styles.featureText}>Real Email Auth</div>
        </div>
        <div className={styles.feature}>
          <div className={styles.featureIcon}>🛡️</div>
          <div className={styles.featureText}>Data Security</div>
        </div>
      </div>

      {showIOSPrompt && (
        <div className={styles.modalOverlay} onClick={() => setShowIOSPrompt(false)}>
          <div className={styles.iosPromptModal} onClick={e => e.stopPropagation()}>
            <button className={styles.closeBtn} onClick={() => setShowIOSPrompt(false)}>
              <X size={24} />
            </button>
            <h3 style={{ marginTop: 0, marginBottom: 16 }}>ติดตั้งบน iOS</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.5 }}>
              Apple ไม่อนุญาตให้ติดตั้งแอปตั้งผ่านเว็บโดยตรง กรุณาทำตามขั้นตอน:
            </p>
            <ol className={styles.iosSteps}>
              <li>แตะไอคอน <strong>Share</strong> <Share size={18} style={{ display: 'inline', verticalAlign: 'middle', margin: '0 4px', color: '#0A84FF' }} /> บนแถบ Safari ด้านล่างสุด</li>
              <li>เลื่อนหา <strong>"เพิ่มไปยังหน้าจอโฮม"</strong> <PlusSquare size={18} style={{ display: 'inline', verticalAlign: 'middle', margin: '0 4px' }} /></li>
              <li>กด <strong>"เพิ่ม"</strong> ที่มุมขวาบน</li>
            </ol>
            <button className={styles.iosGotItBtn} onClick={() => setShowIOSPrompt(false)}>เข้าใจแล้ว</button>
          </div>
        </div>
      )}
    </div>
  );
}
