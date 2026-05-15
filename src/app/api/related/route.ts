import { NextResponse } from 'next/server';

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const YOUTUBE_SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search';
const YOUTUBE_VIDEOS_URL = 'https://www.googleapis.com/youtube/v3/videos';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get('id');

  if (!videoId) {
    return NextResponse.json({ error: 'Video ID required' }, { status: 400 });
  }

  if (!YOUTUBE_API_KEY) {
    return NextResponse.json({ error: 'YouTube API Key not configured' }, { status: 500 });
  }

  // Extract bare YouTube video ID from various URL formats
  let bareId = videoId;
  const match = videoId.match(/(?:v=|\/|embed\/|youtu\.be\/)([0-9A-Za-z_-]{11})/);
  if (match) bareId = match[1];

  try {
    // Step 1: Get video details to extract title/artist for the "More Like This" query
    const detailsRes = await fetch(
      `${YOUTUBE_VIDEOS_URL}?part=snippet&id=${bareId}&key=${YOUTUBE_API_KEY}`
    );
    const detailsData = await detailsRes.json();
    const snippet = detailsData.items?.[0]?.snippet;

    if (!snippet) {
      return NextResponse.json({ results: [] });
    }

    // Build a search query from the video title
    const rawTitle = snippet.title || '';
    // Strip common suffixes like (Official Video), [MV], etc.
    const cleanTitle = rawTitle
      .replace(/\s*[\(\[][^\)\]]*[\)\]]/g, '')
      .replace(/(official|mv|lyric|video|audio|hd|4k|เนื้อร้อง)/gi, '')
      .trim()
      .split(' ')
      .slice(0, 5)
      .join(' ');

    // Step 2: Search for related videos using the clean title
    const searchRes = await fetch(
      `${YOUTUBE_SEARCH_URL}?part=snippet&q=${encodeURIComponent(cleanTitle)}&type=video&videoCategoryId=10&maxResults=20&regionCode=TH&key=${YOUTUBE_API_KEY}`
    );

    if (!searchRes.ok) {
      return NextResponse.json({ results: [] });
    }

    const searchData = await searchRes.json();
    const videoIds = searchData.items
      ?.map((item: any) => item.id.videoId)
      .filter((id: string) => id && id !== bareId) // Exclude current track
      .join(',');

    if (!videoIds) {
      return NextResponse.json({ results: [] });
    }

    // Step 3: Get full details including duration
    const videosRes = await fetch(
      `${YOUTUBE_VIDEOS_URL}?part=contentDetails,snippet&id=${videoIds}&key=${YOUTUBE_API_KEY}`
    );
    const videosData = await videosRes.json();

    const parseDuration = (iso: string): number => {
      const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
      if (!m) return 0;
      return (parseInt(m[1] || '0') * 3600) + (parseInt(m[2] || '0') * 60) + parseInt(m[3] || '0');
    };

    const blacklist = ['รวมเพลง', 'เมดเล่ย์', 'top 20', 'top 50', 'top 100', 'best of', 'full album', 'long mix', 'non stop', 'ต่อเนื่อง'];

    const results = videosData.items
      ?.map((item: any) => {
        const dur = parseDuration(item.contentDetails?.duration || '');
        const t = item.snippet?.title || '';
        const mins = dur / 60;
        if (blacklist.some(w => t.toLowerCase().includes(w))) return null;
        if (mins < 1.0 || mins > 10.0) return null;
        return {
          id: item.id,
          title: t,
          artist: item.snippet?.channelTitle || 'Unknown Artist',
          coverUrl: item.snippet?.thumbnails?.medium?.url || `https://i.ytimg.com/vi/${item.id}/mqdefault.jpg`,
          audioSrc: `https://www.youtube.com/watch?v=${item.id}`,
          duration: dur,
        };
      })
      .filter(Boolean)
      .slice(0, 10);

    return NextResponse.json({ results: results || [] });

  } catch (error: any) {
    console.error('[JET-RELATED] Error:', error.message);
    return NextResponse.json({ results: [] });
  }
}
