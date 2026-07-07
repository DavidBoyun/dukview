import { NextRequest, NextResponse } from "next/server";
import { Artist, FeedCard } from "@/lib/types";
import { parseRSS, googleNewsUrl } from "@/lib/rssParser";
import { getArtistConfig } from "@/config/artists";
import { hashId, stripTags } from "@/lib/shared";
import { isRelevantArtistNews } from "@/lib/newsRelevance";

// ─────────────────────────────────────────────────────
// /api/news — Google News RSS + Naver News API
// GET ?q=검색어&artistId=xxx
// ─────────────────────────────────────────────────────

async function fetchNaverNews(
  query: string,
  artistId: string,
  clientId = process.env.NAVER_CLIENT_ID,
  clientSecret = process.env.NAVER_CLIENT_SECRET,
): Promise<FeedCard[]> {
  if (!clientId || !clientSecret) return [];

  const url = new URL("https://openapi.naver.com/v1/search/news.json");
  url.searchParams.set("query", query);
  url.searchParams.set("display", "20");
  url.searchParams.set("sort", "date");

  try {
    const res = await fetch(url.toString(), {
      headers: {
        "X-Naver-Client-Id": clientId,
        "X-Naver-Client-Secret": clientSecret,
        "User-Agent": "Mozilla/5.0 (compatible; Dukview/1.0)",
      },
      next: { revalidate: 300 },
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
        artistId,
      };
    });
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q");
  const artistId = req.nextUrl.searchParams.get("artistId") || "unknown";
  const artist = getArtistConfig(artistId);

  if (!query) {
    return NextResponse.json({ error: "q가 필요해요" }, { status: 400 });
  }
  if (!artist) {
    return NextResponse.json({ error: "아티스트를 찾을 수 없어요", cards: [] }, { status: 404 });
  }

  try {
    const googleTask = fetch(googleNewsUrl(query), {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 300 },
    }).then(async res => {
      if (!res.ok) return [];
      const xml = await res.text();
      return parseRSS(xml, "news", `news-${query}`, "Google News", artistId);
    }).catch(() => []);

    const [googleCards, naverCards] = await Promise.all([
      googleTask,
      fetchNaverNews(query, artistId),
    ]);

    const seen = new Set<string>();
    const cards = [...naverCards, ...googleCards]
      .filter(card => isRelevantArtistNews(card, artist))
      .filter(card => {
        if (seen.has(card.id)) return false;
        seen.add(card.id);
        return true;
      })
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

    return NextResponse.json({ cards });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message, cards: [] },
      { status: 500 }
    );
  }
}
