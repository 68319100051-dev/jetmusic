'use client';
import { useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { LogOut, Calendar, Award, Music, ShieldCheck } from 'lucide-react';
import styles from './Dashboard.module.css';

export default function Dashboard() {
  const { user, logout, updateUser } = useAuth();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      updateUser({ avatarUrl: base64Str });
      showToast('อัปเดตรูปโพรไฟล์สำเร็จ ✨', 'success');
    };
    reader.readAsDataURL(file);
  };


  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.profileHeader}>
          <div className={styles.avatarWrapper} onClick={() => fileInputRef.current?.click()} style={{ cursor: 'pointer' }}>
            <img src={user.avatarUrl} alt={user.username} className={styles.avatar} />
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
              <Award size={14} /> {user.tier}
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
          <div className={styles.statValue}>{user.memberSince}</div>
          <div className={styles.statLabel}>เป็นสมาชิกตั้งแต่</div>
        </div>
      </div>

      <div className={styles.settingsSection}>
        <h2 className={styles.sectionTitle}>การจัดการบัญชี</h2>
        <div className={styles.menuList}>
          <button className={styles.menuItem}>
            <div className={styles.menuIconWrapper}>
               <ShieldCheck size={18} />
            </div>
            <div className={styles.menuText}>ความปลอดภัยและการเป็นส่วนตัว</div>
          </button>
          
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
    </div>
  );
}
