import { NextRequest, NextResponse } from "next/server";

const CACHE_TTL_MS = 60 * 60 * 1000;
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

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url || !/^https?:\/\//.test(url)) {
    return NextResponse.json({ imageUrl: null }, { status: 400 });
  }

  const cached = getCached(url);
  if (cached) return NextResponse.json(cached);

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Dukview/1.0)",
        "Accept": "text/html",
      },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) { setCache(url, null); return NextResponse.json({ imageUrl: null }); }

    const html = await res.text();
    const imageUrl = extractOgImage(html);
    setCache(url, imageUrl);
    return NextResponse.json({ imageUrl });
  } catch {
    setCache(url, null);
    return NextResponse.json({ imageUrl: null });
  }
}
