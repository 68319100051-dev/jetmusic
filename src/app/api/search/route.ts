import { NextResponse } from 'next/server';

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const YOUTUBE_SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search';
const YOUTUBE_VIDEOS_URL = 'https://www.googleapis.com/youtube/v3/videos';

const blacklist = ['รวมเพลง', 'เมดเล่ย์', 'top 20', 'top 50', 'top 100', 'best of', 'full album', 'long mix', 'non stop', 'ต่อเนื่อง'];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');

  if (!q) {
    return NextResponse.json({ error: 'Query required' }, { status: 400 });
  }

  if (!YOUTUBE_API_KEY) {
    return NextResponse.json({ error: 'YouTube API Key not configured' }, { status: 500 });
  }

  try {
    // Step 1: Search for videos
    const searchRes = await fetch(
      `${YOUTUBE_SEARCH_URL}?part=snippet&q=${encodeURIComponent(q)}&type=video&videoCategoryId=10&maxResults=30&regionCode=TH&relevanceLanguage=th&key=${YOUTUBE_API_KEY}`
    );

    if (!searchRes.ok) {
      const errData = await searchRes.json();
      console.error('YouTube Search API Error:', errData);
      return NextResponse.json({ error: 'YouTube API error', details: errData }, { status: searchRes.status });
    }

    const searchData = await searchRes.json();
    const videoIds = searchData.items?.map((item: any) => item.id.videoId).filter(Boolean).join(',');

    if (!videoIds) {
      return NextResponse.json({ results: [] });
    }

    // Step 2: Get video details (duration, etc.)
    const detailsRes = await fetch(
      `${YOUTUBE_VIDEOS_URL}?part=contentDetails,snippet&id=${videoIds}&key=${YOUTUBE_API_KEY}`
    );

    const detailsData = await detailsRes.json();

    // Parse ISO 8601 duration to seconds (PT3M45S → 225)
    const parseDuration = (iso: string): number => {
      const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
      if (!match) return 0;
      const h = parseInt(match[1] || '0');
      const m = parseInt(match[2] || '0');
      const s = parseInt(match[3] || '0');
      return h * 3600 + m * 60 + s;
    };

    const results = detailsData.items
      ?.map((item: any) => {
        const duration = parseDuration(item.contentDetails?.duration || '');
        const title = item.snippet?.title || '';
        const titleLower = title.toLowerCase();
        const mins = duration / 60;

        // Filter: blacklist words and duration 1-10 minutes
        if (blacklist.some(w => titleLower.includes(w))) return null;
        if (mins < 1.0 || mins > 10.0) return null;

        return {
          id: item.id,
          title: title,
          artist: item.snippet?.channelTitle || 'Unknown Artist',
          coverUrl: item.snippet?.thumbnails?.medium?.url || `https://i.ytimg.com/vi/${item.id}/mqdefault.jpg`,
          audioSrc: `https://www.youtube.com/watch?v=${item.id}`,
          duration: duration,
        };
      })
      .filter(Boolean)
      .slice(0, 24);

    return NextResponse.json({ results });

  } catch (error: any) {
    console.error('Search API Critical Error:', error);
    return NextResponse.json({ error: 'Search failed', details: error?.message }, { status: 500 });
  }
}
