import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  return NextResponse.json({
    version: '4.3.4',
    latestVersion: '4.3.4',
    build: '20260818-mainthread',
    changelog: 'V22: Fix wrong-thread crash - all ExoPlayer calls on main thread',
    releaseNotes: 'Fix crash หลัก: ExoPlayer ต้องเรียกบน main thread (pause/getStatus ชนทุกครั้งเดิม); แก้แล้วทุก method',
    downloadUrl: 'https://jet-music.vercel.app/jet-music-test.apk'
  });
}
