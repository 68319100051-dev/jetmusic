import { NextResponse } from 'next/server';
import { otpStore } from '../send-otp/route';

export async function POST(req: Request) {
  try {
    const { email, otp } = await req.json();

    if (!email || !otp) {
      return NextResponse.json({ error: 'Email and OTP are required' }, { status: 400 });
    }

    const storedData = otpStore.get(email);

    if (!storedData) {
      return NextResponse.json({ error: 'ไม่พบรหัสยืนยัน หรือรหัสหมดอายุแล้ว' }, { status: 400 });
    }

    if (Date.now() > storedData.expires) {
      otpStore.delete(email);
      return NextResponse.json({ error: 'รหัสยืนยันหมดอายุแล้ว กรุณาขอรหัสใหม่' }, { status: 400 });
    }

    if (storedData.otp !== otp) {
      return NextResponse.json({ error: 'รหัสยืนยันไม่ถูกต้อง' }, { status: 400 });
    }

    // Success! Clear the OTP
    otpStore.delete(email);

    return NextResponse.json({ 
      success: true, 
      user: {
        email,
        verified: true,
        // In a real app, you'd fetch user data from DB here
      }
    });
  } catch (error) {
    console.error('[JET] Verify OTP Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
