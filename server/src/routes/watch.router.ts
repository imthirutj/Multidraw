import { Router, Request, Response } from 'express';
import * as cheerio from 'cheerio';
import dns from 'dns/promises';
import net from 'net';
import { Readable } from 'node:stream';

const router = Router();

type ExtractedVideo = {
    url: string;
    label?: string;
    source?: 'video' | 'source' | 'meta' | 'link';
    thumbnailUrl?: string;
    durationSec?: number;
};

function isValidHttpUrl(raw: string): boolean {
    try {
        const u = new URL(raw);
        return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
        return false;
    }
}

function isProbablyVideoUrl(url: string): boolean {
    const u = url.toLowerCase();
    return (
        u.includes('.mp4') ||
        u.includes('.webm') ||
        u.includes('.ogg') ||
        u.includes('.mov') ||
        u.includes('.m4v') ||
        u.includes('.ts') ||
        u.includes('.m3u8') ||
        u.includes('.mpd')
    );
}

function extractAllUrlsFromText(text: string): string[] {
    // Best-effort "sniffing" from raw HTML/JS (not as powerful as IDM).
    const results: string[] = [];
    const re = /((?:https?:)?\/\/[^\s"'<>\\]+?\.(?:mp4|webm|ogg|mov|m4v|m3u8|mpd|ts)(?:\?[^\s"'<>\\]*)?)/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
        results.push(m[1]);
        if (results.length > 400) break;
    }
    return results;
}

function normalizeMaybeProtocolRelative(raw: string, base: URL): string {
    if (raw.startsWith('//')) return `${base.protocol}${raw}`;
    return raw;
}

function parseIso8601DurationToSeconds(input: string): number | null {
    // e.g. PT1H2M3S, PT3M, PT45S
    const s = input.trim().toUpperCase();
    const m = /^P(T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)$/.exec(s);
    if (!m) return null;
    const h = m[2] ? Number(m[2]) : 0;
    const min = m[3] ? Number(m[3]) : 0;
    const sec = m[4] ? Number(m[4]) : 0;
    const total = h * 3600 + min * 60 + sec;
    return Number.isFinite(total) ? total : null;
}

function parseDurationToSeconds(val: unknown): number | null {
    if (val === null || val === undefined) return null;
    if (typeof val === 'number') return Number.isFinite(val) ? Math.max(0, Math.floor(val)) : null;
    if (typeof val !== 'string') return null;
    const s = val.trim();
    if (!s) return null;
    if (/^\d+$/.test(s)) return Math.max(0, Number(s));
    const iso = parseIso8601DurationToSeconds(s);
    if (iso !== null) return iso;
    // "HH:MM:SS" or "MM:SS"
    const parts = s.split(':').map(p => p.trim());
    if (parts.length === 2 || parts.length === 3) {
        const nums = parts.map(n => Number(n));
        if (nums.some(n => !Number.isFinite(n))) return null;
        const [a, b, c] = nums;
        const total = parts.length === 2 ? (a * 60 + b) : (a * 3600 + b * 60 + c);
        return Math.max(0, Math.floor(total));
    }
    return null;
}

function isPrivateIp(ip: string): boolean {
    // IPv4
    if (ip.includes('.')) {
        const parts = ip.split('.').map(n => Number(n));
        if (parts.length !== 4 || parts.some(n => Number.isNaN(n) || n < 0 || n > 255)) return true;
        const [a, b] = parts;
        if (a === 10) return true;
        if (a === 127) return true;
        if (a === 0) return true;
        if (a === 169 && b === 254) return true;
        if (a === 172 && b >= 16 && b <= 31) return true;
        if (a === 192 && b === 168) return true;
        return false;
    }

    // IPv6 (very conservative)
    const norm = ip.toLowerCase();
    if (norm === '::1') return true;
    if (norm.startsWith('fc') || norm.startsWith('fd')) return true; // ULA
    if (norm.startsWith('fe80')) return true; // link-local
    return false;
}

async function assertSafeRemoteUrl(pageUrl: URL): Promise<void> {
    const host = pageUrl.hostname;
    if (!host) throw new Error('Invalid host');
    if (host === 'localhost') throw new Error('Blocked host');
    if (host.endsWith('.local')) throw new Error('Blocked host');

    // If hostname is already an IP, validate directly.
    const ipType = net.isIP(host);
    if (ipType) {
        if (isPrivateIp(host)) throw new Error('Blocked IP');
        return;
    }

    // Resolve DNS and block private ranges to reduce SSRF risk.
    const results = await dns.lookup(host, { all: true });
    if (!results.length) throw new Error('DNS lookup failed');
    for (const r of results) {
        if (net.isIP(r.address) && isPrivateIp(r.address)) {
            throw new Error('Blocked IP');
        }
    }
}

async function fetchHtmlWithLimit(url: string, maxBytes: number, timeoutMs: number): Promise<string> {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, {
            signal: controller.signal,
            headers: {
                'user-agent': 'MultiDraw/1.0 (WatchTogether extractor)',
                'accept': 'text/html,application/xhtml+xml',
            },
        });
        if (!res.ok) throw new Error(`Fetch failed (${res.status})`);
        const ct = res.headers.get('content-type') || '';
        if (!ct.includes('text/html') && !ct.includes('application/xhtml+xml')) {
            throw new Error('URL did not return HTML');
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error('No response body');
        const chunks: Uint8Array[] = [];
        let total = 0;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (!value) continue;
            total += value.byteLength;
            if (total > maxBytes) throw new Error('HTML too large');
            chunks.push(value);
        }

        const buf = Buffer.concat(chunks);
        return buf.toString('utf-8');
    } finally {
        clearTimeout(t);
    }
}

function uniqByUrl(items: ExtractedVideo[]): ExtractedVideo[] {
    const seen = new Set<string>();
    const out: ExtractedVideo[] = [];
    for (const it of items) {
        const key = it.url;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(it);
    }
    return out;
}

router.get('/extract', async (req: Request, res: Response) => {
    try {
        const raw = String(req.query.url || '').trim();
        if (!isValidHttpUrl(raw)) return res.status(400).json({ error: 'Invalid url' });

        const pageUrl = new URL(raw);
        await assertSafeRemoteUrl(pageUrl);

        const html = await fetchHtmlWithLimit(pageUrl.toString(), 2_000_000, 8_000);
        const $ = cheerio.load(html);

        const found: ExtractedVideo[] = [];
        const tasks: Promise<void>[] = [];

        const add = (src: string | undefined, meta?: Omit<ExtractedVideo, 'url'>) => {
            if (!src) return;
            tasks.push((async () => {
                const trimmed = src.trim();
                if (!trimmed) return;
                const normalized = normalizeMaybeProtocolRelative(trimmed, pageUrl);
                const abs = new URL(normalized, pageUrl).toString();
                if (!isValidHttpUrl(abs)) return;
                if (!isProbablyVideoUrl(abs)) return;
                await assertSafeRemoteUrl(new URL(abs));
                found.push({ url: abs, ...meta });
            })());
        };

        const pageThumbRaw =
            $('meta[property="og:image"]').attr('content')
            || $('meta[name="twitter:image"]').attr('content')
            || $('meta[property="twitter:image"]').attr('content')
            || undefined;
        const pageThumb = pageThumbRaw ? new URL(normalizeMaybeProtocolRelative(pageThumbRaw, pageUrl), pageUrl).toString() : undefined;
        const pageTitle =
            $('meta[property="og:title"]').attr('content')
            || $('title').first().text().trim()
            || undefined;

        $('video').each((_, el) => {
            const v = $(el);
            const posterRaw = v.attr('poster');
            const poster = posterRaw ? new URL(normalizeMaybeProtocolRelative(posterRaw, pageUrl), pageUrl).toString() : undefined;
            add(v.attr('src'), { source: 'video', label: v.attr('title') || v.attr('aria-label') || pageTitle || undefined, thumbnailUrl: poster || pageThumb });
        });

        $('video source').each((_, el) => {
            const s = $(el);
            add(s.attr('src'), { source: 'source', label: s.attr('type') || pageTitle || undefined, thumbnailUrl: pageThumb });
        });

        // Common meta tags
        add($('meta[property="og:video"]').attr('content'), { source: 'meta', label: 'og:video', thumbnailUrl: pageThumb });
        add($('meta[property="og:video:url"]').attr('content'), { source: 'meta', label: 'og:video:url', thumbnailUrl: pageThumb });
        add($('meta[name="twitter:player:stream"]').attr('content'), { source: 'meta', label: 'twitter:player:stream', thumbnailUrl: pageThumb });
        const ogDuration = parseDurationToSeconds($('meta[property="og:video:duration"]').attr('content'));

        // Any direct links to video files
        $('a[href]').each((_, el) => {
            const a = $(el);
            const href = a.attr('href');
            const text = (a.text() || '').trim().slice(0, 80) || undefined;
            add(href, { source: 'link', label: text || pageTitle || undefined, thumbnailUrl: pageThumb });
        });

        // JSON-LD VideoObject support
        $('script[type="application/ld+json"]').each((_, el) => {
            const rawJson = ($(el).text() || '').trim();
            if (!rawJson) return;
            try {
                const parsed = JSON.parse(rawJson);
                const arr = Array.isArray(parsed) ? parsed : [parsed];
                for (const item of arr) {
                    const type = (item?.['@type'] || item?.type || '').toString();
                    if (!type.toLowerCase().includes('video')) continue;

                    const contentUrl = item?.contentUrl || item?.contentURL;
                    const embedUrl = item?.embedUrl || item?.embedURL;
                    const thumb = item?.thumbnailUrl || item?.thumbnailURL || item?.thumbnail;
                    const name = item?.name || pageTitle;
                    const dur = parseDurationToSeconds(item?.duration);
                    const thumbUrl = Array.isArray(thumb) ? thumb[0] : thumb;
                    const thumbAbs = thumbUrl ? new URL(normalizeMaybeProtocolRelative(String(thumbUrl), pageUrl), pageUrl).toString() : pageThumb;

                    add(contentUrl ? String(contentUrl) : undefined, { source: 'meta', label: name ? String(name).slice(0, 80) : undefined, thumbnailUrl: thumbAbs, durationSec: dur ?? ogDuration ?? undefined });
                    add(embedUrl ? String(embedUrl) : undefined, { source: 'meta', label: name ? String(name).slice(0, 80) : undefined, thumbnailUrl: thumbAbs, durationSec: dur ?? ogDuration ?? undefined });
                }
            } catch {
                // ignore
            }
        });

        // Best-effort sniffing of URLs in raw HTML/JS
        for (const u of extractAllUrlsFromText(html)) {
            const normalized = normalizeMaybeProtocolRelative(u, pageUrl);
            add(normalized, { source: 'link', label: pageTitle || 'sniffed', thumbnailUrl: pageThumb, durationSec: ogDuration ?? undefined });
        }

        await Promise.allSettled(tasks);

        const videos = uniqByUrl(found).slice(0, 50);
        return res.json({ pageUrl: pageUrl.toString(), videos });
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Server error';
        return res.status(500).json({ error: msg });
    }
});

router.get('/proxy', async (req: Request, res: Response) => {
    try {
        const url = String(req.query.url || '').trim();
        if (!isValidHttpUrl(url)) return res.status(400).send('Invalid url');

        const u = new URL(url);
        await assertSafeRemoteUrl(u);

        console.log(`[Proxy] Fetching: ${url}`);

        const headers: Record<string, string> = {
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'accept': '*/*',
            'referer': u.origin + '/',
            'origin': u.origin,
        };

        const range = req.headers.range;
        if (range) headers['range'] = range;

        const remoteRes = await fetch(url, { headers });

        console.log(`[Proxy] Remote Status: ${remoteRes.status} | Content-Type: ${remoteRes.headers.get('content-type')}`);

        res.status(remoteRes.status);

        // Forward important headers
        const copy = ['content-type', 'content-length', 'content-range', 'accept-ranges', 'cache-control'];
        copy.forEach(h => {
            const v = remoteRes.headers.get(h);
            if (v) res.setHeader(h, v);
        });

        // Basic open CORS for the proxy
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

        if (!remoteRes.body || remoteRes.status === 204) return res.send('');

        // Convert Web ReadableStream to Node Readable and pipe it
        const readable = Readable.fromWeb(remoteRes.body as any);
        readable.pipe(res);

        req.on('close', () => {
            readable.destroy();
        });
    } catch (e) {
        if (!res.headersSent) {
            res.status(500).send(e instanceof Error ? e.message : 'Proxy failed');
        }
    }
});

export default router;

