import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

export const dynamic = 'force-dynamic';

const redis = new Redis({
  url: process.env.KV_REST_API_URL || '',
  token: process.env.KV_REST_API_TOKEN || '',
});

const KEY = 'crash:reports';
const MAX = 20;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const content = typeof body?.content === 'string' ? body.content.slice(0, 20000) : '';
    if (!content.trim()) {
      return NextResponse.json({ ok: false, reason: 'empty' }, { status: 400 });
    }
    const report = {
      t: new Date().toISOString(),
      device: String(body?.device || ''),
      appVersion: String(body?.appVersion || ''),
      content,
    };
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      await redis.lpush(KEY, JSON.stringify(report));
      await redis.ltrim(KEY, 0, MAX - 1);
      await redis.expire(KEY, 60 * 60 * 24 * 7);
    } else {
      console.log('[CRASH-REPORT] (no KV configured) ' + JSON.stringify(report));
    }
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, reason: err?.message || 'error' }, { status: 500 });
  }
}

export async function GET() {
  try {
    let reports: string[] = [];
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      reports = await redis.lrange(KEY, 0, MAX - 1);
    }
    const parsed = reports.map((r) => {
      try {
        return JSON.parse(r);
      } catch {
        return { content: r };
      }
    });
    return NextResponse.json({ count: parsed.length, reports: parsed });
  } catch (err: any) {
    return NextResponse.json({ ok: false, reason: err?.message || 'error' }, { status: 500 });
  }
}
