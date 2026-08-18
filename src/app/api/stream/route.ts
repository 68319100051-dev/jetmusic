import { NextResponse } from 'next/server';
import play, { initPlayDL } from '@/lib/play-dl';
import { promises as fs, existsSync } from 'fs';
import { join } from 'path';
import { Redis } from '@upstash/redis';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Initialize Upstash Redis
const redis = new Redis({
  url: process.env.KV_REST_API_URL || '',
  token: process.env.KV_REST_API_TOKEN || '',
});

// Memory cache for the current container instance
const memoryCache = new Map<string, { url: string; expiresAt: number }>();

async function getCachedStreamUrl(videoId: string): Promise<string | null> {
  const localVal = memoryCache.get(videoId);
  if (localVal && localVal.expiresAt > Date.now()) {
    console.log(`[JET-STREAM-CACHE] Memory cache hit for: ${videoId}`);
    return localVal.url;
  }

  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    try {
      const redisVal = await redis.get<string>(`stream:url:${videoId}`);
      if (redisVal) {
        console.log(`[JET-STREAM-CACHE] Redis cache hit for: ${videoId}`);
        memoryCache.set(videoId, { url: redisVal, expiresAt: Date.now() + 60 * 60 * 1000 }); // Cache in memory for 1 hour
        return redisVal;
      }
    } catch (err: any) {
      console.warn(`[JET-STREAM-CACHE] Redis get failed:`, err.message);
    }
  }
  return null;
}

async function setCachedStreamUrl(videoId: string, url: string) {
  memoryCache.set(videoId, { url, expiresAt: Date.now() + 2 * 60 * 60 * 1000 }); // 2 hours

  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    try {
      await redis.set(`stream:url:${videoId}`, url, { ex: 2 * 60 * 60 });
      console.log(`[JET-STREAM-CACHE] Redis cache set for: ${videoId}`);
    } catch (err: any) {
      console.warn(`[JET-STREAM-CACHE] Redis set failed:`, err.message);
    }
  }
}

async function fetchWithTimeout(url: string, options: any = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      cache: 'no-store'
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

let lastSuccessfulInvidious: string | null = null;

async function validateInvidiousInstance(uri: string, videoId: string, timeout = 3000): Promise<string | null> {
  const proxyUri = `${uri}/latest_version?id=${videoId}&itag=140&local=true`;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  try {
    const testRes = await fetch(proxyUri, {
      method: 'GET',
      headers: { 
        Range: "bytes=0-99",
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      signal: controller.signal,
      cache: 'no-store'
    });
    
    if ((testRes.status === 200 || testRes.status === 206) && testRes.url) {
      const contentType = testRes.headers.get('content-type') || '';
      const isValidMime = contentType.startsWith('audio/') || 
                          contentType.startsWith('video/') || 
                          contentType === 'application/octet-stream';
      
      // ABORT immediately after receiving headers to prevent downloading the entire media file
      // if the server ignores the Range header (returns 200 OK).
      controller.abort();
      
      if (isValidMime) {
        return testRes.url;
      }
    }
  } catch (err) {
    // Ignore timeout or fetch errors
  } finally {
    clearTimeout(id);
  }
  return null;
}

async function resolveYtdlAudioUrl(videoId: string): Promise<string | null> {
  const ytdl = await import('@distube/ytdl-core');
  try {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const info = await ytdl.getInfo(url, {
      lang: 'en',
      requestOptions: {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
      }
    });
    const formats = (info.formats || []) as any[];
    const audioOnly = formats.filter((f: any) => (f.mimeType || '').startsWith('audio/') && f.url);
    const candidates = (audioOnly.length ? audioOnly : formats.filter((f: any) => f.url && (f.mimeType || '').includes('mp4a')))
      .sort((a: any, b: any) => (b.audioBitrate || 0) - (a.audioBitrate || 0));
    if (!candidates.length) return null;

    // Verify the signed URL actually streams before returning it
    for (const f of candidates) {
      const ok = await probeStreamUrl(f.url);
      if (ok) return f.url;
    }
  } catch (e: any) {
    console.warn(`[JET-STREAM] ytdl-core getInfo failed: ${e.message}`);
  }
  return null;
}

async function probeStreamUrl(streamUrl: string): Promise<boolean> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch(streamUrl, {
      headers: {
        Range: 'bytes=0-99',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      signal: controller.signal,
      cache: 'no-store'
    });
    const ok = (res.status === 200 || res.status === 206);
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (ok && (ct.startsWith('audio/') || ct.startsWith('video/') || ct === 'application/octet-stream')) {
      controller.abort();
      return true;
    }
    return false;
  } catch {
    return false;
  } finally {
    clearTimeout(id);
  }
}

async function resolveCobaltAudioUrl(videoId: string): Promise<string | null> {
  const key = process.env.COBALT_API_KEY;
  if (!key) return null;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch('https://api.cobalt.tools/api/json', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`
      },
      body: JSON.stringify({
        url: `https://www.youtube.com/watch?v=${videoId}`,
        videoQuality: '360',
        audioFormat: 'mp3',
        isAudioOnly: true,
        filenameStyle: 'basic'
      }),
      signal: controller.signal,
      cache: 'no-store'
    });
    if (!res.ok) {
      console.warn(`[JET-STREAM] Cobalt HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return null;
    }
    const data: any = await res.json();
    if (data.status === 'redirect' || data.status === 'tunnel') {
      if (data.url && await probeStreamUrl(data.url)) {
        return data.url;
      }
      return data.url || null;
    }
    if (data.status === 'picker' && data.picker) {
      const first = Object.values(data.picker)[0] as any;
      if (first?.url) return first.url;
    }
    if (data.status === 'error') {
      console.warn(`[JET-STREAM] Cobalt error: ${JSON.stringify(data.error)}`);
    }
  } catch (e: any) {
    console.warn(`[JET-STREAM] Cobalt request failed: ${e.message}`);
  } finally {
    clearTimeout(id);
  }
  return null;
}

async function getUnifiedStreamUrl(videoId: string, errors: string[]): Promise<string | null> {
  // --- 0. Cobalt API (preferred, bypasses YouTube bot-block on Vercel IPs) ---
  if (process.env.COBALT_API_KEY) {
    console.log('[JET-STREAM] Cobalt API key detected, trying Cobalt first...');
    try {
      const cobaltUrl = await resolveCobaltAudioUrl(videoId);
      if (cobaltUrl) {
        console.log(`[JET-STREAM] ✅ Cobalt direct URL: ${cobaltUrl.slice(0, 60)}...`);
        return cobaltUrl;
      }
      console.warn('[JET-STREAM] Cobalt failed, falling through');
    } catch (err: any) {
      errors.push(`cobalt: ${err.message}`);
    }
  }

  // --- 1. @distube/ytdl-core (direct googlevideo URLs) ---
  // ytdl-core returns real, signed videoplayback URLs that play in ExoPlayer/browser
  // and is more resilient to YouTube bot detection than Invidious/Piped mirrors.
  try {
    const ytdlUrl = await resolveYtdlAudioUrl(videoId);
    if (ytdlUrl) {
      console.log(`[JET-STREAM] ✅ ytdl-core direct URL: ${ytdlUrl.slice(0, 60)}...`);
      return ytdlUrl;
    }
    console.warn('[JET-STREAM] ytdl-core failed, falling through to mirrors');
  } catch (err: any) {
    errors.push(`ytdl-core: ${err.message}`);
  }

  // --- 1. Sticky Invidious Instance Check (Near-Instant Resolution) ---
  if (lastSuccessfulInvidious) {
    try {
      console.log(`[JET-STREAM] Testing sticky Invidious instance: ${lastSuccessfulInvidious}`);
      const url = await validateInvidiousInstance(lastSuccessfulInvidious, videoId, 2500);
      if (url) {
        console.log(`[JET-STREAM] ⚡ Sticky Invidious hit: ${lastSuccessfulInvidious}`);
        return url;
      }
      console.warn(`[JET-STREAM] Sticky Invidious failed validation, clearing: ${lastSuccessfulInvidious}`);
      lastSuccessfulInvidious = null;
    } catch (err: any) {
      console.warn(`[JET-STREAM] Sticky Invidious error, clearing: ${lastSuccessfulInvidious}`, err.message);
      lastSuccessfulInvidious = null;
    }
  }

  const staticInvidious = [
    'https://inv.thepixora.com',
    'https://invidious.nerdvpn.de',
    'https://invidious.reallyryangamer.xyz',
    'https://invidious.no-logs.com',
    'https://invidious.projectsegfau.lt',
    'https://invidious.privacydev.net',
    'https://invidious.lunar.icu',
    'https://invidious.io.lol',
    'https://invidious.tiekoetter.com',
    'https://invidious.f5.si',
    'https://invidious.flokinet.to',
    'https://invidious.perennialte.ch',
    'https://iv.melmac.space'
  ];

  // --- 1. Stage A: Race Top 5 Static Instances (Low Latency) ---
  try {
    const topStatic = staticInvidious.slice(0, 5);
    console.log(`[JET-STREAM] Stage A: Racing ${topStatic.length} top static Invidious instances in parallel (3s timeout)...`);
    const staticPromises = topStatic.map(async (uri: string) => {
      const url = await validateInvidiousInstance(uri, videoId, 3000);
      if (url) return { url, uri };
      throw new Error(`Validation failed on ${uri}`);
    });

    const winner = await Promise.any(staticPromises);
    console.log(`[JET-STREAM] ✅ Stage A winner: ${winner.uri}`);
    lastSuccessfulInvidious = winner.uri;
    return winner.url;
  } catch (raceErr: any) {
    errors.push(`Stage A static racing failed: ${raceErr.message}`);
  }

  // --- 2. Stage B: Race Remaining Static + Dynamic Instances (Full Backup) ---
  try {
    console.log("[JET-STREAM] Stage B: Querying Invidious Dynamic List...");
    let dynamicURIs: string[] = [];
    try {
      const invListRes = await fetchWithTimeout("https://api.invidious.io/instances.json?sort_by=api,type", {}, 2500);
      if (invListRes.ok) {
        const instances = await invListRes.json();
        dynamicURIs = instances
          .filter((ins: any) => ins[1].type === 'https' && (!ins[1].monitor || (ins[1].monitor.uptime > 80 && !ins[1].monitor.down)))
          .map((ins: any) => ins[1].uri);
      }
    } catch (err: any) {
      console.warn("[JET-STREAM] Failed to fetch dynamic Invidious list:", err.message);
    }

    const remainingStatic = staticInvidious.slice(5);
    const activeURIs = Array.from(new Set([...remainingStatic, ...dynamicURIs]));
    console.log(`[JET-STREAM] Stage B: Racing ${activeURIs.length} remaining Invidious instances in parallel (6s timeout)...`);
    
    const promises = activeURIs.slice(0, 18).map(async (uri: string) => {
      const url = await validateInvidiousInstance(uri, videoId, 6000);
      if (url) return { url, uri };
      throw new Error(`Validation failed on ${uri}`);
    });
    
    const winner = await Promise.any(promises);
    console.log(`[JET-STREAM] ✅ Stage B winner: ${winner.uri}`);
    lastSuccessfulInvidious = winner.uri;
    return winner.url;
  } catch (raceErr: any) {
    errors.push(`Stage B dynamic racing failed: ${raceErr.message}`);
  }

  // --- 2. Piped Dynamic List Racing (Second Priority) ---
  try {
    console.log("[JET-STREAM] Querying Piped Dynamic List...");
    const res = await fetchWithTimeout("https://raw.githubusercontent.com/TeamPiped/documentation/main/content/docs/public-instances/index.md", {}, 3000);
    if (res.ok) {
      const md = await res.text();
      const matches = md.match(/https?:\/\/[^\s|]*piped[^\s|]+/gi) || [];
      const uris = Array.from(new Set(matches.map(u => u.trim().replace(/\)$/, ''))))
        .filter(u => u.includes('piped') && !u.endsWith('/badge') && !u.includes('#') && !u.includes(')') && u.startsWith('https://'));
      
      console.log(`[JET-STREAM] Racing ${uris.length} dynamic Piped instances in parallel...`);
      const targetUris = uris.slice(0, 15);
      const promises = targetUris.map(async (base: string) => {
        const streamRes = await fetchWithTimeout(`${base}/streams/${videoId}`, {}, 8000);
        if (!streamRes.ok) throw new Error(`HTTP ${streamRes.status}`);
        const data = await streamRes.json();
        const audioStreams = data.audioStreams || [];
        const videoStreams = data.videoStreams || [];
        
        let targetStreams = [];
        const m4aStreams = audioStreams.filter((s: any) => s.mimeType?.includes('audio/mp4') || s.mimeType?.includes('mp4a'));
        
        if (m4aStreams.length > 0) {
          targetStreams = m4aStreams;
        } else if (audioStreams.length > 0) {
          targetStreams = audioStreams;
        } else {
          targetStreams = videoStreams.filter((v: any) => v.mimeType?.includes('video/mp4') && v.videoOnly === false);
        }
        
        if (targetStreams.length === 0) throw new Error("No compatible audio or video streams found");
        const best = targetStreams.sort((a: any, b: any) => parseInt(b.bitrate || '0') - parseInt(a.bitrate || '0'))[0];
        if (!best?.url) throw new Error("No URL in best stream");
        return { url: best.url, base };
      });
      
      try {
        const winner = await Promise.any(promises);
        console.log(`[JET-STREAM] ✅ Piped racing winner: ${winner.base}`);
        return winner.url;
      } catch (raceErr: any) {
        errors.push(`Piped dynamic racing failed: ${raceErr.message}`);
      }
    }
  } catch (err: any) {
    errors.push(`Piped dynamic setup error: ${err.message}`);
  }

  // --- 3. Common Static Backups (Last Resort) ---
  const PIPED_BACKUPS = [
    'https://api.piped.private.coffee',
    'https://pipedapi.orangenet.cc',
    'https://pipedapi.darkness.services'
  ];
  console.log("[JET-STREAM] Testing static Piped backups...");
  const staticPromises = PIPED_BACKUPS.map(async (base: string) => {
    const streamRes = await fetchWithTimeout(`${base}/streams/${videoId}`, {}, 6000);
    if (!streamRes.ok) throw new Error(`HTTP ${streamRes.status}`);
    const data = await streamRes.json();
    const audioStreams = data.audioStreams || [];
    const videoStreams = data.videoStreams || [];
    
    let targetStreams = [];
    const m4aStreams = audioStreams.filter((s: any) => s.mimeType?.includes('audio/mp4') || s.mimeType?.includes('mp4a'));
    
    if (m4aStreams.length > 0) {
      targetStreams = m4aStreams;
    } else if (audioStreams.length > 0) {
      targetStreams = audioStreams;
    } else {
      targetStreams = videoStreams.filter((v: any) => v.mimeType?.includes('video/mp4') && v.videoOnly === false);
    }
    
    if (targetStreams.length === 0) throw new Error("No compatible streams found");
    const best = targetStreams.sort((a: any, b: any) => parseInt(b.bitrate || '0') - parseInt(a.bitrate || '0'))[0];
    if (!best?.url) throw new Error("No URL");
    return { url: best.url, base };
  });
  
  try {
    const winner = await Promise.any(staticPromises);
    console.log(`[JET-STREAM] ✅ Static backup racing winner: ${winner.base}`);
    return winner.url;
  } catch (raceErr: any) {
    errors.push(`Static backup racing failed: ${raceErr.message}`);
  }

  return null;
}

function sliceStream(readableStream: ReadableStream<Uint8Array>, start: number, end: number): ReadableStream<Uint8Array> {
  const reader = readableStream.getReader();
  let bytesRead = 0;
  let finished = false;

  return new ReadableStream({
    async pull(controller) {
      if (finished) return;
      try {
        const { done, value } = await reader.read();
        if (done) {
          finished = true;
          controller.close();
          return;
        }

        const chunkLength = value.length;
        const chunkStart = bytesRead;
        const chunkEnd = bytesRead + chunkLength - 1;

        bytesRead += chunkLength;

        const overlapStart = Math.max(start, chunkStart);
        const overlapEnd = Math.min(end, chunkEnd);

        if (overlapStart <= overlapEnd) {
          const relativeStart = overlapStart - chunkStart;
          const relativeEnd = overlapEnd - chunkStart + 1;
          const slicedValue = value.subarray(relativeStart, relativeEnd);
          controller.enqueue(slicedValue);
        }

        if (bytesRead > end) {
          finished = true;
          controller.close();
          reader.cancel("Range fully satisfied").catch(() => {});
        }
      } catch (err) {
        if (!finished) {
          finished = true;
          controller.error(err);
        }
      }
    },
    cancel(reason) {
      finished = true;
      reader.cancel(reason).catch(() => {});
    }
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const fmt = searchParams.get('fmt');

  if (!id) return new NextResponse('Missing ID', { status: 400 });

  const isYouTube = id.includes('youtube.com') || id.includes('youtu.be') || /^[a-zA-Z0-9_-]{11}$/.test(id);
  
  // Extract bare YouTube video ID from URL or use id directly for SC
  let bareId = id;
  if (isYouTube) {
    const ytMatch = id.match(/(?:v=|\/|embed\/|youtu\.be\/)([0-9A-Za-z_-]{11})/);
    if (ytMatch) bareId = ytMatch[1];
  } else {
    // For SoundCloud, sanitize the ID to make it a safe filename
    bareId = id.replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  // 1. Return direct CDN URL JSON for native ExoPlayer (fmt=json)
  // We resolve the actual direct URL so ExoPlayer can stream without Vercel timeout limits.
  if (fmt === 'json') {
    const host = request.headers.get('host') || 'jet-music.vercel.app';
    const proto = request.headers.get('x-forwarded-proto') || 'https';
    const selfBaseUrl = `${proto}://${host}`;
    const proxyUrl = `${selfBaseUrl}/api/stream?id=${encodeURIComponent(id)}`;

    try {
      // Check cache first for fast response
      let cachedUrl = await getCachedStreamUrl(bareId);
      if (cachedUrl) {
        console.log(`[JET-STREAM] fmt=json cache hit for: ${bareId}`);
        return NextResponse.json({ url: cachedUrl, proxy: proxyUrl });
      }

      // Resolve fresh direct URL
      console.log(`[JET-STREAM] fmt=json resolving direct URL for: ${bareId}`);
      let directUrl: string | null = null;
      const diagnosticErrors: string[] = [];

      if (isYouTube) {
        directUrl = await getUnifiedStreamUrl(bareId, diagnosticErrors);
      }

      if (!directUrl) {
        try {
          await initPlayDL();
          let streamInfo = await play.stream(id, { quality: 2 }).catch(() => play.stream(id));
          if ((streamInfo as any).url) directUrl = (streamInfo as any).url;
        } catch (playDlErr: any) {
          diagnosticErrors.push(`play-dl: ${playDlErr.message}`);
        }
      }

      if (directUrl) {
        await setCachedStreamUrl(bareId, directUrl);
        console.log(`[JET-STREAM] fmt=json resolved direct URL for: ${bareId}`);
        return NextResponse.json({ url: directUrl, proxy: proxyUrl });
      }

      // Fallback to proxy URL if we can't resolve a direct URL
      console.warn(`[JET-STREAM] fmt=json failed to resolve direct URL, falling back to proxy. Errors: ${diagnosticErrors.join(' | ')}`);
      return NextResponse.json({ url: proxyUrl });
    } catch (err: any) {
      console.error(`[JET-STREAM] fmt=json error: ${err.message}`);
      return NextResponse.json({ url: proxyUrl });
    }
  }

  try {
    const tempFilePath = join('/tmp', `${bareId}.mp3`);

    // 2. Serve from local cache if file is already fully cached
    if (existsSync(tempFilePath)) {
      console.log(`[JET-STREAM-CACHE] Local disk cache hit for: ${bareId}`);
      const stats = await fs.stat(tempFilePath);
      const totalSize = stats.size;
      const rangeHeader = request.headers.get('Range');
      const responseHeaders = new Headers({
        'Accept-Ranges': 'bytes',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Cache-Control': 'public, max-age=31536000, immutable'
      });

      if (rangeHeader) {
        const parts = rangeHeader.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;
        const chunksize = (end - start) + 1;

        responseHeaders.set('Content-Range', `bytes ${start}-${end}/${totalSize}`);
        responseHeaders.set('Content-Length', chunksize.toString());
        responseHeaders.set('Content-Type', 'audio/mpeg');

        const fileHandle = await fs.open(tempFilePath, 'r');
        try {
          const buffer = Buffer.alloc(chunksize);
          await fileHandle.read(buffer, 0, chunksize, start);
          return new Response(buffer, {
            status: 206,
            statusText: 'Partial Content',
            headers: responseHeaders
          });
        } finally {
          await fileHandle.close();
        }
      } else {
        responseHeaders.set('Content-Length', totalSize.toString());
        responseHeaders.set('Content-Type', 'audio/mpeg');
        const buffer = await fs.readFile(tempFilePath);
        return new Response(buffer, { status: 200, headers: responseHeaders });
      }
    }

    // 3. Cache Miss / Cache Hit verification: Get or resolve the stream URL
    console.log(`[JET-STREAM] Cache check for: ${bareId}`);
    let streamUrl = await getCachedStreamUrl(bareId);
    let fromCache = !!streamUrl;

    let upstreamRes: Response | null = null;
    let attempts = 0;

    while (attempts < 2) {
      if (!streamUrl) {
        console.log(`[JET-STREAM] Resolver cache miss. Resolving URL...`);
        const diagnosticErrors: string[] = [];
        if (isYouTube) {
          // Query Invidious and Piped dynamically
          streamUrl = await getUnifiedStreamUrl(bareId, diagnosticErrors);
        }

        if (!streamUrl) {
          console.warn(`[JET-STREAM] Primary resolution failed, trying play-dl fallback...`);
          try {
            await initPlayDL();
            let streamInfo = await play.stream(id, { quality: 2 }).catch(() => play.stream(id));
            if ((streamInfo as any).url) {
              streamUrl = (streamInfo as any).url;
            }
          } catch (playDlErr: any) {
            diagnosticErrors.push(`play-dl error: ${playDlErr.message}`);
          }
        }

        if (!streamUrl) {
          throw new Error(diagnosticErrors.join(' | '));
        }

        // Cache the newly resolved stream URL
        await setCachedStreamUrl(bareId, streamUrl);
        fromCache = false;
      }

      // 4. Proxy the Range Request to the Upstream Stream URL on-the-fly!
      console.log(`[JET-STREAM] Proxying stream request (attempt ${attempts + 1}) to upstream: ${streamUrl}`);
      const rangeHeader = request.headers.get('Range');
      const fetchHeaders: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      };
      if (rangeHeader) {
        fetchHeaders['Range'] = rangeHeader;
      }

      try {
        const res = await fetch(streamUrl, {
          headers: fetchHeaders,
          signal: AbortSignal.timeout(10000)
        });

        const contentType = res.headers.get('content-type') || '';
        const isHtmlOrText = contentType.includes('text/html') || contentType.includes('text/plain');
        const contentLengthStr = res.headers.get('content-length');
        const contentLength = contentLengthStr ? parseInt(contentLengthStr, 10) : -1;
        const isLengthZero = contentLength === 0;
        const isBodyInvalid = isHtmlOrText || isLengthZero || (contentLength > 0 && contentLength < 2000);

        // If the URL is invalid/expired/blocked, invalidate cache and try resolving fresh.
        if ((!res.ok || isBodyInvalid) && fromCache) {
          console.warn(`[JET-STREAM] Cached URL is invalid (HTTP ${res.status}, Type ${contentType}, Length ${contentLength}). Invalidating cache and retrying...`);
          
          // Clear cache
          memoryCache.delete(bareId);
          if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
            await redis.del(`stream:url:${bareId}`).catch(() => {});
          }
          
          streamUrl = null;
          attempts++;
          continue;
        }

        if (!res.ok) {
          throw new Error(`Upstream returned HTTP ${res.status}`);
        }
        if (isBodyInvalid) {
          throw new Error(`Upstream returned invalid body (Type ${contentType}, Length ${contentLength})`);
        }

        upstreamRes = res;
        break;
      } catch (err: any) {
        if (fromCache) {
          console.warn(`[JET-STREAM] Fetch to cached URL failed: ${err.message}. Retrying with fresh URL...`);
          
          // Clear cache
          memoryCache.delete(bareId);
          if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
            await redis.del(`stream:url:${bareId}`).catch(() => {});
          }
          
          streamUrl = null;
          attempts++;
          continue;
        }
        throw err;
      }
    }

    if (!upstreamRes) {
      throw new Error("Failed to get response from upstream");
    }

    const responseHeaders = new Headers({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Accept-Ranges': 'bytes'
    });

    const contentType = upstreamRes.headers.get('content-type');
    if (contentType) responseHeaders.set('Content-Type', contentType);

    const upstreamStatus = upstreamRes.status;
    const rangeHeader = request.headers.get('Range');
    const isRangeRequested = !!rangeHeader;

    // If client requested a Range but upstream returned 200 OK (e.g. Cobalt tunnel URL),
    // we slice the stream on-the-fly to return 206 Partial Content!
    if (isRangeRequested && upstreamStatus === 200) {
      const totalSize = parseInt(upstreamRes.headers.get('content-length') || '0');
      
      const parts = rangeHeader.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : (totalSize ? totalSize - 1 : 0);
      const chunksize = (end - start) + 1;

      responseHeaders.set('Content-Range', `bytes ${start}-${end}/${totalSize || '*'}`);
      responseHeaders.set('Content-Length', chunksize.toString());

      console.log(`[JET-STREAM] Upstream returned 200. Slicing range: bytes ${start}-${end}/${totalSize || '*'}`);

      if (!upstreamRes.body) {
        return new Response('', { status: 206, headers: responseHeaders });
      }

      const slicedStream = sliceStream(upstreamRes.body, start, end);
      return new Response(slicedStream, {
        status: 206,
        statusText: 'Partial Content',
        headers: responseHeaders
      });
    }

    const contentRange = upstreamRes.headers.get('content-range');
    if (contentRange) responseHeaders.set('Content-Range', contentRange);

    const contentLength = upstreamRes.headers.get('content-length');
    if (contentLength) responseHeaders.set('Content-Length', contentLength);

    return new Response(upstreamRes.body, {
      status: upstreamRes.status,
      statusText: upstreamRes.statusText,
      headers: responseHeaders
    });

  } catch (error: any) {
    console.error('[JET-STREAM] !!! FINAL ERROR:', error.message);
    return NextResponse.json(
      { error: 'Stream Failed', details: error.message },
      { status: 500 }
    );
  }
}
