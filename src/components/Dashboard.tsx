'use client';
import React, { useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { LogOut, Calendar, Award, Music, ShieldCheck, Settings as SettingsIcon } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { ForegroundService } from '@capawesome-team/capacitor-android-foreground-service';
import NativeAudioPlayer from '@/lib/nativePlayer';
import styles from './Dashboard.module.css';
import { Bell, AlertTriangle, Battery, BatteryWarning, Terminal } from 'lucide-react';

export default function Dashboard() {
  const { user, logout, updateProfile } = useAuth();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState('library');
  const [notifPermission, setNotifPermission] = useState<string>('granted');
  const [debugLogs, setDebugLogs] = useState<string[]>([]);

  React.useEffect(() => {
    // 🔍 Initial breadcrumb
    const time = new Date().toLocaleTimeString();
    const initialLog = `[${time}] Dashboard Loaded (v4.3.1)`;
    const existing = JSON.parse(localStorage.getItem('jet_debug_logs') || '[]');
    if (!existing.includes(initialLog)) {
        existing.push(initialLog);
        localStorage.setItem('jet_debug_logs', JSON.stringify(existing.slice(-20)));
    }

    // 🔍 Load debug logs from localStorage
    const interval = setInterval(() => {
      const logs = JSON.parse(localStorage.getItem('jet_debug_logs') || '[]');
      setDebugLogs(logs.slice(-5)); // Show last 5 logs
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Check permission on mount
  React.useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      ForegroundService.checkPermissions().then(res => {
        setNotifPermission(res.display);
      });
    }
  }, []);

  const requestPermission = async () => {
    if (Capacitor.isNativePlatform()) {
      const res = await ForegroundService.requestPermissions();
      setNotifPermission(res.display);
      if (res.display === 'granted') {
        showToast('เปิดการควบคุมเพลงสำเร็จ! 🎧', 'success');
      } else {
        showToast('กรุณาอนุญาตการแจ้งเตือนเพื่อใช้แบนเนอร์เพลง', 'error');
      }
    }
  };

  if (!user) return null;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 2 * 1024 * 1024) {
      alert('ขนาดรูปภาพใหญ่เกินไป (สูงสุด 2MB)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Str = event.target?.result as string;
      updateProfile({ avatarUrl: base64Str });
      showToast('อัปเดตรูปโพรไฟล์สำเร็จ ✨', 'success');
    };
    reader.readAsDataURL(file);
  };


  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'ไม่ระบุ';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('th-TH', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    } catch (e) {
      return dateStr;
    }
  };

  const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&background=818cf8&color=fff&size=128`;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        {Capacitor.isNativePlatform() && notifPermission !== 'granted' && (
          <div className={styles.permissionAlert} onClick={requestPermission}>
            <div className={styles.alertIcon}>
              <Bell size={20} />
            </div>
            <div className={styles.alertContent}>
              <p className={styles.alertTitle}>เปิดแจ้งเตือนเพื่อใช้แบนเนอร์ควบคุมเพลง</p>
              <p className={styles.alertText}>แตะที่นี่เพื่ออนุญาตการแจ้งเตือน</p>
            </div>
            <AlertTriangle size={18} className={styles.alertArrow} />
          </div>
        )}

        {Capacitor.isNativePlatform() && (
          <div className={styles.batteryAlert} onClick={() => {
            alert('⚙️ วิธีแก้เพลงดับ:\n1. กด "ไปที่การตั้งค่า"\n2. หาแอป Jet Music\n3. เลือก "แบตเตอรี่"\n4. เลือก "ไม่จำกัด" (Unrestricted)');
            // Open battery settings for this app
            window.open('package:com.jetmusic.app', '_system'); 
          }}>
            <div className={styles.alertIcon} style={{ background: 'rgba(234, 179, 8, 0.2)', color: '#eab308' }}>
              <BatteryWarning size={20} />
            </div>
            <div className={styles.alertContent}>
              <p className={styles.alertTitle}>เพลงดับเวลาปิดหน้าจอ?</p>
              <p className={styles.alertText}>แตะเพื่อตั้งค่า "ไม่จำกัดแบตเตอรี่"</p>
            </div>
          </div>
        )}
        <div className={styles.profileHeader}>
          <div className={styles.avatarWrapper} onClick={() => fileInputRef.current?.click()} style={{ cursor: 'pointer' }}>
            <img 
              src={user.avatarUrl || defaultAvatar} 
              alt={user.username} 
              className={styles.avatar} 
              onError={(e) => { (e.target as HTMLImageElement).src = defaultAvatar; }}
            />
            <div className={styles.avatarEditOverlay}>
              <span style={{ fontSize: '0.8rem', color: 'white', fontWeight: 'bold' }}>เปลี่ยนรูป</span>
            </div>
            <input 
              type="file" 
              accept="image/*" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              onChange={handleImageUpload} 
            />
            <div className={styles.badge}>
              <ShieldCheck size={16} />
            </div>
          </div>
          <div className={styles.userInfo}>
            <h1 className={styles.username}>{user.username}</h1>
            <p className={styles.email}>{user.email}</p>
            <div className={styles.tierTag}>
              <Award size={14} /> {user.tier || 'Premium'}
            </div>
          </div>
        </div>
      </header>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <Music className={styles.statIcon} size={24} />
          <div className={styles.statValue}>{user.stats?.songsPlayed || 0}</div>
          <div className={styles.statLabel}>เพลงที่ฟังแล้ว</div>
        </div>
        <div className={styles.statCard}>
          <Calendar className={styles.statIcon} size={24} />
          <div className={styles.statValue}>{formatDate(user.memberSince || (user as any).createdAt)}</div>
          <div className={styles.statLabel}>เป็นสมาชิกตั้งแต่</div>
        </div>
      </div>

      {/* NEW: My Music Stats Section */}
      {(user.playCounts?.tracks || user.playCounts?.artists) && (
        <div className={styles.musicStatsSection}>
          <div className={styles.statsHeader}>
            <h2 className={styles.sectionTitle}>🎹 สีสันการฟังของคุณ</h2>
            <div className={styles.statsBadge}>Live Stats</div>
          </div>

          <div className={styles.dashboardGrid}>
            {/* Top Tracks */}
            {user.playCounts?.tracks && Object.keys(user.playCounts.tracks).length > 0 && (
              <div className={styles.rankCard}>
                <h3 className={styles.rankTitle}>Top 5 เพลงโปรด</h3>
                <div className={styles.rankList}>
                  {Object.values(user.playCounts.tracks)
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 5)
                    .map((track, idx) => (
                      <div key={idx} className={styles.rankItem}>
                        <div className={styles.rankNumber}>{idx + 1}</div>
                        <img src={track.cover} alt={track.name} className={styles.rankCover} />
                        <div className={styles.rankInfo}>
                          <p className={styles.rankName}>{track.name}</p>
                          <p className={styles.rankSub}>{track.artist}</p>
                        </div>
                        <div className={styles.trackPlayCount}>{track.count} ครั้ง</div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Top Artists */}
            {user.playCounts?.artists && Object.keys(user.playCounts.artists).length > 0 && (
              <div className={styles.rankCard}>
                <h3 className={styles.rankTitle}>ศิลปินที่คุณรัก</h3>
                <div className={styles.artistList}>
                  {Object.entries(user.playCounts.artists)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 3)
                    .map(([name, count], idx) => (
                      <div key={idx} className={styles.artistItem}>
                        <div className={styles.artistRankBadge}>#{idx + 1}</div>
                        <div className={styles.artistInfo}>
                           <p className={styles.artistName}>{name}</p>
                           <p className={styles.artistCount}>{count} การเล่น</p>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className={styles.settingsSection}>
        {/* ⚠️ CRITICAL WEB WARNING (v4.0.6) */}
        {!Capacitor.isNativePlatform() && (
          <div style={{ backgroundColor: '#ef4444', color: 'white', padding: '15px', borderRadius: '12px', marginBottom: '15px', textAlign: 'center', fontWeight: 'bold', border: '2px solid white' }}>
            ⚠️ VERSION: WEB BROWSER<br/>
            <span style={{ fontSize: '12px', fontWeight: 'normal' }}>
              โหมดนี้ "เล่นพื้นหลังไม่ได้" และ "ไม่มีแบนเนอร์"<br/>
              กรุณาติดตั้งและเปิดผ่าน APK ด้านล่างครับ
            </span>
          </div>
        )}

        {Capacitor.isNativePlatform() && (
          <div style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', padding: '12px', borderRadius: '12px', marginBottom: '15px', textAlign: 'center', fontSize: '13px', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
            ✅ NATIVE ENGINE ACTIVE (V4.0.6)<br/>
            <span style={{ fontSize: '11px', opacity: 0.8 }}>เล่นพื้นหลังและต่อเพลงอัตโนมัติพร้อมใช้งาน</span>
          </div>
        )}

        <h2 className={styles.sectionTitle}>การจัดการบัญชี</h2>
        <div className={styles.menuList}>

          <button className={styles.menuItem}>
            <div className={styles.menuIconWrapper}>
               <ShieldCheck size={18} />
            </div>
            <div className={styles.menuText}>ความปลอดภัยและการเป็นส่วนตัว</div>
          </button>

          {!Capacitor.isNativePlatform() && (
            <a href="/jet-music.apk" download className={styles.menuItem}>
              <div className={styles.menuIconWrapper} style={{ backgroundColor: '#4ade80' }}>
                 <Music size={18} color="white" />
              </div>
              <div className={styles.menuText}>ดาวน์โหลดแอพ Android (.apk)</div>
            </a>
          )}

          
          <button onClick={logout} className={`${styles.menuItem} ${styles.logoutBtn}`}>
            <div className={styles.menuIconWrapper}>
               <LogOut size={18} />
            </div>
            <div className={styles.menuText}>ออกจากระบบ</div>
          </button>
        </div>
      </div>

      <div className={styles.premiumBanner}>
        <div className={styles.premiumContent}>
          <h3>Jet Music Premium</h3>
          <p>คุณกำลังใช้งานฟีเจอร์ระดับสูงสุด ไม่จำกัดการเข้าถึง</p>
        </div>
        <Award size={40} className={styles.premiumIcon} />
      </div>
            {/* Version and Platform Info */}
           <div style={{ marginTop: '20px', padding: '15px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '12px', fontSize: '12px', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.05)' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span>Build Version</span>
                <span style={{ color: '#818cf8', fontWeight: 'bold' }}>v4.3.1 (Total Truth)</span>
             </div>
             <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span>Platform Status</span>
                 <span style={{ color: (typeof window !== 'undefined' && navigator.userAgent.includes('JetMusicNative')) ? '#4ade80' : '#f87171', fontWeight: 'bold' }}>
                     {(typeof window !== 'undefined' && navigator.userAgent.includes('JetMusicNative')) ? '✅ Android Native' : '❌ Web Browser'}
                </span>
             </div>
             <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Engine Status</span>
                <span style={{ color: '#4ade80' }}>Protected & Persistent</span>
             </div>
           </div>
      
      <div style={{ textAlign: 'center', padding: '20px 0', opacity: 0.4, fontSize: '0.75rem' }}>
        Jet Music v4.3.1 (Total Truth Edition)
      </div>

      {/* 🛠️ Debug Console */}
      <div style={{ 
        margin: '10px 15px', 
        padding: '10px', 
        background: 'rgba(255,0,0,0.1)', 
        borderRadius: '8px', 
        fontSize: '0.65rem',
        border: '1px solid rgba(255,0,0,0.2)',
        fontFamily: 'monospace'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '5px', color: '#ff4d4d' }}>
          <Terminal size={12} /> <span>DEBUG LOGS (Real-time)</span>
        </div>
        {debugLogs.length === 0 ? (
          <div style={{ opacity: 0.5 }}>No logs yet...</div>
        ) : (
          debugLogs.map((log, i) => <div key={i} style={{ marginBottom: '2px' }}>• {log}</div>)
        )}
      </div>
    </div>
  );
}
