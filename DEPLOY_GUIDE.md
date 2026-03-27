# 🚀 คู่มือการนำ Jet Music ขึ้นใช้งานจริง (Public Deployment)

ยินดีด้วยครับ! แอปของคุณพร้อมสำหรับการใช้งานระดับโปรแล้ว ทำตามขั้นตอนด้านล่างนี้เพื่อเปิดให้คนอื่นใช้งานได้:

---

## 1. รับ Resend API Key (สำหรับส่งเมลจริง)
ระบบล็อกอินต้องการ API Key เพื่อส่งรหัส OTP เข้าเมลผู้ใช้:
1. ไปที่ [Resend.com](https://resend.com) และสมัครสมาชิกฟรี
2. ไปที่เมนู **API Keys** -> **Create API Key**
3. คัดลอกรหัสที่ขึ้นต้นด้วย `re_...`
4. นำมาใส่ในไฟล์ `.env.local` ในเครื่องของคุณ:
   ```env
   RESEND_API_KEY=re_ของคุณที่นี่
   ```

---

## 2. นำโค้ดขึ้น GitHub
1. สร้าง Repository ใหม่บน [GitHub.com](https://github.com)
2. รันคำสั่งใน Terminal ของโปรเจกต์นี้:
   ```bash
   git add .
   git commit -m "Initial production release"
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   git push -u origin main
   ```

---

## 3. Deploy บน Vercel
Vercel คือที่เก็บแอป Next.js ที่ดีที่สุด:
1. ไปที่ [Vercel.com](https://vercel.com) และล็อกอินด้วย GitHub
2. กด **Add New** -> **Project**
3. เลือก Repository ที่คุณเพิ่งอัปโหลด
4. ในส่วน **Environment Variables** ให้เพิ่มข้อมูลดังนี้:
   * **Key:** `RESEND_API_KEY`
   * **Value:** `(วาง API Key จากข้อ 1 ลงไป)`
5. กด **Deploy**

---

## 4. ติดตั้งบนมือถือ (PWA)
แอปจะทำงานได้ดีที่สุดเมื่อติดตั้งลงเครื่อง:
1. เปิดลิงก์จาก Vercel บนมือถือ (แนะนำ Chrome บน Android หรือ Safari บน iOS)
2. กดปุ่ม **Share** หรือ **จุดสามจุด** 
3. เลือก **"Add to Home Screen"** หรือ **"เพิ่มลงในหน้าจอหลัก"**
4. แอปจะเปิดมาเป็นแบบเต็มหน้าจอ (Standalone) พร้อมหน้า Splash Screen สวยๆ ครับ!

---

### ✨ ฟีเจอร์ที่คุณได้รับในเวอร์ชันนี้:
* **Background Playback:** ฟังเพลงต่อเนื่องแม้ล็อกหน้าจอ
* **Lock Screen Controls:** สั่งงาน Play/Pause/Skip จากหน้าจอล็อกได้เลย
* **Session Persistence:** เปิดแอปใหม่ ฟังต่อจากที่ค้างไว้ได้ทันที
* **Real Email Auth:** ระบบสมาชิกที่เชื่อมกับอีเมลจริง

ขอให้สนุกกับการสตรีมเพลงนะครับ! 💿✨
