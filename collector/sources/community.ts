// ─────────────────────────────────────────────────────
// 커뮤니티 수집 — DC Inside 스크레이핑 + 네이버 블로그 + 더쿠 링크
// app/api/community/route.ts 이식 + 태민 하드코딩 제거 (config 주입, PR-4)
// ─────────────────────────────────────────────────────

import { Artist, FeedCard } from "../../lib/types";
import { hashId, stripTags, UNKNOWN_DATE_ISO } from "../../lib/shared";

const DC_PAGES_PER_BOARD = 3;
const DC_PAGE_DELAY_MS = 1000; // 원본 부하 예의
const NAVER_BLOG_DISPLAY = 20;
const THEQOO_WEB_DISPLAY = 20;

type CommunityNaverConfig = NonNullable<Artist["sources"]["communityNaver"]>;

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function matchesTitle(title: string, terms: string[]): boolean {
  if (terms.length === 0) return true;
  const lower = title.toLowerCase();
  return terms.some(t => lower.includes(t.toLowerCase()));
}

/** 네이버 블로그·더쿠 관련성 판정 — 전부 config 주입, 아티스트 문자열 참조 0 */
function isRelevantNaver(title: string, summary: string, cfg: CommunityNaverConfig): boolean {
  const text = normalizeText(`${title} ${summary}`);
  if (!cfg.primaryTerms.some(term => text.includes(term.toLowerCase()))) return false;
  if (cfg.excludeTerms.some(term => text.includes(term.toLowerCase()))) return false;
  if (cfg.includeGroups.some(group => group.every(term => text.includes(term.toLowerCase())))) {
    return true;
  }
  return cfg.contextTerms.some(term => text.includes(term.toLowerCase()));
}

function isTheqooLink(link: string): boolean {
  try {
    const host = new URL(link).hostname.replace(/^www\./, "");
    return host === "theqoo.net" || host.endsWith(".theqoo.net");
  } catch {
    return link.includes("theqoo.net");
  }
}

function boardNameFromUrl(url: string, artist: Artist): string {
  const idMatch = url.match(/[?&]id=([^&]+)/);
  const id = idMatch?.[1] ?? "";
  return artist.sources.boardNames?.[id] ?? `디씨 ${id}갤`;
}

// ─── DC Inside 마이너 갤러리 스크레이핑 ─────────────────────────
async function fetchDCInside(
  boardUrl: string,
  name: string,
  needsFilter: boolean,
  filterTerms: string[],
  artistId: string,
): Promise<FeedCard[]> {
  const cards: FeedCard[] = [];

  for (let page = 1; page <= DC_PAGES_PER_BOARD; page += 1) {
    const pageUrl = new URL(boardUrl);
    pageUrl.searchParams.set("page", String(page));

    const res = await fetch(pageUrl.toString(), {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Referer": "https://gall.dcinside.com/",
        "Accept-Language": "ko-KR,ko;q=0.9",
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) continue;
    const html = await res.text();

    const rowPattern = /<tr[^>]+class="[^"]*ub-content[^"]*"[^>]*>([\s\S]*?)<\/tr>/g;
    let match: RegExpExecArray | null;
    while ((match = rowPattern.exec(html)) !== null) {
      const row = match[1];

      const linkMatch = row.match(/href="(\/(?:mgallery\/)?board\/view\/[^"]+)"/);
      if (!linkMatch) continue;
      const link = "https://gall.dcinside.com" + linkMatch[1];

      const titleRaw = row.match(/class="gall_tit[^"]*"[\s\S]*?<a[^>]+>([\s\S]*?)<\/a>/);
      if (!titleRaw) continue;
      const title = stripTags(titleRaw[1]);
      if (!title) continue;

      const dateMatch = row.match(/class="gall_date"[^>]*title="([^"]+)"/);
      const publishedAt = dateMatch
        ? new Date(dateMatch[1]).toISOString()
        : new Date().toISOString();

      if (needsFilter && !matchesTitle(title, filterTerms)) continue;

      cards.push({
        id: hashId(link, "c"),
        source: "community",
        communityProvider: "dcinside",
        sourceId: boardUrl,
        sourceName: name,
        title,
        summary: "",
        link,
        publishedAt,
        artistId,
      });
    }

    await new Promise(r => setTimeout(r, DC_PAGE_DELAY_MS));
  }

  return cards;
}

// ─── 네이버 검색 API 공통 ────────────────────────────────────────
async function naverSearch(endpoint: string, query: string, display: number): Promise<any[]> {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) return [];

  const url = new URL(`https://openapi.naver.com/v1/search/${endpoint}`);
  url.searchParams.set("query", query);
  url.searchParams.set("display", String(display));
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
  return Array.isArray(data.items) ? data.items : [];
}

async function fetchNaverBlog(cfg: CommunityNaverConfig, artistId: string): Promise<FeedCard[]> {
  const results = await Promise.all(cfg.blogQueries.map(async query => {
    const items = await naverSearch("blog.json", query, NAVER_BLOG_DISPLAY).catch(() => []);
    return items.flatMap((item: any): FeedCard[] => {
      const link: string = item.link || "";
      const pd: string = item.postdate || "";
      const title = stripTags(item.title || "");
      const summary = stripTags(item.description || "").slice(0, 200);
      if (!isRelevantNaver(title, summary, cfg)) return [];

      const publishedAt = pd.length === 8
        ? new Date(`${pd.slice(0, 4)}-${pd.slice(4, 6)}-${pd.slice(6, 8)}`).toISOString()
        : new Date().toISOString();
      return [{
        id: hashId(link || item.bloggername + pd, "c"),
        source: "community",
        communityProvider: "naver",
        sourceId: "naver-blog",
        sourceName: "네이버 블로그",
        title,
        summary,
        link,
        publishedAt,
        artistId,
      }];
    });
  }));
  return results.flat();
}

async function fetchTheqooLinks(cfg: CommunityNaverConfig, artistId: string): Promise<FeedCard[]> {
  const queries = cfg.webQueries.slice(0, 5);
  const results = await Promise.all(queries.map(async query => {
    const items = await naverSearch("webkr.json", query, THEQOO_WEB_DISPLAY).catch(() => []);
    return items.flatMap((item: any): FeedCard[] => {
      const link: string = item.link || "";
      const title = stripTags(item.title || "");
      const summary = stripTags(item.description || "").slice(0, 200);
      if (!link || !title) return [];
      if (!isTheqooLink(link)) return [];
      if (!isRelevantNaver(title, summary, cfg)) return [];

      return [{
        id: hashId(link, "c"),
        source: "community",
        communityProvider: "theqoo",
        sourceId: "theqoo",
        sourceName: "더쿠",
        title,
        summary: "",
        link,
        publishedAt: UNKNOWN_DATE_ISO,
        artistId,
      }];
    });
  }));
  return results.flat();
}

/** 아티스트의 커뮤니티 소스 전체 수집 */
export async function collectCommunity(artist: Artist): Promise<FeedCard[]> {
  const artistBoards = artist.sources.communityBoards || [];
  const sharedBoards = artist.sources.communitySharedBoards || [];
  const sharedTerms = artist.sources.sharedBoardFilterTerms || [];
  const naverCfg = artist.sources.communityNaver;

  const tasks: Promise<FeedCard[]>[] = [
    ...artistBoards.map(url =>
      fetchDCInside(url, boardNameFromUrl(url, artist), false, sharedTerms, artist.id).catch(() => []),
    ),
    ...sharedBoards.map(url =>
      fetchDCInside(url, boardNameFromUrl(url, artist), true, sharedTerms, artist.id).catch(() => []),
    ),
  ];

  if (naverCfg) {
    tasks.push(fetchNaverBlog(naverCfg, artist.id).catch(() => []));
    tasks.push(fetchTheqooLinks(naverCfg, artist.id).catch(() => []));
  }

  const results = await Promise.all(tasks);

  const seen = new Set<string>();
  return results.flat().filter(card => {
    if (seen.has(card.id)) return false;
    seen.add(card.id);
    return true;
  });
}
