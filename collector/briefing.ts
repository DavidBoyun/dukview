// ─────────────────────────────────────────────────────
// briefing builder — 수집 사이클마다 판단 1회 계산 → briefings 저장 (PR-8)
// UI·뉴스레터는 이 스냅샷만 소비 (DESIGN_PHASE_B.md B4, 결정 10)
// ─────────────────────────────────────────────────────

import { SupabaseClient } from "@supabase/supabase-js";
import { Artist, FeedCard } from "../lib/types";
import { mapCardRow } from "../lib/mapCardRow";
import { clusterCards, cardPriority } from "../lib/briefing/cluster";
import { scoreCluster, pickHeadline } from "../lib/briefing/score";
import { getTLDR } from "../lib/briefing/tldr";
import { cardTier, clusterStatus } from "../lib/briefing/trust";
import { Cluster, HeroBriefing, TldrLine } from "../lib/briefing/types";

// 소스별 입력 윈도 — 최신순 단일 윈도의 community 편향 해결점 (B4)
const WINDOWS = [
  { source: "news",      hours: 72,     limit: 100 },
  { source: "community", hours: 24,     limit: 150 },
  { source: "youtube",   hours: 24 * 7, limit: 50 },
] as const;

async function fetchWindow(
  db: SupabaseClient, artistId: string,
  source: string, hours: number, limit: number,
): Promise<FeedCard[]> {
  const since = new Date(Date.now() - hours * 3600 * 1000).toISOString();
  const { data, error } = await db.from("cards").select("*")
    .eq("artist_id", artistId).eq("source", source).eq("date_unknown", false)
    .gte("published_at", since)
    .order("published_at", { ascending: false }).limit(limit);
  if (error) throw new Error(`briefing 입력 조회 실패(${source}): ${error.message}`);
  return (data ?? []).map(mapCardRow);
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

// whyImportant 고정 템플릿 — 첫 매칭, 이 5개 외 추가 금지 (B4)
function whyImportant(hero: Omit<HeroBriefing, "whyImportant">): string {
  const { status, diversity } = hero;
  if (diversity.official > 0) return "공식 채널이 직접 올린 소식이에요";
  if (status === "confirmed" && diversity.news >= 3) return "여러 언론이 동시에 다루고 있어요";
  if (status === "likely") return "정황은 있지만 아직 공식 발표 전이에요";
  const kinds = [diversity.news, diversity.fandom, diversity.official].filter(n => n > 0).length;
  if (kinds >= 2) return "뉴스와 팬덤에서 함께 화제예요";
  return "지금 팬덤에서 가장 화제인 글이에요";
}

function buildHero(cluster: Cluster): HeroBriefing {
  const diversity = { news: 0, fandom: 0, official: 0 };
  for (const c of cluster.cards) {
    const tier = cardTier(c);
    if (tier === "official") diversity.official += 1;
    else if (tier === "press") diversity.news += 1;
    else diversity.fandom += 1;
  }
  const topCardIds = [...cluster.cards]
    .sort((a, b) =>
      cardPriority(b) - cardPriority(a) ||
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    )
    .slice(0, 5)
    .map(c => c.id);
  const base = {
    headline: cluster.topCard.title,
    status: clusterStatus(cluster),
    cardCount: cluster.cards.length,
    diversity,
    topCardIds,
  };
  return { ...base, whyImportant: whyImportant(base) };
}

const EMPTY_HERO: HeroBriefing = {
  headline: "오늘은 조용한 날이에요",
  status: "reaction",
  cardCount: 0,
  diversity: { news: 0, fandom: 0, official: 0 },
  whyImportant: "새 소식이 들어오면 바로 정리해 드릴게요",
  topCardIds: [],
};

// TL;DR 공백 고정문 (B4 — 조용한 날 정직 표기)
const TLDR_EMPTY: Record<TldrLine["kind"], string> = {
  official: "오늘 공식 채널은 조용해요",
  trending: "오늘은 큰 이슈 없이 조용한 날이에요",
  fandom: "팬덤도 잔잔한 하루예요",
};

function toTldrLine(kind: TldrLine["kind"], card: FeedCard | undefined): TldrLine {
  return card
    ? { kind, text: truncate(card.title, 60), cardId: card.id }
    : { kind, text: TLDR_EMPTY[kind] };
}

/** 반환: 입력 카드 총수 (collect_runs item_count용) */
export async function buildBriefing(db: SupabaseClient, artist: Artist): Promise<number> {
  const windows = await Promise.all(
    WINDOWS.map(w => fetchWindow(db, artist.id, w.source, w.hours, w.limit))
  );
  const bySource = Object.fromEntries(WINDOWS.map((w, i) => [w.source, windows[i].length]));
  const cards = windows.flat();

  let hero = EMPTY_HERO;
  if (cards.length > 0) {
    const stopTerms = [artist.name, artist.en, ...(artist.aliases || [])];
    const clusters = clusterCards(cards, artist.name, stopTerms);
    const ranked = clusters
      .map(c => ({ cluster: c, score: scoreCluster(c) }))
      .sort((a, b) => b.score - a.score);
    const heroCluster = pickHeadline(ranked);
    if (heroCluster) hero = buildHero(heroCluster);
  }

  const picks = getTLDR(cards);
  const tldr: TldrLine[] = [
    toTldrLine("official", picks.officialCard),
    toTldrLine("trending", picks.trendingCard),
    toTldrLine("fandom", picks.fandomCard),
  ];

  const dayAgo = Date.now() - 24 * 3600 * 1000;
  const stats = {
    cardCount24h: cards.filter(c => new Date(c.publishedAt).getTime() >= dayAgo).length,
    bySource,
    officialActive: cards.some(c => cardTier(c) === "official"),
  };

  // insert 후 구 행 is_latest 해제 (이 순서 고정 — 읽기는 built_at desc라 레이스 무해)
  const { data: inserted, error: insErr } = await db
    .from("briefings")
    .insert({ artist_id: artist.id, hero, tldr, stats, is_latest: true })
    .select("id")
    .single();
  if (insErr) throw new Error(`briefings insert 실패: ${insErr.message}`);
  const { error: updErr } = await db
    .from("briefings")
    .update({ is_latest: false })
    .eq("artist_id", artist.id)
    .neq("id", inserted.id);
  if (updErr) throw new Error(`briefings is_latest 해제 실패: ${updErr.message}`);

  return cards.length;
}
