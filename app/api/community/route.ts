import { NextRequest, NextResponse } from "next/server";
import { FeedCard } from "@/lib/types";

// ─────────────────────────────────────────────────────────────────
// 커뮤니티 데이터 수집 정책
//
// [아티스트 전용 게시판] communityBoards
//   DC Inside 마이너 갤러리 등 팬 전용 게시판.
//   모든 글을 필터링 없이 가져온다.
//
// [공유 게시판] SHARED_BOARDS (향후 확장용 — 현재 미사용)
//   전체 이용자 게시판. sharedBoardFilterTerms로 제목만 필터링.
//
// [네이버 블로그]
//   동명이인 방지를 위해 "가수 태민", "샤이니 태민" 중심으로 검색하고
//   결과 제목/요약을 다시 한 번 필터링한다.
//   NAVER_CLIENT_ID + NAVER_CLIENT_SECRET env 필요.
//
// [더쿠]
//   본문을 수집하지 않고 네이버 Web 검색 API의 제목/링크/요약만 카드화한다.
//   링크가 theqoo.net인 결과만 남기고 날짜는 API에서 받지 못하므로 날짜 미상 처리.
// ─────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 60 * 60 * 1000;
const DC_PAGES_PER_BOARD = 3;
const NAVER_BLOG_DISPLAY = 20;
const THEQOO_WEB_DISPLAY = 20;
const UNKNOWN_PUBLISHED_AT = "1970-01-01T00:00:00.000Z";
const cache = new Map<string, { expiresAt: number; cards: FeedCard[] }>();

function getCached(key: string): FeedCard[] | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) { cache.delete(key); return null; }
  return entry.cards;
}

function setCache(key: string, cards: FeedCard[]) {
  cache.set(key, { cards, expiresAt: Date.now() + CACHE_TTL_MS });
}

function hashId(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return `c${Math.abs(hash).toString(36)}`;
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, "").trim();
}

/** 제목에 filterTerms 중 하나라도 포함 → true (공유 게시판 전용) */
function matchesTitle(title: string, terms: string[]): boolean {
  if (terms.length === 0) return true;
  const lower = title.toLowerCase();
  return terms.some(t => lower.includes(t.toLowerCase()));
}

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

const NAVER_BLOG_QUERIES = [
  "가수 태민",
  "샤이니 태민",
];

const THEQOO_WEB_QUERIES = [
  "site:theqoo.net 태민",
  "site:theqoo.net 샤이니 태민",
  "site:theqoo.net TAEMIN",
];

const NAVER_INCLUDE_GROUPS = [
  ["가수", "태민"],
  ["샤이니", "태민"],
  ["shinee", "taemin"],
  ["shinee", "태민"],
  ["taemin", "샤이니"],
];

const NAVER_MUSIC_CONTEXT_TERMS = [
  "샤이니",
  "shinee",
  "가수",
  "아이돌",
  "솔로",
  "무대",
  "콘서트",
  "팬미팅",
  "앨범",
  "뮤직비디오",
  "직캠",
  "팬캠",
  "fancam",
  "move",
  "guilty",
  "괴도",
  "길티",
];

const NAVER_EXCLUDE_TERMS = [
  "유태민",
  "태민98",
  "담임",
  "담임목사",
  "목사",
  "교회",
  "목양",
  "bj",
  "아프리카tv",
  "롤",
  "리그오브레전드",
  "league of legends",
  "lol",
  "발로란트",
  "브롤스타즈",
  "pubg",
  "free fire",
];

function isRelevantNaverBlog(title: string, summary: string): boolean {
  const text = normalizeText(`${title} ${summary}`);
  if (!text.includes("태민") && !text.includes("taemin")) return false;
  if (NAVER_EXCLUDE_TERMS.some(term => text.includes(term.toLowerCase()))) return false;
  if (NAVER_INCLUDE_GROUPS.some(group => group.every(term => text.includes(term.toLowerCase())))) {
    return true;
  }
  return (text.includes("태민") || text.includes("taemin")) &&
    NAVER_MUSIC_CONTEXT_TERMS.some(term => text.includes(term.toLowerCase()));
}

function isTheqooLink(link: string): boolean {
  try {
    const host = new URL(link).hostname.replace(/^www\./, "");
    return host === "theqoo.net" || host.endsWith(".theqoo.net");
  } catch {
    return link.includes("theqoo.net");
  }
}

// ─── DC Inside 마이너 갤러리 HTML 스크레이핑 ─────────────────────
// 게시판 목록 페이지에서 ub-content 행을 파싱해 FeedCard 반환
async function fetchDCInside(
  boardUrl: string,
  name: string,
  needsFilter: boolean,
  filterTerms: string[],
  artistId: string,
): Promise<FeedCard[]> {
  try {
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

      // ub-content 행 추출
      const rowPattern = /<tr[^>]+class="[^"]*ub-content[^"]*"[^>]*>([\s\S]*?)<\/tr>/g;

      let match: RegExpExecArray | null;
      while ((match = rowPattern.exec(html)) !== null) {
        const row = match[1];

        // 링크: /mgallery/board/view/ 또는 /board/view/ 경로
        const linkMatch = row.match(/href="(\/(?:mgallery\/)?board\/view\/[^"]+)"/);
        if (!linkMatch) continue;
        const link = "https://gall.dcinside.com" + linkMatch[1];

        // 제목: gall_tit a 내부, <em> 다음 텍스트
        const titleRaw = row.match(/class="gall_tit[^"]*"[\s\S]*?<a[^>]+>([\s\S]*?)<\/a>/);
        if (!titleRaw) continue;
        const title = decodeHtmlEntities(stripTags(titleRaw[1])).replace(/\s+/g, " ").trim();
        if (!title) continue;

        // 날짜: gall_date title 속성 (정확한 datetime)
        const dateMatch = row.match(/class="gall_date"[^>]*title="([^"]+)"/);
        const publishedAt = dateMatch
          ? new Date(dateMatch[1]).toISOString()
          : new Date().toISOString();

        if (needsFilter && !matchesTitle(title, filterTerms)) continue;

        cards.push({
          id: hashId(link),
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
    }

    return cards;
  } catch {
    return [];
  }
}

// 게시판 URL에서 표시명 추출
function boardNameFromUrl(url: string): string {
  const idMatch = url.match(/[?&]id=([^&]+)/);
  const id = idMatch?.[1] ?? "";
  const names: Record<string, string> = {
    taemin: "디씨 태민갤",
    shinee: "디씨 샤이니갤",
  };
  return names[id] ?? `디씨 ${id}갤`;
}

// ─── 네이버 블로그 검색 API ─────────────────────────────────────
async function fetchNaverBlog(
  terms: string[],
  clientId: string,
  clientSecret: string,
  artistId: string,
): Promise<FeedCard[]> {
  const queries = Array.from(new Set([
    ...NAVER_BLOG_QUERIES,
    ...terms.filter(term =>
      term.includes("가수") ||
      term.includes("샤이니") ||
      term.toLowerCase().includes("shinee")
    ),
  ]));
  if (queries.length === 0) return [];

  try {
    const results = await Promise.all(queries.map(async query => {
      const url = new URL("https://openapi.naver.com/v1/search/blog.json");
      url.searchParams.set("query", query);
      url.searchParams.set("display", String(NAVER_BLOG_DISPLAY));
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

      return data.items.flatMap((item: any): FeedCard[] => {
        const link: string = item.link || "";
        const pd: string = item.postdate || "";
        const title = stripTags(decodeHtmlEntities(item.title || ""));
        const summary = stripTags(decodeHtmlEntities(item.description || "")).slice(0, 200);
        if (!isRelevantNaverBlog(title, summary)) return [];

        const publishedAt = pd.length === 8
          ? new Date(`${pd.slice(0, 4)}-${pd.slice(4, 6)}-${pd.slice(6, 8)}`).toISOString()
          : new Date().toISOString();
        return [{
          id: hashId(link || item.bloggername + pd),
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
  } catch {
    return [];
  }
}

// ─── 더쿠 링크 카드 검색 API ─────────────────────────────────────
async function fetchTheqooLinks(
  terms: string[],
  clientId: string,
  clientSecret: string,
  artistId: string,
): Promise<FeedCard[]> {
  const extraQueries = terms
    .filter(term =>
      term.includes("태민") ||
      term.includes("샤이니") ||
      term.toLowerCase().includes("taemin") ||
      term.toLowerCase().includes("shinee")
    )
    .map(term => `site:theqoo.net ${term}`);

  const queries = Array.from(new Set([...THEQOO_WEB_QUERIES, ...extraQueries])).slice(0, 5);
  if (queries.length === 0) return [];

  try {
    const results = await Promise.all(queries.map(async query => {
      const url = new URL("https://openapi.naver.com/v1/search/webkr.json");
      url.searchParams.set("query", query);
      url.searchParams.set("display", String(THEQOO_WEB_DISPLAY));
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

      return data.items.flatMap((item: any): FeedCard[] => {
        const link: string = item.link || "";
        const title = stripTags(decodeHtmlEntities(item.title || ""));
        const summary = stripTags(decodeHtmlEntities(item.description || "")).slice(0, 200);
        if (!link || !title) return [];
        if (!isTheqooLink(link)) return [];
        if (!isRelevantNaverBlog(title, summary)) return [];

        return [{
          id: hashId(link),
          source: "community",
          communityProvider: "theqoo",
          sourceId: "theqoo",
          sourceName: "더쿠",
          title,
          summary: "",
          link,
          publishedAt: UNKNOWN_PUBLISHED_AT,
          artistId,
        }];
      });
    }));

    return results.flat();
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const termsParam        = searchParams.get("terms")        || "";
  const boardsParam       = searchParams.get("boards")       || "";
  const sharedBoardsParam = searchParams.get("sharedBoards") || "";
  const sharedTermsParam  = searchParams.get("sharedTerms")  || "";
  const artistId          = searchParams.get("artistId")     || "unknown";

  const terms        = termsParam.split(",").map(t => t.trim()).filter(Boolean);
  const artistBoards = boardsParam.split(",").map(b => b.trim()).filter(Boolean);
  const sharedBoards = sharedBoardsParam.split(",").map(b => b.trim()).filter(Boolean);
  const sharedTerms  = sharedTermsParam.split(",").map(t => t.trim()).filter(Boolean);

  const cacheKey = `${artistId}:${boardsParam}:${sharedBoardsParam}:${sharedTermsParam}:${termsParam}`;
  const cached = getCached(cacheKey);
  if (cached) return NextResponse.json({ cards: cached, cached: true });

  const NAVER_CLIENT_ID     = process.env.NAVER_CLIENT_ID;
  const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;

  const tasks: Promise<FeedCard[]>[] = [
    // 아티스트 전용 게시판 — 필터 없이 모든 글 (needsFilter=false)
    ...artistBoards.map(url =>
      fetchDCInside(url, boardNameFromUrl(url), false, sharedTerms, artistId)
    ),
    // 그룹/공유 게시판 — sharedTerms로 제목 필터 (needsFilter=true)
    ...sharedBoards.map(url =>
      fetchDCInside(url, boardNameFromUrl(url), true, sharedTerms, artistId)
    ),
  ];

  if (NAVER_CLIENT_ID && NAVER_CLIENT_SECRET) {
    tasks.push(fetchNaverBlog(terms, NAVER_CLIENT_ID, NAVER_CLIENT_SECRET, artistId));
    tasks.push(fetchTheqooLinks(terms, NAVER_CLIENT_ID, NAVER_CLIENT_SECRET, artistId));
  }

  const results = await Promise.all(tasks);

  const seen = new Set<string>();
  const cards = results
    .flat()
    .filter(card => {
      if (seen.has(card.id)) return false;
      seen.add(card.id);
      return true;
    })
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  setCache(cacheKey, cards);
  return NextResponse.json({ cards, cached: false });
}
