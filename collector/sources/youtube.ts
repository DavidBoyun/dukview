// ─────────────────────────────────────────────────────
// YouTube 수집 — Channel API(quota 2~3 units) 또는 RSS fallback + 검색 스크레이핑
// app/api/youtube/route.ts + feed 오케스트레이션 필터 이식 (PR-4)
// search.list 금지 유지 (100 units/call)
// ─────────────────────────────────────────────────────

import { Artist, FeedCard } from "../../lib/types";
import { parseRSS, youtubeChannelUrl } from "../../lib/rssParser";
import { UNKNOWN_DATE_ISO } from "../../lib/shared";
import { SHARED_YOUTUBE_CHANNELS } from "../../config/artists";

const MAX_SEARCH_QUERIES = 6;

const VIDEO_INTENT_KEYWORDS = [
  "직캠", "팬캠", "fancam", "focus", "4k", "performance", "stage",
  "무대", "코첼라", "coachella", "waterbomb", "워터밤",
];

// ─── ytInitialData 파싱 헬퍼 (원본 그대로) ──────────────────────
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
  if (!raw) return UNKNOWN_DATE_ISO;
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
  else return UNKNOWN_DATE_ISO;

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

// ─── 검색 결과 페이지 스크레이핑 (quota 0) ──────────────────────
async function fetchYoutubeSearchPage(query: string, artistId: string): Promise<FeedCard[]> {
  const url = new URL("https://www.youtube.com/results");
  url.searchParams.set("search_query", query);
  url.searchParams.set("hl", "en");
  url.searchParams.set("sp", "CAI="); // 최신순

  const res = await fetch(url.toString(), {
    headers: {
      "Accept-Language": "en-US,en;q=0.9,ko;q=0.8",
      "User-Agent": "Mozilla/5.0 (compatible; Dukview/1.0)",
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) return [];

  const data = extractInitialData(await res.text());
  if (!data) return [];

  return collectVideoRenderers(data).flatMap((video): FeedCard[] => {
    const videoId = video.videoId;
    const title = textFromNode(video.title);
    if (!videoId || !title) return [];

    const sourceName =
      textFromNode(video.ownerText) || textFromNode(video.longBylineText) || "YouTube";
    const sourceId =
      video.ownerText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId ||
      video.longBylineText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId ||
      `search:${query}`;
    const thumbnails = video.thumbnail?.thumbnails || [];

    return [{
      id: videoId,
      source: "youtube",
      youtubeCategory: "search",
      sourceId,
      sourceName,
      title,
      summary: textFromNode(video.detailedMetadataSnippets?.[0]?.snippetText),
      thumbnail: thumbnails[thumbnails.length - 1]?.url,
      link: `https://www.youtube.com/watch?v=${videoId}`,
      publishedAt: estimatePublishedAt(publishedTextFromVideo(video)),
      artistId,
    }];
  });
}

// ─── Channel API: channels.list(1) + playlistItems.list(채널당 1) ─
async function fetchYoutubeChannelApi(
  channelIds: string[],
  apiKey: string,
  artistId: string,
): Promise<FeedCard[]> {
  const chUrl = new URL("https://www.googleapis.com/youtube/v3/channels");
  chUrl.searchParams.set("part", "contentDetails,snippet");
  chUrl.searchParams.set("id", channelIds.join(","));
  chUrl.searchParams.set("key", apiKey);

  const chRes = await fetch(chUrl.toString(), { signal: AbortSignal.timeout(10000) });
  const chData = await chRes.json();
  if (chData.error) throw new Error(chData.error.message);
  if (!Array.isArray(chData.items) || chData.items.length === 0) return [];

  const entries = chData.items
    .filter((item: any) => item.contentDetails?.relatedPlaylists?.uploads)
    .map((item: any) => ({
      channelId: item.id as string,
      uploadsId: item.contentDetails.relatedPlaylists.uploads as string,
      channelTitle: (item.snippet?.title as string) || "YouTube",
    }));

  const results = await Promise.all(
    entries.map(async ({ channelId, uploadsId, channelTitle }: any) => {
      const piUrl = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
      piUrl.searchParams.set("part", "snippet");
      piUrl.searchParams.set("playlistId", uploadsId);
      piUrl.searchParams.set("maxResults", "25");
      piUrl.searchParams.set("key", apiKey);

      const res = await fetch(piUrl.toString(), { signal: AbortSignal.timeout(10000) });
      const data = await res.json();
      if (data.error || !Array.isArray(data.items)) return [];

      return data.items.flatMap((item: any): FeedCard[] => {
        const snippet = item.snippet;
        const videoId = snippet?.resourceId?.videoId;
        if (!videoId || !snippet?.title || !snippet?.publishedAt) return [];
        const t = snippet.thumbnails;
        return [{
          id: videoId,
          source: "youtube",
          youtubeCategory: "official",
          sourceId: channelId,
          sourceName: channelTitle,
          title: snippet.title,
          summary: snippet.description || "",
          thumbnail: t?.high?.url || t?.medium?.url || t?.default?.url,
          link: `https://www.youtube.com/watch?v=${videoId}`,
          publishedAt: snippet.publishedAt,
          artistId,
        }];
      });
    })
  );

  return results.flat();
}

// ─── 필터 (feed 오케스트레이션 이식) ───────────────────────────
function matchesArtist(card: FeedCard, keywords: string[]): boolean {
  const text = `${card.title} ${card.summary}`.toLowerCase();
  return keywords.some(kw => text.includes(kw.toLowerCase()));
}

function matchesYoutubeSearch(card: FeedCard, includeKeywords: string[], excludeKeywords: string[]): boolean {
  const contentText = `${card.title} ${card.summary}`.toLowerCase();
  const fullText = `${contentText} ${card.sourceName}`.toLowerCase();

  if (excludeKeywords.some(keyword => fullText.includes(keyword.toLowerCase()))) return false;

  const hasArtistInContent = includeKeywords.length === 0 ||
    includeKeywords.some(keyword => contentText.includes(keyword.toLowerCase()));
  if (!hasArtistInContent) return false;

  return VIDEO_INTENT_KEYWORDS.some(keyword => contentText.includes(keyword.toLowerCase()));
}

/** 아티스트의 YouTube 소스 전체 수집 */
export async function collectYoutube(artist: Artist): Promise<FeedCard[]> {
  const apiKey = process.env.TUBE_API_KEY || process.env.YOUTUBE_API_KEY;
  const dataApiEnabled = Boolean(apiKey) && process.env.YOUTUBE_DATA_API_ENABLED === "true";

  const matchKeywords = [artist.name, artist.en, ...(artist.aliases || [])].filter(Boolean);
  const identityKeywords = Array.from(new Set([
    artist.name,
    artist.en,
    artist.en.toLowerCase(),
    ...(artist.aliases || []),
    ...(artist.sources.youtubeSearchMatchKeywords || []),
  ].filter(Boolean)));
  const excludeKeywords = artist.sources.youtubeSearchExcludeKeywords || [];

  const sharedChannelSet = new Set<string>([
    ...SHARED_YOUTUBE_CHANNELS,
    ...(artist.sources.youtubeSharedChannelIds || []),
  ]);
  const allChannelIds = Array.from(new Set([
    ...(artist.sources.youtubeChannelIds || []),
    ...(artist.sources.youtubeSharedChannelIds || []),
  ]));

  const cards: FeedCard[] = [];

  // 1) 채널 영상: Data API 또는 RSS fallback
  if (allChannelIds.length > 0) {
    if (dataApiEnabled) {
      const apiCards = await fetchYoutubeChannelApi(allChannelIds, apiKey!, artist.id);
      cards.push(...apiCards.filter(card =>
        !sharedChannelSet.has(card.sourceId) || matchesArtist(card, matchKeywords)
      ));
    } else {
      for (const channelId of allChannelIds) {
        try {
          const res = await fetch(youtubeChannelUrl(channelId), {
            headers: { "User-Agent": "Mozilla/5.0 (compatible; Dukview/1.0)" },
            signal: AbortSignal.timeout(10000),
          });
          if (!res.ok) continue;
          const xml = await res.text();
          const rssCards = parseRSS(
            xml,
            "youtube",
            channelId,
            artist.sources.youtubeChannelNames?.[channelId] || "YouTube",
            artist.id,
          ).map(card => ({ ...card, youtubeCategory: "official" as const }));
          const isShared = sharedChannelSet.has(channelId);
          cards.push(...(isShared ? rssCards.filter(c => matchesArtist(c, matchKeywords)) : rssCards));
        } catch {
          continue;
        }
      }
    }
  }

  // 2) 팬 콘텐츠 검색 (스크레이핑, quota 0)
  const queries = (artist.sources.youtubeSearchQueries || []).slice(0, MAX_SEARCH_QUERIES);
  for (const query of queries) {
    try {
      const searchCards = await fetchYoutubeSearchPage(query, artist.id);
      cards.push(...searchCards.filter(card =>
        matchesYoutubeSearch(card, identityKeywords, excludeKeywords)
      ));
    } catch {
      continue;
    }
    await new Promise(r => setTimeout(r, 500));
  }

  // videoId 기준 중복 제거
  const seen = new Set<string>();
  return cards.filter(card => {
    if (seen.has(card.id)) return false;
    seen.add(card.id);
    return true;
  });
}
