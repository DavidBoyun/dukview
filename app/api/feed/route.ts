import { NextRequest, NextResponse } from "next/server";
import { parseRSS, youtubeChannelUrl, googleNewsUrl } from "@/lib/rssParser";
import { getArtistConfig } from "@/config/artists";
import { Artist, FeedCard, YoutubeSearchOrder } from "@/lib/types";

// 글로벌 공유 채널 (소속사 통합 채널) — 모든 아티스트에게 필터 적용
// 아티스트별 그룹 채널은 artist.sources.youtubeSharedChannelIds로 추가
const SHARED_YOUTUBE_CHANNELS = [
  "UCEf_Bc-KVd7onSeifS3py9g",  // SMTOWN
  "UCLkAepWjdylmXSltofFvsYQ",  // HYBE (BANGTANTV)
  "UCIHstIcyaD8tJBkfMkJFMOg",  // JYP
  "UCJ1wC5yRahIM0ycKjYpZgTA",  // YG
];

async function fetchRSS(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Dukview/1.0)" },
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function fetchYoutubeSearch(
  origin: string,
  queries: string[],
  order: YoutubeSearchOrder,
  artistId: string,
  useDataApi: boolean,
): Promise<{ cards: FeedCard[]; error?: string }> {
  if (queries.length === 0) return { cards: [] };

  const url = new URL("/api/youtube", origin);
  url.searchParams.set("query", queries.join(","));
  url.searchParams.set("order", order);
  if (useDataApi) {
    url.searchParams.set("useDataApi", "true");
  }

  try {
    const res = await fetch(url.toString(), { next: { revalidate: 0 } });
    const data = await res.json();
    if (!res.ok) return { cards: [], error: data.error || "YouTube 검색을 불러오지 못했어요" };
    if (!Array.isArray(data.cards)) return { cards: [] };

    return { cards: data.cards.map((card: any, index: number) => ({
      id: card.id,
      source: "youtube" as const,
      youtubeCategory: "search" as const,
      youtubeSearchRank: typeof card.youtubeSearchRank === "number" ? card.youtubeSearchRank : index,
      sourceId: card.sourceId || "youtube-search",
      sourceName: card.sourceName || "YouTube",
      title: card.title || "(제목 없음)",
      summary: card.summary || "",
      link: card.link,
      publishedAt: card.publishedAt,
      thumbnail: card.thumbnail,
      artistId,
    })) };
  } catch {
    return { cards: [], error: "YouTube 검색 서버에 연결하지 못했어요" };
  }
}

// channels.list + playlistItems.list 경로 (Data API 활성화 시)
async function fetchYoutubeChannels(
  origin: string,
  channelIds: string[],
  artistId: string
): Promise<{ cards: FeedCard[]; error?: string }> {
  if (channelIds.length === 0) return { cards: [] };

  const url = new URL("/api/youtube", origin);
  url.searchParams.set("channelIds", channelIds.join(","));

  try {
    const res = await fetch(url.toString(), { next: { revalidate: 0 } });
    const data = await res.json();
    if (!res.ok) return { cards: [], error: data.error || "YouTube 채널을 불러오지 못했어요" };
    if (!Array.isArray(data.cards)) return { cards: [] };

    return { cards: data.cards.map((card: any) => ({
      id: card.id,
      source: "youtube" as const,
      youtubeCategory: (card.youtubeCategory || "official") as "official" | "search",
      sourceId: card.sourceId || channelIds[0],
      sourceName: card.sourceName || "YouTube",
      title: card.title || "(제목 없음)",
      summary: card.summary || "",
      link: card.link,
      publishedAt: card.publishedAt,
      thumbnail: card.thumbnail,
      artistId,
    })) };
  } catch {
    return { cards: [], error: "YouTube Channel API 서버에 연결하지 못했어요" };
  }
}

async function fetchNewsCards(
  origin: string,
  keyword: string,
  artistId: string,
): Promise<FeedCard[]> {
  const url = new URL("/api/news", origin);
  url.searchParams.set("q", keyword);
  url.searchParams.set("artistId", artistId);

  try {
    const res = await fetch(url.toString(), { next: { revalidate: 300 } });
    const data = await res.json();
    if (!res.ok || !Array.isArray(data.cards)) return [];

    return data.cards.map((card: any) => ({
      id: card.id,
      source: "news" as const,
      sourceId: card.sourceId || "뉴스",
      sourceName: card.sourceName || "뉴스",
      title: card.title || "(제목 없음)",
      summary: card.summary || "",
      link: card.link,
      publishedAt: card.publishedAt,
      thumbnail: card.thumbnail,
      artistId,
    }));
  } catch {
    return [];
  }
}

/**
 * 카드 제목/요약에 아티스트 키워드가 있는지 확인
 */
function matchesArtist(card: FeedCard, keywords: string[]): boolean {
  const text = `${card.title} ${card.summary}`.toLowerCase();
  return keywords.some(kw => text.includes(kw.toLowerCase()));
}

function includesArtistName(text: string, artist: Artist): boolean {
  const lower = text.toLowerCase();
  const koreanNamePattern = new RegExp(`(^|[^가-힣])${artist.name}([^가-힣]|$)`);
  return koreanNamePattern.test(text) || lower.includes(artist.en.toLowerCase());
}

function matchesArtistNews(card: FeedCard, artist: Artist): boolean {
  const text = `${card.title} ${card.summary}`;
  const lower = text.toLowerCase();
  const excludeTerms = artist.sources.newsExcludeKeywords || [];
  const contextTerms = artist.sources.newsContextKeywords || [
    artist.name,
    artist.en,
    artist.groupName || "",
    "가수",
    "콘서트",
    "앨범",
    "무대",
  ];
  if (excludeTerms.some(term => lower.includes(term.toLowerCase()))) return false;
  if (!includesArtistName(card.title, artist)) return false;
  return contextTerms.filter(Boolean).some(term => lower.includes(term.toLowerCase()));
}

function matchesYoutubeSearch(card: FeedCard, includeKeywords: string[], excludeKeywords: string[]): boolean {
  const contentText = `${card.title} ${card.summary}`.toLowerCase();
  const fullText = `${contentText} ${card.sourceName}`.toLowerCase();
  const videoIntentKeywords = [
    "직캠",
    "팬캠",
    "fancam",
    "focus",
    "4k",
    "performance",
    "stage",
    "무대",
    "코첼라",
    "coachella",
    "waterbomb",
    "워터밤",
  ];

  if (excludeKeywords.some(keyword => fullText.includes(keyword.toLowerCase()))) {
    return false;
  }

  const hasArtistInContent = includeKeywords.length === 0 ||
    includeKeywords.some(keyword => contentText.includes(keyword.toLowerCase()));
  if (!hasArtistInContent) {
    return false;
  }

  return videoIntentKeywords.some(keyword => contentText.includes(keyword.toLowerCase()));
}

function buildCustomYoutubeQueries(baseTerms: string[], customKeywords: string[]): string[] {
  return customKeywords.flatMap(keyword =>
    baseTerms.map(term => `${term} ${keyword}`)
  );
}

/**
 * Google News 제목에서 언론사명 추출
 * 패턴: "기사 제목 - 언론사명" → "언론사명" 리턴
 */
function extractNewsSource(title: string): string {
  // 마지막 " - " 뒤가 언론사명
  const lastDash = title.lastIndexOf(" - ");
  if (lastDash > 0 && lastDash < title.length - 3) {
    return title.slice(lastDash + 3).trim();
  }
  return "뉴스";
}

/**
 * Google News 제목에서 언론사명 제거 (카드에 중복 표시 방지)
 * "기사 제목 - 언론사명" → "기사 제목"
 */
function cleanNewsTitle(title: string): string {
  const lastDash = title.lastIndexOf(" - ");
  if (lastDash > 0) {
    return title.slice(0, lastDash).trim();
  }
  return title;
}

export async function GET(req: NextRequest) {
  const artistId = req.nextUrl.searchParams.get("artistId");
  const youtubeOrderParam = req.nextUrl.searchParams.get("youtubeOrder");
  const includeYoutubeSearch = req.nextUrl.searchParams.get("includeYoutubeSearch") === "true";
  const useYoutubeSearchApi = req.nextUrl.searchParams.get("useYoutubeSearchApi") === "true";
  const keywordsParam =
    req.nextUrl.searchParams.get("keywords") ||
    req.nextUrl.searchParams.get("aliases");
  const youtubeOrder: YoutubeSearchOrder =
    youtubeOrderParam === "relevance" ? "relevance" : "date";
  const origin = req.nextUrl.origin;
  if (!artistId) {
    return NextResponse.json({ error: "artistId가 필요해요" }, { status: 400 });
  }

  const artist = getArtistConfig(artistId);
  if (!artist) {
    return NextResponse.json({ error: "아티스트를 찾을 수 없어요" }, { status: 404 });
  }

  const customKeywords = keywordsParam
    ? keywordsParam.split(",").map(keyword => keyword.trim()).filter(Boolean)
    : [];

  const matchKeywords = [
    artist.name,
    artist.en,
    ...(artist.aliases || []),
  ].filter(Boolean);
  const youtubeIdentityKeywords = Array.from(
    new Set([
      artist.name,
      artist.en,
      artist.en.toLowerCase(),
      ...(artist.aliases || []),
      ...(artist.sources.youtubeSearchMatchKeywords || []),
    ].filter(Boolean))
  );
  const youtubeCustomQueryTerms = Array.from(
    new Set([
      artist.name,
      artist.en,
      artist.groupName ? `${artist.groupName} ${artist.name}` : "",
      artist.groupName ? `${artist.groupName} ${artist.en}` : "",
    ].filter(Boolean))
  );
  const youtubeExcludeKeywords = Array.from(
    new Set((artist.sources.youtubeSearchExcludeKeywords || []).filter(Boolean))
  );

  const allCards: FeedCard[] = [];
  const warnings: string[] = [];
  const tasks: Promise<void>[] = [];

  // ──── 1. 커뮤니티 (더쿠 · 네이버 블로그) ────────────────
  // 검색어는 아티스트별 communitySearchTerms 변수에서 가져옴
  const communityTerms        = artist.sources.communitySearchTerms   || [];
  const communityBoards       = artist.sources.communityBoards        || [];
  const communitySharedBoards = artist.sources.communitySharedBoards  || [];
  const sharedBoardTerms      = artist.sources.sharedBoardFilterTerms || [];
  if (
    communityTerms.length > 0 ||
    communityBoards.length > 0 ||
    communitySharedBoards.length > 0 ||
    sharedBoardTerms.length > 0
  ) {
    tasks.push(
      (async () => {
        const url = new URL("/api/community", origin);
        url.searchParams.set("terms",        communityTerms.join(","));
        url.searchParams.set("boards",       communityBoards.join(","));
        url.searchParams.set("sharedBoards", communitySharedBoards.join(","));
        url.searchParams.set("sharedTerms",  sharedBoardTerms.join(","));
        url.searchParams.set("artistId",     artist.id);
        try {
          const res = await fetch(url.toString(), { next: { revalidate: 0 } });
          const data = await res.json();
          if (Array.isArray(data.cards)) {
            allCards.push(...data.cards);
          }
        } catch {}
      })()
    );
  }

  // ──── 2. YouTube ─────────────────────────────────────
  const dataApiAvailable =
    Boolean(process.env.TUBE_API_KEY || process.env.YOUTUBE_API_KEY) &&
    process.env.YOUTUBE_DATA_API_ENABLED === "true";

  // 글로벌 소속사 채널 + 아티스트별 그룹/공유 채널 합집합 — 이 채널만 matchKeywords 필터 적용
  const sharedChannelSet = new Set<string>([
    ...SHARED_YOUTUBE_CHANNELS,
    ...(artist.sources.youtubeSharedChannelIds || []),
  ]);
  // 전용 + shared 모두 fetch 대상 (중복 제거)
  const allChannelIds = Array.from(new Set([
    ...(artist.sources.youtubeChannelIds || []),
    ...(artist.sources.youtubeSharedChannelIds || []),
  ]));

  if (dataApiAvailable && allChannelIds.length) {
    // channels.list + playlistItems.list (search.list 대비 100배 quota 절약)
    tasks.push(
      (async () => {
        const result = await fetchYoutubeChannels(origin, allChannelIds, artist.id);
        if (result.error) warnings.push(result.error);
        const filtered = result.cards.filter(card => {
          const isShared = sharedChannelSet.has(card.sourceId);
          return !isShared || matchesArtist(card, matchKeywords);
        });
        allCards.push(...filtered);
      })()
    );
  } else {
    // RSS fallback (API 키 없을 때, quota 0)
    allChannelIds.forEach(channelId => {
      tasks.push(
        (async () => {
          const xml = await fetchRSS(youtubeChannelUrl(channelId));
          if (xml) {
            const cards = parseRSS(
              xml,
              "youtube",
              channelId,
              artist.sources.youtubeChannelNames?.[channelId] || "YouTube",
              artist.id
            ).map(card => ({ ...card, youtubeCategory: "official" as const }));
            const isShared = sharedChannelSet.has(channelId);
            const filtered = isShared
              ? cards.filter(c => matchesArtist(c, matchKeywords))
              : cards;
            allCards.push(...filtered);
          }
        })()
      );
    });
  }

  const youtubeQueries = Array.from(
    new Set([
      ...(artist.sources.youtubeSearchQueries || []),
      ...buildCustomYoutubeQueries(youtubeCustomQueryTerms, customKeywords),
    ].map(query => query.trim()).filter(Boolean))
  );

  if (includeYoutubeSearch) {
    tasks.push(
      (async () => {
        const result = await fetchYoutubeSearch(
          origin,
          youtubeQueries,
          youtubeOrder,
          artist.id,
          useYoutubeSearchApi,
        );
        if (result.error) warnings.push(result.error);
        const filtered = result.cards.filter(card =>
          matchesYoutubeSearch(card, youtubeIdentityKeywords, youtubeExcludeKeywords)
        );
        allCards.push(...filtered);
      })()
    );
  }

  // ──── 3. News ────────────────────────────────────────
  artist.sources.newsKeywords?.forEach(keyword => {
    tasks.push(
      (async () => {
        const cards = await fetchNewsCards(origin, keyword, artist.id);
        const normalized = cards.map(card => {
          if (card.sourceName !== "Google News") return card;

          const realSource = extractNewsSource(card.title);
          const cleanTitle = cleanNewsTitle(card.title);
          return {
            ...card,
            title: cleanTitle,
            sourceId: realSource,
            sourceName: realSource,
          };
        });

        const filtered = normalized.filter(card => matchesArtistNews(card, artist));
        allCards.push(...filtered);
      })()
    );
  });

  await Promise.all(tasks);

  // 중복 제거
  const seen = new Set<string>();
  const uniqueCards = allCards.filter(c => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });

  uniqueCards.sort((a, b) => {
    if (
      youtubeOrder === "relevance" &&
      a.source === "youtube" &&
      b.source === "youtube" &&
      a.youtubeCategory === "search" &&
      b.youtubeCategory === "search"
    ) {
      return (a.youtubeSearchRank ?? 9999) - (b.youtubeSearchRank ?? 9999);
    }

    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  });

  return NextResponse.json({ cards: uniqueCards, warnings });
}
