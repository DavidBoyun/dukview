import { NextRequest, NextResponse } from "next/server";
import { YoutubeSearchOrder } from "@/lib/types";

type YoutubeApiCard = {
  id: string;
  youtubeCategory: "official" | "search";
  youtubeSearchRank?: number;
  title: string;
  summary: string;
  thumbnail?: string;
  link: string;
  publishedAt: string;
  sourceId: string;
  sourceName: string;
  matchedQuery?: string;
};

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const MAX_FALLBACK_QUERIES = 6;
const MAX_DATA_API_SEARCH_QUERIES = 2;
const DAILY_SEARCH_CALL_LIMIT = Number(process.env.YOUTUBE_SEARCH_DAILY_LIMIT || "20");
const UNKNOWN_PUBLISHED_AT = "1970-01-01T00:00:00.000Z";

const responseCache = new Map<string, { expiresAt: number; cards: YoutubeApiCard[] }>();
const dailySearchUsage = new Map<string, number>();

function isYoutubeDataApiEnabled() {
  return process.env.YOUTUBE_DATA_API_ENABLED === "true";
}

function todayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function canSpendSearchCalls(count: number) {
  const key = todayKey();
  const used = dailySearchUsage.get(key) || 0;
  return used + count <= DAILY_SEARCH_CALL_LIMIT;
}

function spendSearchCalls(count: number) {
  const key = todayKey();
  dailySearchUsage.set(key, (dailySearchUsage.get(key) || 0) + count);
}

function getCachedCards(key: string): YoutubeApiCard[] | null {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    responseCache.delete(key);
    return null;
  }
  return entry.cards;
}

function cacheCards(key: string, cards: YoutubeApiCard[]) {
  responseCache.set(key, { cards, expiresAt: Date.now() + CACHE_TTL_MS });
}

function textFromNode(node: any): string {
  if (!node) return "";
  if (typeof node.simpleText === "string") return node.simpleText;
  if (Array.isArray(node.runs)) return node.runs.map((r: any) => r.text || "").join("");
  return "";
}

function relativeTimeFromText(text: string): string {
  const normalized = text.replace(/\s+/g, " ");
  const english = normalized.match(
    /(?:streamed|premiered)?\s*(\d+|a|an)\s+(minute|hour|day|week|month|year)s?\s+ago/i
  );
  if (english) return english[0];

  const korean = normalized.match(/(\d+)\s*(분|시간|일|주|개월|달|년)\s*전/);
  if (korean) return korean[0];

  if (/yesterday/i.test(normalized)) return "1 day ago";
  if (normalized.includes("어제")) return "1일 전";
  return "";
}

function publishedTextFromVideo(video: any): string {
  const direct = textFromNode(video.publishedTimeText);
  if (direct) return direct;

  const labels = [
    video.title?.accessibility?.accessibilityData?.label,
    video.title?.accessibilityData?.label,
    video.accessibility?.accessibilityData?.label,
  ].filter(Boolean);

  for (const label of labels) {
    const parsed = relativeTimeFromText(String(label));
    if (parsed) return parsed;
  }

  return "";
}

function estimatePublishedAt(raw: string): string {
  if (!raw) return UNKNOWN_PUBLISHED_AT;

  const now = new Date();
  const text = raw.toLowerCase();
  const rawValue = text.match(/\d+/)?.[0];
  const value = rawValue ? Number(rawValue) : 1;
  const amount = text.includes("yesterday") || text.includes("어제") ? 1 : value;

  if (text.includes("minute") || text.includes("분 전")) now.setMinutes(now.getMinutes() - amount);
  else if (text.includes("hour") || text.includes("시간 전")) now.setHours(now.getHours() - amount);
  else if (text.includes("day") || text.includes("yesterday") || text.includes("일 전") || text.includes("어제")) now.setDate(now.getDate() - amount);
  else if (text.includes("week") || text.includes("주 전")) now.setDate(now.getDate() - amount * 7);
  else if (text.includes("month") || text.includes("개월 전") || text.includes("달 전")) now.setMonth(now.getMonth() - amount);
  else if (text.includes("year") || text.includes("년 전")) now.setFullYear(now.getFullYear() - amount);
  else return UNKNOWN_PUBLISHED_AT;

  return now.toISOString();
}

function collectVideoRenderers(node: any, output: any[] = []): any[] {
  if (!node || typeof node !== "object") return output;
  if (node.videoRenderer) output.push(node.videoRenderer);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach(item => collectVideoRenderers(item, output));
    else if (value && typeof value === "object") collectVideoRenderers(value, output);
  }
  return output;
}

function extractInitialData(html: string): any | null {
  const marker = "ytInitialData = ";
  const start = html.indexOf(marker);
  if (start < 0) return null;
  const jsonStart = start + marker.length;
  const end = html.indexOf(";</script>", jsonStart);
  if (end < 0) return null;
  try {
    return JSON.parse(html.slice(jsonStart, end));
  } catch {
    return null;
  }
}

async function fetchYoutubeSearchPage(query: string, order: YoutubeSearchOrder): Promise<YoutubeApiCard[]> {
  const url = new URL("https://www.youtube.com/results");
  url.searchParams.set("search_query", query);
  url.searchParams.set("hl", "en");
  if (order === "date") url.searchParams.set("sp", "CAI=");

  const res = await fetch(url.toString(), {
    headers: {
      "Accept-Language": "en-US,en;q=0.9,ko;q=0.8",
      "User-Agent": "Mozilla/5.0 (compatible; Dukview/1.0)",
    },
    next: { revalidate: 0 },
  });
  if (!res.ok) return [];

  const data = extractInitialData(await res.text());
  if (!data) return [];

  return collectVideoRenderers(data).flatMap((video): YoutubeApiCard[] => {
    const videoId = video.videoId;
    const title = textFromNode(video.title);
    if (!videoId || !title) return [];

    const sourceName =
      textFromNode(video.ownerText) || textFromNode(video.longBylineText) || "YouTube";
    const sourceId =
      video.ownerText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId ||
      video.longBylineText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId ||
      `search:${query}`;
    const publishedText = publishedTextFromVideo(video);
    const thumbnails = video.thumbnail?.thumbnails || [];

    return [{
      id: videoId,
      youtubeCategory: "search",
      title,
      summary: textFromNode(video.detailedMetadataSnippets?.[0]?.snippetText),
      thumbnail: thumbnails[thumbnails.length - 1]?.url,
      link: `https://www.youtube.com/watch?v=${videoId}`,
      publishedAt: estimatePublishedAt(publishedText),
      sourceId,
      sourceName,
      matchedQuery: query,
    }];
  });
}

// quota: channels.list × 1 unit + playlistItems.list × N units (N = 채널 수)
// search.list 대비 채널당 100배 절약 (100 → 2 units)
async function fetchYoutubeChannelApi(channelIds: string[], apiKey: string): Promise<YoutubeApiCard[]> {
  // channels.list: 모든 채널을 단일 배치 요청 (1 unit)
  const chUrl = new URL("https://www.googleapis.com/youtube/v3/channels");
  chUrl.searchParams.set("part", "contentDetails,snippet");
  chUrl.searchParams.set("id", channelIds.join(","));
  chUrl.searchParams.set("key", apiKey);

  const chRes = await fetch(chUrl.toString(), { next: { revalidate: 0 } });
  const chData = await chRes.json();
  if (chData.error) throw new Error(chData.error.message);
  if (!Array.isArray(chData.items) || chData.items.length === 0) return [];

  const entries: { channelId: string; uploadsId: string; channelTitle: string }[] = chData.items
    .filter((item: any) => item.contentDetails?.relatedPlaylists?.uploads)
    .map((item: any) => ({
      channelId: item.id as string,
      uploadsId: item.contentDetails.relatedPlaylists.uploads as string,
      channelTitle: (item.snippet?.title as string) || "YouTube",
    }));

  // playlistItems.list: 채널별 1 unit씩
  const results = await Promise.all(
    entries.map(async ({ channelId, uploadsId, channelTitle }) => {
      const piUrl = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
      piUrl.searchParams.set("part", "snippet");
      piUrl.searchParams.set("playlistId", uploadsId);
      piUrl.searchParams.set("maxResults", "25");
      piUrl.searchParams.set("key", apiKey);

      const res = await fetch(piUrl.toString(), { next: { revalidate: 0 } });
      const data = await res.json();
      if (data.error || !Array.isArray(data.items)) return [];

      return data.items.flatMap((item: any): YoutubeApiCard[] => {
        const snippet = item.snippet;
        const videoId = snippet?.resourceId?.videoId;
        if (!videoId || !snippet?.title || !snippet?.publishedAt) return [];
        const t = snippet.thumbnails;
        return [{
          id: videoId,
          youtubeCategory: "official",
          title: snippet.title,
          summary: snippet.description || "",
          thumbnail: t?.high?.url || t?.medium?.url || t?.default?.url,
          link: `https://www.youtube.com/watch?v=${videoId}`,
          publishedAt: snippet.publishedAt,
          sourceId: channelId,
          sourceName: channelTitle,
        }];
      });
    })
  );

  return results.flat();
}

async function fetchYoutubeSearchApi(
  queries: string[],
  order: YoutubeSearchOrder,
  apiKey: string,
): Promise<YoutubeApiCard[]> {
  const billableQueries = queries.slice(0, MAX_DATA_API_SEARCH_QUERIES);
  if (!canSpendSearchCalls(billableQueries.length)) {
    throw new Error(`YouTube 검색 일일 예산(${DAILY_SEARCH_CALL_LIMIT}회)을 넘지 않도록 중단했어요.`);
  }

  const results = await Promise.all(
    billableQueries.map(async query => {
      const url = new URL("https://www.googleapis.com/youtube/v3/search");
      url.searchParams.set("part", "snippet");
      url.searchParams.set("q", query);
      url.searchParams.set("maxResults", "25");
      url.searchParams.set("type", "video");
      url.searchParams.set("order", order);
      url.searchParams.set("key", apiKey);

      const res = await fetch(url.toString(), { next: { revalidate: 0 } });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      if (!Array.isArray(data.items)) return [];

      return data.items.flatMap((item: any): YoutubeApiCard[] => {
        const videoId = item.id?.videoId;
        const snippet = item.snippet;
        if (!videoId || !snippet?.title || !snippet.publishedAt) return [];

        return [{
          id: videoId,
          youtubeCategory: "search",
          title: snippet.title,
          summary: snippet.description || "",
          thumbnail:
            snippet.thumbnails?.high?.url ||
            snippet.thumbnails?.medium?.url ||
            snippet.thumbnails?.default?.url,
          link: `https://www.youtube.com/watch?v=${videoId}`,
          publishedAt: snippet.publishedAt,
          sourceId: snippet.channelId || `search:${query}`,
          sourceName: snippet.channelTitle || "YouTube",
          matchedQuery: query,
        }];
      });
    })
  );

  spendSearchCalls(billableQueries.length);
  return results.flat();
}

function uniqueCards(cards: YoutubeApiCard[], order: YoutubeSearchOrder): YoutubeApiCard[] {
  const seen = new Set<string>();
  const unique = cards
    .filter(card => {
      if (seen.has(card.id)) return false;
      seen.add(card.id);
      return true;
    });

  if (order === "relevance") return unique;

  return unique.sort((a, b) =>
    new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const channelIdsParam = searchParams.get("channelIds");
  const queryParam = searchParams.get("query");
  const orderParam = searchParams.get("order");
  const useDataApiSearch = searchParams.get("useDataApi") === "true";
  const order: YoutubeSearchOrder = orderParam === "relevance" ? "relevance" : "date";

  const API_KEY = process.env.TUBE_API_KEY || process.env.YOUTUBE_API_KEY;

  // ── 1. Channel API path: channels.list + playlistItems.list ────────────
  if (channelIdsParam && API_KEY && isYoutubeDataApiEnabled()) {
    const channelIds = channelIdsParam.split(",").map(id => id.trim()).filter(Boolean);
    const cacheKey = `ch:${[...channelIds].sort().join(",")}`;

    const cached = getCachedCards(cacheKey);
    if (cached) {
      return NextResponse.json({ cards: cached, provider: "channel-api", cached: true });
    }

    try {
      const cards = uniqueCards(await fetchYoutubeChannelApi(channelIds, API_KEY), "date");
      cacheCards(cacheKey, cards);
      return NextResponse.json({ cards, provider: "channel-api", cached: false });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "API 오류";
      return NextResponse.json({ error: `YouTube Channel API 실패: ${msg}` }, { status: 500 });
    }
  }

  // ── 2. Scraping path: 키워드 검색 (fan content) ─────────────────────────
  const queries = (queryParam ?? "").split(",").map(q => q.trim()).filter(Boolean);
  if (queries.length === 0) {
    return NextResponse.json({ cards: [], provider: "youtube-search-page", cached: false });
  }

  const provider =
    useDataApiSearch && API_KEY && isYoutubeDataApiEnabled()
      ? "search-api"
      : "youtube-search-page";
  const effectiveQueries =
    provider === "search-api"
      ? queries.slice(0, MAX_DATA_API_SEARCH_QUERIES)
      : queries.slice(0, MAX_FALLBACK_QUERIES);
  const cacheKey = `${provider}:v2:${order}:${effectiveQueries.join(",")}`;
  const cached = getCachedCards(cacheKey);
  if (cached) {
    return NextResponse.json({ cards: cached, queries: effectiveQueries, provider, cached: true });
  }

  try {
    const rawCards = provider === "search-api"
      ? await fetchYoutubeSearchApi(effectiveQueries, order, API_KEY!)
      : (await Promise.all(effectiveQueries.map(q => fetchYoutubeSearchPage(q, order)))).flat();
    const cards = uniqueCards(rawCards, order).map((card, index) => ({
      ...card,
      youtubeSearchRank: index,
    }));
    cacheCards(cacheKey, cards);
    return NextResponse.json({ cards, queries: effectiveQueries, provider, cached: false });
  } catch (error) {
    if (provider === "search-api") {
      const fallbackQueries = queries.slice(0, MAX_FALLBACK_QUERIES);
      const fallbackKey = `youtube-search-page:v2:${order}:${fallbackQueries.join(",")}`;
      const fallbackCached = getCachedCards(fallbackKey);
      if (fallbackCached) {
        return NextResponse.json({
          cards: fallbackCached,
          queries: fallbackQueries,
          provider: "youtube-search-page",
          cached: true,
          warning: error instanceof Error ? error.message : "YouTube Data API 검색 실패",
        });
      }

      const fallbackRaw = (await Promise.all(fallbackQueries.map(q => fetchYoutubeSearchPage(q, order)))).flat();
      const fallbackCards = uniqueCards(fallbackRaw, order).map((card, index) => ({
        ...card,
        youtubeSearchRank: index,
      }));
      cacheCards(fallbackKey, fallbackCards);
      return NextResponse.json({
        cards: fallbackCards,
        queries: fallbackQueries,
        provider: "youtube-search-page",
        cached: false,
        warning: error instanceof Error ? error.message : "YouTube Data API 검색 실패",
      });
    }

    return NextResponse.json({ error: "YouTube 검색 실패" }, { status: 500 });
  }
}
