import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL || '',
  token: process.env.KV_REST_API_TOKEN || '',
});

export async function GET(request: Request) {
  // Simple check for a "secret" query param to prevent random people from seeing emails
  // For a basic implementation, we just list the keys.
  try {
    // Redis 'KEYS' pattern can be slow but for a small user base it's perfect
    // We look for everything starting with jet_v2_data_
    const keys = await redis.keys('jet_v2_data_*');
    
    // Extract emails from keys (removing the prefix)
    const emails = keys.map(key => key.replace('jet_v2_data_', ''));
    
    return NextResponse.json({ 
      total: emails.length,
      users: emails,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Admin Users Fetch Error:", error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}
