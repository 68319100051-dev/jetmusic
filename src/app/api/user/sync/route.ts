import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL || '',
  token: process.env.KV_REST_API_TOKEN || '',
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email');
  
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 });

  try {
    const data = await redis.get(`jet_v2_data_${email}`);
    return NextResponse.json({ data: typeof data === 'string' ? JSON.parse(data) : data });
  } catch (error) {
    console.error("Redis GET Error:", error);
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { email, data } = await request.json();
    if (!email || !data) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

    await redis.set(`jet_v2_data_${email}`, data);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Redis POST Error:", error);
    return NextResponse.json({ error: 'Failed to save data' }, { status: 500 });
  }
}
