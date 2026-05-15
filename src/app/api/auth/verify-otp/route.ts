import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL || '',
  token: process.env.KV_REST_API_TOKEN || '',
});

export async function POST(req: Request) {
  try {
    const { email, otp } = await req.json();

    if (!email || !otp) {
      return NextResponse.json({ error: 'Email and OTP are required' }, { status: 400 });
    }

    const key = `jet_otp_${email.toLowerCase()}`;
    const storedOtp = await redis.get<string>(key);

    if (!storedOtp) {
      return NextResponse.json(
        { error: 'ไม่พบรหัสยืนยัน หรือรหัสหมดอายุแล้ว' },
        { status: 400 }
      );
    }

    if (storedOtp !== otp) {
      return NextResponse.json({ error: 'รหัสยืนยันไม่ถูกต้อง' }, { status: 400 });
    }

    // Success — delete OTP so it can't be reused
    await redis.del(key);

    return NextResponse.json({
      success: true,
      user: {
        email,
        verified: true,
      },
    });
  } catch (error) {
    console.error('[JET] Verify OTP Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
