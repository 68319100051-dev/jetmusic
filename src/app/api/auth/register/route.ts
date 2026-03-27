import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import crypto from 'crypto';

const redis = Redis.fromEnv();

export async function POST(request: Request) {
  try {
    const { email, password, username } = await request.json();

    if (!email || !password || !username) {
      return NextResponse.json({ error: 'Data incomplete' }, { status: 400 });
    }

    // Check if user already exists
    const existing = await redis.get(`jet_v2_user_${email}`);
    if (existing) {
      return NextResponse.json({ error: 'อีเมลนี้ถูกใช้งานแล้ว' }, { status: 400 });
    }

    // Hash password (SHA-256 for no-dependency simplicity)
    const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');

    const newUser = {
      email,
      username,
      password: hashedPassword,
      createdAt: new Date().toISOString(),
      history: [],
      lastPlayed: null,
      searchHistory: []
    };

    await redis.set(`jet_v2_user_${email}`, JSON.stringify(newUser));

    return NextResponse.json({ success: true, user: { email, username } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
