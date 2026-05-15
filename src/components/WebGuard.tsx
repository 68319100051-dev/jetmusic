'use client';
import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Download, Smartphone, ShieldAlert, Copy, Check } from 'lucide-react';

export default function WebGuard() {
  const [isMobileWeb, setIsMobileWeb] = useState(false);
  const [isInAppBrowser, setIsInAppBrowser] = useState(false);
  const [copied, setCopied] = useState(false);

  const downloadUrl = 'https://jet-music.vercel.app/jet-music.apk';

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(downloadUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      alert("ไม่สามารถคัดลอกได้โดยอัตโนมัติ กรุณาพิมพ์ลิงก์นี้ใน Chrome ครับ: " + downloadUrl);
    }
  };

  useEffect(() => {
    // 🧬 TOTAL TRUTH: Synchronous DNA Detection (V4.3.0)
    // We check for our custom User Agent string injected from MainActivity.java.
    // This is 100% reliable and doesn't have race conditions with the bridge.
    const userAgent = typeof window !== 'undefined' ? navigator.userAgent.toLowerCase() : '';
    const isNativeDNA = userAgent.includes('jetmusicnative');
    
    // Detect In-App Browsers (Instagram, LINE, Facebook, etc.)
    const isIAB = /instagram|fbav|line|messenger|fban|wv/.test(userAgent);
    const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/.test(userAgent);

    // 🔓 BYPASS LOCKDOWN: If the DNA is found, it's the official APK!
    if (isNativeDNA) {
      setIsMobileWeb(false);
      document.body.style.overflow = '';
      return;
    }

    if (isMobileDevice) {
      setIsMobileWeb(true);
      setIsInAppBrowser(isIAB);
      document.body.style.overflow = 'hidden';
    }
  }, []);

  if (!isMobileWeb) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: '#050505',
      zIndex: 999999,
      display: 'flex',
      flexDirection: 'column',
      padding: '30px',
      color: 'white',
      fontFamily: 'sans-serif',
      overflowY: 'auto'
    }}>
      {/* ⚠️ IN-APP BROWSER ALERT */}
      {isInAppBrowser && (
        <div style={{ backgroundColor: '#fef08a', color: '#854d0e', padding: '15px', borderRadius: '12px', marginBottom: '25px', fontSize: '14px', border: '1px solid #facc15', fontWeight: 'bold' }}>
          ⚠️ แอปที่คุณใช้บล็อกการดาวน์โหลด!<br/>
          <span style={{ fontWeight: 'normal', fontSize: '13px' }}>
            วิธีแก้: กดปุ่ม <strong>(...) 3 จุด</strong> ที่มุมขวาบน แล้วเลือก <strong>'เปิดในเบราว์เซอร์'</strong><br/>
            <div style={{ marginTop: '12px', borderTop: '1px solid rgba(0,0,0,0.1)', paddingTop: '12px' }}>
              <strong>หรือใช้ท่าไม้ตายนี้แทน:</strong>
              <button 
                onClick={copyToClipboard}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  width: '100%',
                  marginTop: '10px',
                  padding: '12px',
                  borderRadius: '10px',
                  border: '1px solid #854d0e',
                  backgroundColor: copied ? '#4ade80' : 'white',
                  color: copied ? 'white' : '#854d0e',
                  fontWeight: 'bold',
                  fontSize: '14px'
                }}
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? 'คัดลอกลิงก์สำเร็จแล้ว!' : 'คัดลอกลิงก์ไว้วางใน Chrome'}
              </button>
              <div style={{ fontSize: '12px', fontWeight: 'normal', marginTop: '8px', opacity: 0.8 }}>
                *หลังจากกดปุ่มนี้ ให้ไปเปิดแอป Chrome แล้วกด "วาง" ลิงก์ครับ
              </div>
            </div>
          </span>
        </div>
      )}

      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <div style={{ display: 'inline-block', padding: '15px', backgroundColor: 'rgba(34, 197, 94, 0.1)', borderRadius: '50%', marginBottom: '15px' }}>
          <Smartphone size={40} color="#22c55e" />
        </div>
        <h1 style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '8px' }}>
          ⚠️ ขั้นตอนสุดท้ายเพื่อเข้าสู่แอปเพลง
        </h1>
        <p style={{ fontSize: '14px', color: '#94a3b8' }}>
          หน้านี้คือหน้าเว็บสำรอง ซึ่งเล่นเพลงพื้นหลังไม่ได้<br/>
          กรุณาทำตาม 3 ขั้นตอนด้านล่างเพื่อเข้าสู่แอปจริงครับ
        </p>
      </div>

      {/* 📋 STEP BY STEP GUIDE */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '40px' }}>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-start' }}>
          <div style={{ width: '28px', height: '28px', backgroundColor: '#22c55e', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', flexShrink: 0 }}>1</div>
          <div>
            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>กดปุ่มสีเขียวเพื่อ "โหลดไฟล์"</div>
            <a 
              href={downloadUrl}
              download="jet-music.apk"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: '#22c55e',
                color: 'black',
                padding: '12px 20px',
                borderRadius: '12px',
                fontSize: '15px',
                fontWeight: 'bold',
                textDecoration: 'none',
                marginTop: '8px',
                boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)'
              }}
            >
              <Download size={18} />
              ดาวน์โหลดแอพ (.apk)
            </a>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-start' }}>
          <div style={{ width: '28px', height: '28px', backgroundColor: '#3b82f6', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', flexShrink: 0 }}>2</div>
          <div>
            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>กด "ติดตั้ง" (Install)</div>
            <div style={{ fontSize: '13px', color: '#94a3b8' }}>เปิดไฟล์ที่โหลดมาจากแถบการแจ้งเตือน หรือโฟลเดอร์ดาวน์โหลดเพื่อติดตั้งครับ</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-start' }}>
          <div style={{ width: '28px', height: '28px', backgroundColor: '#8b5cf6', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', flexShrink: 0 }}>3</div>
          <div>
            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>เปิดแอปจาก "หน้ารวมแอป"</div>
            <div style={{ fontSize: '13px', color: '#94a3b8' }}>หาไอคอน Jet Music ในเครื่องพี่แล้วเปิดจากตรงนั้นครับ (ไม่ใช่ Chrome นะครับ)</div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 'auto', textAlign: 'center', paddingBottom: '20px' }}>
        <p style={{ fontSize: '12px', color: '#4b5563' }}>
          Jet Music v4.1.3 (Foolproof Link Active)
        </p>
      </div>
    </div>
  );
}
