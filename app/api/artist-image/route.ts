import { NextRequest, NextResponse } from "next/server";
import { getArtistConfig } from "@/config/artists";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const imageCache = new Map<string, { expiresAt: number; imageUrl: string }>();

function getCachedImage(key: string): string | null {
  const entry = imageCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) { imageCache.delete(key); return null; }
  return entry.imageUrl;
}

function setCachedImage(key: string, imageUrl: string) {
  imageCache.set(key, { imageUrl, expiresAt: Date.now() + CACHE_TTL_MS });
}

function notFound() {
  return new NextResponse(null, {
    status: 404,
    headers: { "Cache-Control": "public, max-age=300" },
  });
}

/**
 * 네이버 검색 HTML에서 인물 카드 프로필 이미지 URL 추출.
 * sstatic.naver.net/people/ 를 src로 갖는 search.pstatic.net 프록시 URL을 찾는다.
 * UUID 형식 파일명(profileImg/)을 우선 반환하고, 없으면 날짜 형식 파일명을 반환한다.
 */
async function fetchNaverPersonImage(query: string): Promise<string | null> {
  try {
    const url = new URL("https://search.naver.com/search.naver");
    url.searchParams.set("query", query);

    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept-Language": "ko-KR,ko;q=0.9",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const html = await res.text();

    // src가 sstatic.naver.net/people/ 인 search.pstatic.net 프록시 URL 추출
    const pattern = /search\.pstatic\.net\/common\?[^"']*src=http[^"']*sstatic\.naver\.net%2Fpeople%2F[^"']*/g;
    const matches = html.match(pattern) ?? [];
    const urls = matches.map(m => `https://${m}`);

    // UUID 형식(profileImg/) 우선, 없으면 날짜 형식 fallback
    return urls.find(u => u.includes("profileImg")) ?? urls[0] ?? null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const artistId = searchParams.get("artistId") || "taemin";
  const artist = getArtistConfig(artistId);

  const query = artist?.profileImageQuery || (artist ? `${artist.name} 가수` : "");
  if (!query) return notFound();

  const cached = getCachedImage(artistId);
  if (cached) {
    return NextResponse.redirect(cached, 302);
  }

  const imageUrl = await fetchNaverPersonImage(query);
  if (!imageUrl) return notFound();

  setCachedImage(artistId, imageUrl);
  const response = NextResponse.redirect(imageUrl, 302);
  response.headers.set("Cache-Control", "public, max-age=86400");
  return response;
}
