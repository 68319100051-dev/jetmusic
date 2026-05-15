import { NextResponse } from 'next/server';
import play, { initPlayDL } from '@/lib/play-dl';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Public Invidious instances as fallback when play-dl is blocked on Vercel
const INVIDIOUS_INSTANCES = [
  'https://invidious.nerdvpn.de',
  'https://inv.nadeko.net',
  'https://invidious.privacydev.net',
];

async function getInvidiousUrl(videoId: string): Promise<string | null> {
  for (const base of INVIDIOUS_INSTANCES) {
    try {
      const res = await fetch(`${base}/api/v1/videos/${videoId}`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) continue;

      const data = await res.json();
      const audioStreams: any[] = data.adaptiveFormats?.filter((f: any) =>
        f.type?.startsWith('audio/')
      ) || [];

      if (audioStreams.length === 0) continue;

      // Pick best quality audio stream
      const best = audioStreams.sort(
        (a, b) => parseInt(b.bitrate || '0') - parseInt(a.bitrate || '0')
      )[0];

      if (best?.url) {
        console.log(`[JET-STREAM] ✅ Invidious fallback OK (${base})`);
        return best.url;
      }
    } catch (e: any) {
      console.warn(`[JET-STREAM] Invidious ${base} failed: ${e.message}`);
    }
  }
  return null;
}

export async function GET(request: Request) {
  const t0 = Date.now();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const fmt = searchParams.get('fmt');

  if (!id) return new NextResponse('Missing ID', { status: 400 });

  const isYouTube = id.includes('youtube.com') || id.includes('youtu.be');
  console.log(`[JET-STREAM-V4] >>> STARTED [${isYouTube ? 'YT' : 'SC'}]: ${id.slice(0, 80)}`);

  // Extract bare YouTube video ID from URL
  let bareId = id;
  const ytMatch = id.match(/(?:v=|\/|embed\/|youtu\.be\/)([0-9A-Za-z_-]{11})/);
  if (ytMatch) bareId = ytMatch[1];

  try {
    // ── Primary: play-dl ──────────────────────────────────────────────
    try {
      await initPlayDL();
      let streamInfo;
      try {
        streamInfo = await play.stream(id, { quality: 2 });
      } catch {
        streamInfo = await play.stream(id);
      }

      if ((streamInfo as any).url) {
        const directUrl = (streamInfo as any).url;
        console.log(`[JET-STREAM] play-dl OK (${Date.now() - t0}ms)`);

        if (fmt === 'json') {
          return NextResponse.json({ url: directUrl });
        }
        return NextResponse.redirect(directUrl, { status: 302 });
      }
    } catch (playDlErr: any) {
      console.warn(`[JET-STREAM] play-dl failed: ${playDlErr.message} — trying Invidious...`);
    }

    // ── Fallback: Invidious (YouTube only) ───────────────────────────
    if (isYouTube) {
      const invUrl = await getInvidiousUrl(bareId);
      if (invUrl) {
        if (fmt === 'json') {
          return NextResponse.json({ url: invUrl });
        }
        return NextResponse.redirect(invUrl, { status: 302 });
      }
    }

    throw new Error('All stream sources exhausted');

  } catch (error: any) {
    console.error('[JET-STREAM] !!! FINAL ERROR:', error.message);
    return NextResponse.json(
      { error: 'Stream Failed', details: error.message },
      { status: 500 }
    );
  }
}
