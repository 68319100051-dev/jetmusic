import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get('title');
  const artist = searchParams.get('artist');

  if (!title) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }

  try {
    // Try lrclib.net — free, no API key needed, has synced+plain lyrics
    const query = new URLSearchParams({
      track_name: title,
      artist_name: artist || '',
    });

    const res = await fetch(`https://lrclib.net/api/get?${query.toString()}`, {
      headers: { 'Lrclib-Client': 'JetMusic/4.3.2 (https://jet-music.vercel.app)' },
      next: { revalidate: 86400 } // cache for 24h
    });

    if (!res.ok) {
      // Try a search fallback if exact match fails
      const searchRes = await fetch(
        `https://lrclib.net/api/search?q=${encodeURIComponent(`${title} ${artist || ''}`.trim())}`,
        { headers: { 'Lrclib-Client': 'JetMusic/4.3.2 (https://jet-music.vercel.app)' } }
      );

      if (!searchRes.ok) {
        return NextResponse.json({ error: 'ไม่พบเนื้อเพลงนี้' }, { status: 404 });
      }

      const searchData = await searchRes.json();
      if (!Array.isArray(searchData) || searchData.length === 0) {
        return NextResponse.json({ error: 'ไม่พบเนื้อเพลงนี้' }, { status: 404 });
      }

      const best = searchData[0];
      return NextResponse.json({
        plainLyrics: best.plainLyrics || null,
        syncedLyrics: best.syncedLyrics || null,
      });
    }

    const data = await res.json();
    return NextResponse.json({
      plainLyrics: data.plainLyrics || null,
      syncedLyrics: data.syncedLyrics || null,
    });

  } catch (error: any) {
    console.error('[JET-LYRICS] Error:', error.message);
    return NextResponse.json({ error: 'ไม่สามารถโหลดเนื้อเพลงได้' }, { status: 500 });
  }
}
