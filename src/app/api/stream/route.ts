import { NextResponse } from 'next/server';
import play, { initPlayDL } from '@/lib/play-dl';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const t0 = Date.now();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) return new NextResponse('Missing ID', { status: 400 });

  const isYouTube = id.includes('youtube.com') || id.includes('youtu.be');
  console.log(`[JET-STREAM-V3] >>> STARTED [${isYouTube ? 'YT' : 'SC'}]: ${id.slice(0, 80)}`);

  try {
    await initPlayDL();
    
    // We attempt to get a direct high-quality audio stream
    // This allows using <audio> tag on mobile which works in background
    let streamInfo;
    try {
      streamInfo = await play.stream(id, { quality: 2 });
    } catch (err) {
      console.log("[JET-STREAM] Direct stream failed, falling back to basic stream");
      streamInfo = await play.stream(id);
    }

    const stream = streamInfo.stream;
    const t = streamInfo.type as string;
    const contentType = (t === 'opus' || t === 'webm/opus' || t === 'ogg/opus') ? 'audio/webm' : 'audio/mpeg';

    const webStream = new ReadableStream({
      start(controller) {
        stream.on('data', (chunk: Buffer) => controller.enqueue(chunk));
        stream.on('end', () => controller.close());
        stream.on('error', (err: Error) => {
          console.error('[JET-STREAM] Error:', err.message);
          controller.error(err);
        });
      },
      cancel() {
        if (typeof stream.destroy === 'function') stream.destroy();
      }
    });

    return new Response(webStream, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600',
        'Connection': 'keep-alive',
        'Accept-Ranges': 'bytes',
      }
    });

  } catch (error: any) {
    console.error('[JET-STREAM] !!! FINAL ERROR:', error.message);
    // If all stream attempts fail, redirect to the ID as last resort (Legacy behavior)
    return NextResponse.redirect(id, { status: 302 });
  }
}
