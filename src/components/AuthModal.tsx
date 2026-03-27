'use client';
import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Mail, Lock, X, ShieldCheck, UserPlus, User } from 'lucide-react';
import styles from './LandingPage.module.css';

export default function AuthModal() {
  const { login, signup, setShowAuthModal, continueAsGuest } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (mode === 'signup') {
        const res = await signup(email, password, username);
        if (!res.success) setError(res.error || 'สมัครสมาชิกไม่สำเร็จ');
      } else {
        const res = await login(email, password);
        if (!res.success) setError(res.error || 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');
      }
    } catch (err: any) {
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={() => setShowAuthModal(false)}>
      <div className={styles.glassCard} onClick={e => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={() => setShowAuthModal(false)}>
          <X size={20} />
        </button>

        <div className={styles.cardHeader}>
          {mode === 'login' ? <Lock size={24} color="var(--accent-primary)" /> : <UserPlus size={24} color="var(--accent-primary)" />}
          <div>
            <h2>{mode === 'login' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิกใหม่'}</h2>
            <p className={styles.subtitleTab}>JET MUSIC • Premium Experience</p>
          </div>
        </div>

        <div className={styles.tabs}>
          <button 
            type="button"
            className={`${styles.tab} ${mode === 'login' ? styles.activeTab : ''}`}
            onClick={() => setMode('login')}
          >
            เข้าสู่ระบบ
          </button>
          <button 
            type="button"
            className={`${styles.tab} ${mode === 'signup' ? styles.activeTab : ''}`}
            onClick={() => setMode('signup')}
          >
            สมัครสมาชิก
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputGroup}>
            <label><Mail size={14} /> อีเมล</label>
            <input 
              type="email" 
              placeholder="example@email.com" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              autoFocus
            />
          </div>

          {mode === 'signup' && (
            <div className={styles.inputGroup}>
              <label><User size={14} /> ชื่อเล่น</label>
              <input 
                type="text" 
                placeholder="ชื่อของคุณ" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={loading}
              />
            </div>
          )}

          <div className={styles.inputGroup}>
            <label><Lock size={14} /> รหัสผ่าน</label>
            <input 
              type="password" 
              placeholder="••••••••" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          {error && <div className={styles.errorText}>{error}</div>}

          <button type="submit" className={styles.loginBtn} disabled={loading}>
            {loading ? <div className={styles.loader}></div> : (
              mode === 'login' ? 'เข้าสู่ระบบพรีเมียม' : 'สร้างบัญชีผู้ใช้ใหม่'
            )}
          </button>

          <button 
            type="button" 
            className={styles.guestBtn}
            onClick={continueAsGuest}
          >
            ใช้งานแบบนักท่องเที่ยว (Guest Mode)
          </button>
        </form>

        <div className={styles.securityInfo}>
          <ShieldCheck size={14} />
          <span>เข้ารหัสความปลอดภัยระดับพรีเมียม</span>
        </div>
      </div>
    </div>
  );
}
