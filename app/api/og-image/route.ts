import { NextRequest, NextResponse } from "next/server";
import { lookup as dnsLookup } from "node:dns/promises";

const CACHE_TTL_MS = 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 6000;
const MAX_REDIRECTS = 3;

const cache = new Map<string, { expiresAt: number; imageUrl: string | null }>();

function getCached(key: string): { imageUrl: string | null } | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) { cache.delete(key); return null; }
  return { imageUrl: entry.imageUrl };
}

function setCache(key: string, imageUrl: string | null) {
  cache.set(key, { imageUrl, expiresAt: Date.now() + CACHE_TTL_MS });
}

function extractOgImage(html: string): string | null {
  const patterns = [
    /property=["']og:image["'][^>]*content=["']([^"']+)["']/i,
    /content=["']([^"']+)["'][^>]*property=["']og:image["']/i,
    /name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i,
    /content=["']([^"']+)["'][^>]*name=["']twitter:image["']/i,
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m?.[1] && /^https?:\/\//.test(m[1])) return m[1];
  }
  return null;
}

// ─── SSRF guards ──────────────────────────────────────────────────────────────

function isIpv4(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
}

function isIpv4Blocked(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some(p => Number.isNaN(p) || p < 0 || p > 255)) {
    return true;
  }
  const [a, b] = parts;
  if (a === 0) return true;                          // 0.0.0.0/8
  if (a === 10) return true;                         // 10.0.0.0/8 private
  if (a === 127) return true;                        // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return true;           // 169.254.0.0/16 link-local
  if (a === 172 && b >= 16 && b <= 31) return true;  // 172.16.0.0/12 private
  if (a === 192 && b === 168) return true;           // 192.168.0.0/16 private
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  if (a >= 224) return true;                         // 224.0.0.0/4 multicast + reserved
  return false;
}

function isIpv6Blocked(ip: string): boolean {
  const lower = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (lower === "::1" || lower === "::") return true;
  if (/^fe[89ab]/.test(lower)) return true; // fe80::/10 link-local
  if (/^f[cd]/.test(lower)) return true;    // fc00::/7 ULA
  const mapped = lower.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (mapped) return isIpv4Blocked(mapped[1]);
  return false;
}

function isHostnameBlocked(host: string): boolean {
  const lower = host.toLowerCase();
  if (lower === "localhost") return true;
  if (lower.endsWith(".localhost")) return true;
  if (lower.endsWith(".local")) return true;
  if (lower.endsWith(".internal")) return true;
  return false;
}

function isPortAllowed(url: URL): boolean {
  if (url.port === "") return true;
  return url.port === "80" || url.port === "443";
}

async function validateUrl(raw: string): Promise<URL | null> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (!isPortAllowed(url)) return null;

  const host = url.hostname.replace(/\.$/, "");
  if (!host) return null;

  if (host.includes(":")) {
    return isIpv6Blocked(host) ? null : url;
  }
  if (isIpv4(host)) {
    return isIpv4Blocked(host) ? null : url;
  }
  if (isHostnameBlocked(host)) return null;

  try {
    const results = await dnsLookup(host, { all: true });
    if (results.length === 0) return null;
    for (const { address, family } of results) {
      if (family === 4 && isIpv4Blocked(address)) return null;
      if (family === 6 && isIpv6Blocked(address)) return null;
    }
  } catch {
    return null;
  }
  return url;
}

async function safeFetch(initialUrl: URL): Promise<Response | null> {
  let current: URL = initialUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await fetch(current.toString(), {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Dukview/1.0)",
        "Accept": "text/html",
      },
      redirect: "manual",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return null;
      let next: URL;
      try {
        next = new URL(loc, current);
      } catch {
        return null;
      }
      const validated = await validateUrl(next.toString());
      if (!validated) return null;
      current = validated;
      continue;
    }
    return res;
  }
  return null;
}

// ─── handler ──────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url");
  if (!raw) {
    return NextResponse.json({ imageUrl: null }, { status: 400 });
  }

  const cached = getCached(raw);
  if (cached) return NextResponse.json(cached);

  const safe = await validateUrl(raw);
  if (!safe) {
    setCache(raw, null);
    return NextResponse.json({ imageUrl: null }, { status: 400 });
  }

  try {
    const res = await safeFetch(safe);
    if (!res || !res.ok) {
      setCache(raw, null);
      return NextResponse.json({ imageUrl: null });
    }
    const html = await res.text();
    const imageUrl = extractOgImage(html);
    setCache(raw, imageUrl);
    return NextResponse.json({ imageUrl });
  } catch {
    setCache(raw, null);
    return NextResponse.json({ imageUrl: null });
  }
}
