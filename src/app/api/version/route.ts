import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  return NextResponse.json({
    version: '4.3.2',
    build: '20260421-dual-engine',
    changelog: 'V20: Dual Engine - ReactPlayer foreground + ExoPlayer background',
    downloadUrl: 'https://jet-music.vercel.app/jet-music.apk'
  });
}
