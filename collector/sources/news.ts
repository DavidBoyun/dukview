// ─────────────────────────────────────────────────────
// 뉴스 수집 — Google News RSS + Naver News API
// app/api/news/route.ts 로직 이식 (Next 의존 제거)
// ─────────────────────────────────────────────────────

import { Artist, FeedCard } from "../../lib/types";
import { parseRSS, googleNewsUrl } from "../../lib/rssParser";
import { hashId, stripTags } from "../../lib/shared";
import { isRelevantArtistNews } from "../../lib/newsRelevance";

async function fetchGoogleNews(query: string, artistId: string): Promise<FeedCard[]> {
  const res = await fetch(googleNewsUrl(query), {
    headers: { "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return [];
  const xml = await res.text();
  return parseRSS(xml, "news", `news-${query}`, "Google News", artistId);
}

async function fetchNaverNews(query: string, artistId: string): Promise<FeedCard[]> {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) return [];

  const url = new URL("https://openapi.naver.com/v1/search/news.json");
  url.searchParams.set("query", query);
  url.searchParams.set("display", "20");
  url.searchParams.set("sort", "date");

  const res = await fetch(url.toString(), {
    headers: {
      "X-Naver-Client-Id": clientId,
      "X-Naver-Client-Secret": clientSecret,
      "User-Agent": "Mozilla/5.0 (compatible; Dukview/1.0)",
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return [];

  const data = await res.json();
  if (!Array.isArray(data.items)) return [];

  return data.items.map((item: any): FeedCard => {
    const link = item.originallink || item.link || "";
    let sourceName = "네이버 뉴스";
    try {
      sourceName = new URL(link).hostname.replace(/^www\./, "");
    } catch {}

    return {
      id: hashId(link || item.title || item.pubDate, "n"),
      source: "news",
      sourceId: sourceName,
      sourceName,
      title: stripTags(item.title || ""),
      summary: stripTags(item.description || "").slice(0, 200),
      link,
      publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
      artistId: artistId,
    };
  });
}

/** 아티스트의 newsKeywords 전체를 수집·필터·중복제거해 반환 */
export async function collectNews(artist: Artist): Promise<FeedCard[]> {
  const keywords = artist.sources.newsKeywords || [];
  const all: FeedCard[] = [];

  for (const keyword of keywords) {
    const [google, naver] = await Promise.all([
      fetchGoogleNews(keyword, artist.id).catch(() => [] as FeedCard[]),
      fetchNaverNews(keyword, artist.id).catch(() => [] as FeedCard[]),
    ]);
    all.push(...naver, ...google);
    await new Promise(r => setTimeout(r, 500)); // 원본 예의
  }

  const seen = new Set<string>();
  return all
    .filter(card => card.link && isRelevantArtistNews(card, artist))
    .filter(card => {
      const key = hashId(card.link);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
