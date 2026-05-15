import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL || '',
  token: process.env.KV_REST_API_TOKEN || '',
});

export async function GET() {
  try {
    // Public facing simple count
    const keys = await redis.keys('jet_v2_user_*');
    const emails = keys.map(key => key.replace('jet_v2_user_', ''));
    return NextResponse.json({ total: emails.length });
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { password } = await request.json();
    
    // Check Admin Password. Defaults to 'jetadmin' if not set in .env
    const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'jetadmin';
    if (password !== ADMIN_PASS) {
      return NextResponse.json({ error: 'รหัสผ่านแอดมินไม่ถูกต้อง' }, { status: 401 });
    }

    const keys = await redis.keys('jet_v2_user_*');
    if (keys.length === 0) {
      return NextResponse.json({ users: [], stats: { totalUsers: 0, totalSongsPlayed: 0, totalPlaylists: 0 } });
    }

    // Fetch all user data via mget for efficiency
    const usersData = await redis.mget(...keys);

    let totalSongsPlayed = 0;
    let totalPlaylists = 0;

    const formattedUsers = usersData.map((data: any, index: number) => {
      if (!data) return null;
      let parsed = typeof data === 'string' ? JSON.parse(data) : data;
      
      const played = parsed.stats?.songsPlayed || 0;
      const playlistsCount = parsed.playlists?.length || 0;
      
      totalSongsPlayed += played;
      totalPlaylists += playlistsCount;

      return {
        email: parsed.email || keys[index].replace('jet_v2_user_', ''),
        stats: parsed.stats || { songsPlayed: 0 },
        history: parsed.history || [],
        likedTracks: parsed.likedTracks || [],
        playlists: parsed.playlists || [],
      };
    }).filter(Boolean) as any[];

    // Sort by most active (songs played)
    formattedUsers.sort((a, b) => (b.stats.songsPlayed) - (a.stats.songsPlayed));

    return NextResponse.json({
      users: formattedUsers,
      stats: {
        totalUsers: keys.length,
        totalSongsPlayed,
        totalPlaylists
      }
    });
  } catch (error: any) {
    console.error("Admin Detailed Fetch Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
