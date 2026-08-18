import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  return NextResponse.json({
    version: '4.3.3',
    latestVersion: '4.3.3',
    build: '20260818-crashguard',
    changelog: 'V21: CrashGuard - catch native crashes + debug crash log',
    releaseNotes: 'CrashGuard: จับ crash ตอนเปิดเพลงแล้วเก็บ crash log; เพิ่มปุ่มดู crash log ใน debug overlay',
    downloadUrl: 'https://jet-music.vercel.app/jet-music-test.apk'
  });
}
