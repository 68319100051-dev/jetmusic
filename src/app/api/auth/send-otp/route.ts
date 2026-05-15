import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL || '',
  token: process.env.KV_REST_API_TOKEN || '',
});

const OTP_TTL_SECONDS = 10 * 60; // 10 minutes

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    let otp = Math.floor(1000 + Math.random() * 9000).toString();

    const RESEND_API_KEY = process.env.RESEND_API_KEY;

    if (!RESEND_API_KEY || RESEND_API_KEY === 're_123456789' || RESEND_API_KEY.includes('your_')) {
      otp = '0000';
      console.warn('[JET] Using dummy RESEND_API_KEY. Falling back to Log only. OTP is 0000.');

      await redis.set(`jet_otp_${email.toLowerCase()}`, otp, { ex: OTP_TTL_SECONDS });

      return NextResponse.json({
        success: true,
        message: 'OTP sent (Debug Mode: ใช้รหัส 0000 ได้เลย)',
        debug: true,
      });
    }

    // Store OTP in Redis with TTL (works across Vercel serverless instances)
    await redis.set(`jet_otp_${email.toLowerCase()}`, otp, { ex: OTP_TTL_SECONDS });

    // Send Real Email via Resend API
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: 'Jet Music <onboarding@resend.dev>',
          to: [email],
          subject: 'รหัสยืนยันตัวตน Jet Music ของคุณ',
          html: `
            <div style="font-family: sans-serif; padding: 20px; background: #050505; color: white; border-radius: 10px;">
              <h1 style="color: #818cf8;">Jet Music Premium</h1>
              <p>สวัสดีครับ!</p>
              <p>ขอบคุณที่ร่วมเป็นส่วนหนึ่งของ Jet Music รหัสยืนยันตัวตนของคุณคือ:</p>
              <div style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #818cf8; margin: 20px 0;">
                ${otp}
              </div>
              <p>รหัสนี้จะหมดอายุภายใน 10 นาที</p>
              <hr style="border-color: #333;" />
              <p style="font-size: 12px; color: #666;">หากคุณไม่ได้ขอนี้ โปรดเพิกเฉยต่ออีเมลนี้</p>
            </div>
          `,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Email sending failed — fall back to debug mode
        console.warn('[JET] Email sending failed, falling back to debug mode. Error:', data.message);
        const debugOtp = '0000';
        await redis.set(`jet_otp_${email.toLowerCase()}`, debugOtp, { ex: OTP_TTL_SECONDS });
        return NextResponse.json({
          success: true,
          message: 'ไม่สามารถส่งอีเมลได้ (Debug Mode) ใช้รหัส 0000',
          debug: true,
          debugOtp: debugOtp,
        });
      }

      return NextResponse.json({ success: true, message: 'OTP sent to your email' });
    } catch (emailError) {
      console.warn('[JET] Email network error, falling back to debug mode:', emailError);
      const debugOtp = '0000';
      await redis.set(`jet_otp_${email.toLowerCase()}`, debugOtp, { ex: OTP_TTL_SECONDS });
      return NextResponse.json({
        success: true,
        message: 'ไม่สามารถส่งอีเมลได้ (Debug Mode) ใช้รหัส 0000',
        debug: true,
        debugOtp: debugOtp,
      });
    }
  } catch (error) {
    console.error('[JET] Send OTP Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
