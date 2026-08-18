import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get('title');
  const artist = searchParams.get('artist');

  if (!title) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }

  // Clean title from common YouTube junk to improve lyrics search hit rate
  const cleanTitle = (str: string) => {
    let clean = str;
    // Remove content inside brackets/parentheses like (Official Video), [MV], (feat. artist)
    clean = clean.replace(/\([^)]*\)/g, '');
    clean = clean.replace(/\[[^\]]*\]/g, '');
    // Remove specific keywords
    clean = clean.replace(/(official|lyric|video|audio|mv|teaser|live|cover|remix)/gi, '');
    // Remove featuring info sometimes outside brackets (e.g., ft. or feat.)
    clean = clean.replace(/(ft\.|feat\.).*$/gi, '');
    // Remove multiple spaces, hyphens at the end, etc.
    clean = clean.replace(/\s+/g, ' ').trim();
    clean = clean.replace(/-\s*$/, '').trim();
    return clean || str; // fallback to original if completely stripped
  };

  const cleanedTitle = cleanTitle(title);

  try {
    // Try lrclib.net — free, no API key needed, has synced+plain lyrics
    const query = new URLSearchParams({
      track_name: cleanedTitle,
      artist_name: artist || '',
    });

    const res = await fetch(`https://lrclib.net/api/get?${query.toString()}`, {
      headers: { 'Lrclib-Client': 'JetMusic/4.3.2 (https://jet-music.vercel.app)' },
      next: { revalidate: 86400 } // cache for 24h
    });

    if (!res.ok) {
      // Try a search fallback if exact match fails
      const searchRes = await fetch(
        `https://lrclib.net/api/search?q=${encodeURIComponent(`${cleanedTitle} ${artist || ''}`.trim())}`,
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
