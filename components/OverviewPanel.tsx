"use client";

import { FeedCard, UpcomingEvent } from "@/lib/types";
import { formatTimeAgo as formatTime, isUnknownDate } from "@/lib/shared";

type SourceId = "all" | "twitter" | "community" | "youtube" | "news";

interface Props {
  cards: FeedCard[];
  counts: {
    all: number;
    twitter: number;
    community: number;
    youtube: number;
    news: number;
  };
  artistName: string;
  primaryColor: string;
  upcomingEvents?: UpcomingEvent[];
  // 클러스터 토큰화 시 stopword에 추가할 아티스트 본인 식별자(name/en/aliases).
  // groupName은 일부러 제외 — 솔로/그룹 클러스터 분리 의도.
  clusterStopTerms?: string[];
  onSelectSource: (source: SourceId) => void;
}

const HOT_TERMS = [
  "컴백", "티저", "콘서트", "팬미팅", "공연", "앨범", "스케줄",
  "공지", "예매", "티켓", "방송", "무대", "단독", "공식",
  "신곡", "신보", "발표", "확정", "데뷔",
];

const MUST_SEE_RE = /컴백|신곡|신보|단독|콘서트|팬미팅|예매|티저|공지|발표|확정|데뷔/;
const FOR_FUN_RE = /직캠|팬캠|fancam|focus|커버|cover|리액션|reaction/i;

// ── Negative-weight damping ─────────────────────────────────────────────
// 정보를 제거하지 않음. headline/cluster 랭킹에서만 우선순위를 낮춰 어그로 도배를 완화.
// 일반 피드(BucketSection)에는 그대로 노출됨.
const NEGATIVE_TERMS_T1 = ["의혹", "추측", "카더라", "루머", "찌라시"];
const NEGATIVE_TERMS_T2 = [
  "열애", "결별", "성형", "시술", "학폭", "폭로",
  "저격", "갑질", "음주", "도박", "마약",
];
const NEGATIVE_TERMS_T3 = ["억까", "주작", "박제", "어그로", "정리글"];
// 공식 입장·인정은 페널티 면제 (정보 가치가 있는 공식 발표)
const NEUTRALIZERS = [
  "인정", "공식입장", "공식 입장", "공식 발표", "측 입장", "해명 완료",
];
// "전설/가설/건설"은 매칭 안 되도록 prefix 한정
const SUFFIX_RUMOR_RE = /(연애|열애|결별|이별|불화|복귀|루머)\s?설/;
// 페널티 cap — 정보를 너무 깊이 묻지 않도록 상한
const NEGATIVE_PENALTY_CAP = 18;
// 헤드라인 가드 임계값 — 2위 점수가 1위의 80% 이상이면 swap 허용
const HEADLINE_SWAP_RATIO = 0.8;

function clusterHasOfficial(cluster: Cluster): boolean {
  return cluster.cards.some(
    c => c.source === "youtube" && c.youtubeCategory === "official"
  );
}

function negativePenalty(text: string, hasOfficial: boolean): number {
  const lower = text.toLowerCase();
  // 중화: 클러스터에 공식 카드가 있거나, 텍스트에 공식 입장/인정 패턴이 있으면 면제
  if (hasOfficial) return 0;
  if (NEUTRALIZERS.some(n => lower.includes(n))) return 0;

  let p = 0;
  if (NEGATIVE_TERMS_T1.some(k => lower.includes(k))) p += 5;
  if (NEGATIVE_TERMS_T2.some(k => lower.includes(k))) p += 10;
  if (NEGATIVE_TERMS_T3.some(k => lower.includes(k))) p += 7;
  if (SUFFIX_RUMOR_RE.test(lower)) p += 8;
  return Math.min(p, NEGATIVE_PENALTY_CAP);
}

/**
 * 4050·입문자용 K-pop 용어집.
 * 카드 제목에 매칭되면 "💡 입문자 가이드"로 한 줄 풀이가 붙는다.
 */
const TERM_GLOSSARY: Array<{ terms: string[]; explain: string }> = [
  { terms: ["코첼라", "coachella"], explain: "미국 최대 음악 페스티벌. K-pop 무대 = 글로벌 인지도 폭발 신호예요." },
  { terms: ["컴백", "신곡", "신보"], explain: "신보 발매 활동. 아티스트에게 1년 중 가장 큰 이벤트예요." },
  { terms: ["직캠", "팬캠", "fancam", "focus"], explain: "팬이 멤버 한 명만 집중 촬영한 무대 영상이에요." },
  { terms: ["단콘", "단독 콘서트"], explain: "그룹 활동 외 솔로/단독 공연이에요." },
  { terms: ["음방", "음악방송", "뮤뱅", "엠카", "쇼챔", "인기가요", "음악중심"], explain: "주요 음악 프로그램. 1위는 컴백 흥행의 기준이에요." },
  { terms: ["티저"], explain: "컴백 직전 공개하는 짧은 예고편이에요." },
  { terms: ["프롬", "위버스", "버블"], explain: "팬-아티스트 사적 메시지 플랫폼 (유료 구독)." },
  { terms: ["뮤직비디오", "뮤비"], explain: "신곡 공개와 함께 나오는 공식 영상이에요." },
  { terms: ["빌보드", "billboard"], explain: "미국 메인 차트. 해외 인지도 지표예요." },
  { terms: ["오리콘", "oricon"], explain: "일본 메인 차트. 일본 시장 지표예요." },
  { terms: ["팬싸", "팬사인회"], explain: "앨범 구매 응모로 참여하는 팬-아티스트 대면 행사예요." },
  { terms: ["굿즈"], explain: "아티스트 공식 상품 (포카, 응원봉 등)." },
];

function getMinutesAgo(card: FeedCard): number {
  const d = new Date(card.publishedAt);
  if (Number.isNaN(d.getTime()) || isUnknownDate(card.publishedAt)) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 60000));
}

function getEventDDay(dateStr: string): { dday: number; label: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  const diff = Math.ceil((target.getTime() - today.getTime()) / 86400000);
  return {
    dday: diff,
    label: diff === 0 ? "D-DAY" : diff > 0 ? `D-${diff}` : `D+${Math.abs(diff)}`,
  };
}

function formatEventDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

function getEventKindLabel(kind: UpcomingEvent["kind"]): string {
  switch (kind) {
    case "comeback": return "컴백";
    case "concert": return "콘서트";
    case "fanmeeting": return "팬미팅";
    case "broadcast": return "방송";
    case "release": return "발매";
    case "ticket": return "예매";
    default: return "일정";
  }
}

function getDDayClass(dday: number): string {
  if (dday < 0) return "text-slate-500";
  if (dday <= 3) return "text-red-300";
  if (dday <= 14) return "text-amber-300";
  return "text-cyan-200";
}

type TrustBadge = { label: string; color: string; dot: string };

function getTrustBadge(card: FeedCard): TrustBadge {
  if (card.source === "youtube" && card.youtubeCategory === "official") {
    return { label: "공식", color: "#34d399", dot: "🟢" };
  }
  if (card.source === "news") {
    return { label: "언론보도", color: "#fbbf24", dot: "🟡" };
  }
  if (card.source === "community") {
    return { label: "팬커뮤니티", color: "#a78bfa", dot: "🟣" };
  }
  if (card.source === "twitter") {
    return { label: "X 반응", color: "#60a5fa", dot: "🔵" };
  }
  if (card.source === "youtube" && card.youtubeCategory === "search") {
    return { label: "영상", color: "#f87171", dot: "🔴" };
  }
  return { label: "기타", color: "#94a3b8", dot: "⚪" };
}

function getContextHint(card: FeedCard): string | null {
  const text = `${card.title} ${card.summary}`.toLowerCase();
  for (const entry of TERM_GLOSSARY) {
    if (entry.terms.some(t => text.includes(t.toLowerCase()))) {
      return entry.explain;
    }
  }
  return null;
}

/**
 * 제목 토큰화 — 클러스터링 입력.
 * 아티스트 본인 식별자(name/en/aliases)와 일반어를 stopword로 빼서 진짜 토픽 키워드만 남긴다.
 * groupName은 stopword에서 제외 — 솔로/그룹 클러스터를 분리하기 위함.
 */
function tokenizeForCluster(
  card: FeedCard,
  artistName: string,
  extraStopTerms?: Iterable<string>,
): Set<string> {
  const stop = new Set<string>([
    artistName.toLowerCase(),
    "뉴스", "공식", "영상", "직캠", "팬캠",
    "관련", "오늘", "단독", "포토엔hd", "포토",
    "이번", "최초", "보도", "기자", "한국",
  ]);
  if (extraStopTerms) {
    for (const term of extraStopTerms) {
      const t = term?.trim().toLowerCase();
      if (t) stop.add(t);
    }
  }
  const text = card.title.replace(/[^\p{L}\p{N}\s]/gu, " ");
  return new Set(
    text.split(/\s+/)
      .map(t => t.trim().toLowerCase())
      .filter(t => t.length >= 2 && !stop.has(t))
  );
}

type Cluster = { tokens: Set<string>; cards: FeedCard[]; topCard: FeedCard };

function cardPriority(card: FeedCard): number {
  if (card.source === "youtube" && card.youtubeCategory === "official") return 5;
  if (card.source === "news") return 4;
  if (card.source === "community") return 3;
  if (card.source === "twitter") return 2;
  return 1;
}

function clusterCards(
  cards: FeedCard[],
  artistName: string,
  extraStopTerms?: Iterable<string>,
): Cluster[] {
  const clusters: Cluster[] = [];
  for (const card of cards) {
    const tokens = tokenizeForCluster(card, artistName, extraStopTerms);
    if (tokens.size === 0) {
      clusters.push({ tokens, cards: [card], topCard: card });
      continue;
    }
    let merged = false;
    for (const cluster of clusters) {
      const overlap = [...tokens].filter(t => cluster.tokens.has(t)).length;
      const smaller = Math.min(tokens.size, cluster.tokens.size);
      const ratio = smaller > 0 ? overlap / smaller : 0;
      if (overlap >= 2 || (ratio >= 0.5 && overlap >= 1)) {
        cluster.cards.push(card);
        tokens.forEach(t => cluster.tokens.add(t));
        if (cardPriority(card) > cardPriority(cluster.topCard)) {
          cluster.topCard = card;
        }
        merged = true;
        break;
      }
    }
    if (!merged) clusters.push({ tokens, cards: [card], topCard: card });
  }
  return clusters;
}

function scoreCluster(cluster: Cluster): number {
  const top = cluster.topCard;
  const text = `${top.title} ${top.summary}`.toLowerCase();
  // cards.length 가중치 cap — 도배(同 사건 10+ 매체 반복)가 점수를 독식하지 못하도록
  let score = Math.min(cluster.cards.length, 5) * 3;

  const recency = getMinutesAgo(top);
  if (recency <= 60) score += 10;
  else if (recency <= 360) score += 6;
  else if (recency <= 1440) score += 3;
  else if (recency > 10080) score -= 8; // 7일 초과: stale cluster 디모트

  const hasOfficial = clusterHasOfficial(cluster);
  if (hasOfficial) score += 15;
  if (HOT_TERMS.some(t => text.includes(t.toLowerCase()))) score += 8;
  if (MUST_SEE_RE.test(text)) score += 5;

  const newsCount = cluster.cards.filter(c => c.source === "news").length;
  if (newsCount >= 3) score += 6;
  if (newsCount >= 5) score += 4;

  // Negative-weight damping (cap, floor 0)
  score -= negativePenalty(text, hasOfficial);
  if (score < 0) score = 0;

  return score;
}

type Bucket = "mustSee" | "trending" | "forFun";

function bucketOf(card: FeedCard): Bucket {
  const text = `${card.title} ${card.summary}`.toLowerCase();
  if (card.source === "youtube" && card.youtubeCategory === "official") return "mustSee";
  if (MUST_SEE_RE.test(text)) return "mustSee";
  if (card.source === "news" && /공식|발표|확정|단독/.test(text)) return "mustSee";
  if (FOR_FUN_RE.test(card.title)) return "forFun";
  if (card.source === "youtube" && card.youtubeCategory === "search") return "forFun";
  return "trending";
}

function uniqueById(cards: FeedCard[]) {
  const seen = new Set<string>();
  return cards.filter(card => {
    if (seen.has(card.id)) return false;
    seen.add(card.id);
    return true;
  });
}

function getTLDR(cards: FeedCard[]) {
  const officialCard = cards.find(c =>
    (c.source === "youtube" && c.youtubeCategory === "official") ||
    (c.source === "news" && /공식|발표|확정/.test(c.title))
  );
  const trendingCard = cards.filter(c => c.source === "news")
    .find(c => HOT_TERMS.some(t => c.title.toLowerCase().includes(t.toLowerCase())))
    || cards.find(c => c.source === "news");
  const fandomCard = cards.find(c => c.source === "community")
    || cards.find(c => c.source === "twitter");
  return { officialCard, trendingCard, fandomCard };
}

/**
 * 헤드라인 가드 (D3) — 1위 클러스터가 negative 점수면, 2위가 1위의 80% 이상 점수일 때 swap.
 * 정보 자체는 다른 섹션/일반 피드에 그대로 노출됨.
 */
function pickHeadline(
  ranked: Array<{ cluster: Cluster; score: number }>
): Cluster | null {
  if (ranked.length === 0) return null;
  const first = ranked[0];
  const firstHasOfficial = clusterHasOfficial(first.cluster);
  if (firstHasOfficial) return first.cluster;
  const firstText = `${first.cluster.topCard.title} ${first.cluster.topCard.summary}`;
  const firstPenalty = negativePenalty(firstText, false);
  if (firstPenalty < 8) return first.cluster;
  const second = ranked[1];
  if (!second) return first.cluster;
  if (second.score >= first.score * HEADLINE_SWAP_RATIO) {
    return second.cluster;
  }
  return first.cluster;
}

// ── 컴포넌트 ────────────────────────────────────────────────────────────

export default function OverviewPanel({
  cards,
  counts,
  artistName,
  primaryColor,
  upcomingEvents = [],
  clusterStopTerms,
  onSelectSource,
}: Props) {
  const unique = uniqueById(cards);
  const total = unique.length;

  const clusters = clusterCards(unique, artistName, clusterStopTerms);
  const ranked = clusters
    .map(c => ({ cluster: c, score: scoreCluster(c) }))
    .sort((a, b) => b.score - a.score);

  const headline = pickHeadline(ranked);
  const headlineIds = new Set((headline?.cards || []).slice(0, 8).map(c => c.id));
  const rest = unique.filter(c => !headlineIds.has(c.id));

  const tldr = getTLDR(unique);
  const mustSee = rest.filter(c => bucketOf(c) === "mustSee").slice(0, 4);
  const trending = rest.filter(c => bucketOf(c) === "trending").slice(0, 4);
  const forFun = rest.filter(c => bucketOf(c) === "forFun").slice(0, 4);

  return (
    <section className="mx-4 mb-3 space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
            Today Briefing
          </div>
          <h2 className="text-base font-black text-slate-100">오늘의 {artistName} · 한눈에</h2>
        </div>
        <div className="text-[11px] font-semibold text-slate-500">{total}개 수집</div>
      </div>

      {headline ? (
        <HeadlineCard cluster={headline} primaryColor={primaryColor} />
      ) : (
        <div className="rounded-xl border border-slate-800 bg-slate-900/45 px-4 py-5 text-center text-[12px] text-slate-500">
          오늘은 조용해요. 잠시 후 새로고침해보세요.
        </div>
      )}

      <TLDRSection tldr={tldr} />

      <UpcomingEventsBlock events={upcomingEvents} primaryColor={primaryColor} />

      <div className="grid grid-cols-4 gap-2">
        <SourceButton label="X"        count={counts.twitter}   onClick={() => onSelectSource("twitter")} />
        <SourceButton label="커뮤니티" count={counts.community} onClick={() => onSelectSource("community")} />
        <SourceButton label="영상"     count={counts.youtube}   onClick={() => onSelectSource("youtube")} />
        <SourceButton label="뉴스"     count={counts.news}      onClick={() => onSelectSource("news")} />
      </div>

      <BucketSection
        title="🚨 꼭 봐야 함"
        caption="공식 발표 · 컴백 · 콘서트같이 놓치면 안 될 것"
        cards={mustSee}
        emptyText="오늘은 꼭 챙길 공식 소식이 없어요"
        actionLabel={mustSee.length > 0 ? "전체" : undefined}
        onAction={() => onSelectSource("all")}
        showContext
        primaryColor={primaryColor}
      />

      <BucketSection
        title="🔥 지금 화제"
        caption="여러 매체가 동시에 다루는 이슈"
        cards={trending}
        emptyText="아직 뜨는 이슈는 없어요"
        actionLabel={trending.length > 0 ? "뉴스" : undefined}
        onAction={() => onSelectSource("news")}
        showContext
        primaryColor={primaryColor}
      />

      <BucketSection
        title="💎 여유 되면"
        caption="직캠 · 팬캠 · 즐길거리"
        cards={forFun}
        emptyText="즐길거리 영상이 아직 없어요"
        actionLabel={forFun.length > 0 ? "영상" : undefined}
        onAction={() => onSelectSource("youtube")}
        compact
        primaryColor={primaryColor}
      />
    </section>
  );
}

// ── 서브 컴포넌트 ────────────────────────────────────────────────────────

function HeadlineCard({ cluster, primaryColor }: { cluster: Cluster; primaryColor: string }) {
  const top = cluster.topCard;
  const trust = getTrustBadge(top);
  const context = getContextHint(top);
  const relatedCount = cluster.cards.length;
  const otherSources = Array.from(
    new Set(cluster.cards.filter(c => c.id !== top.id).map(c => c.sourceName))
  ).slice(0, 3);

  return (
    <a
      href={top.link}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-2xl border-2 p-4 transition-colors hover:bg-slate-900/60"
      style={{ borderColor: `${primaryColor}55`, backgroundColor: `${primaryColor}10` }}
    >
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-black"
          style={{ backgroundColor: primaryColor, color: "#0d0d1a" }}
        >
          오늘의 헤드라인
        </span>
        <span
          className="rounded-full border px-1.5 py-0.5 text-[10px] font-bold"
          style={{ color: trust.color, borderColor: `${trust.color}55` }}
        >
          {trust.dot} {trust.label}
        </span>
        {relatedCount > 1 && (
          <span className="rounded-full bg-slate-800/80 px-1.5 py-0.5 text-[10px] font-bold text-slate-300">
            관련 {relatedCount}건
          </span>
        )}
      </div>

      <div className="text-[15px] font-black leading-snug text-slate-100">
        {top.title}
      </div>

      {context && (
        <div className="mt-2 rounded-lg bg-slate-950/55 px-3 py-2 text-[11px] leading-relaxed text-slate-300">
          <span className="mr-1 font-bold text-slate-200">💡 입문자 가이드</span>
          {context}
        </div>
      )}

      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
        <span className="truncate">
          {top.sourceName}
          {otherSources.length > 0 && (
            <span className="text-slate-500"> · {otherSources.join(" · ")}</span>
          )}
        </span>
        <span className="flex-shrink-0">{formatTime(top.publishedAt)}</span>
      </div>
    </a>
  );
}

function TLDRSection({ tldr }: { tldr: ReturnType<typeof getTLDR> }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/45 p-3">
      <div className="mb-2 text-[12px] font-bold text-slate-200">📌 오늘 3줄 요약</div>
      <div className="space-y-0.5">
        <TLDRLine icon="🚨" label="공식"  card={tldr.officialCard}  emptyText="오늘 공식 채널은 조용해요" />
        <TLDRLine icon="📰" label="화제"  card={tldr.trendingCard}  emptyText="뉴스가 잠잠한 하루예요" />
        <TLDRLine icon="💬" label="팬덤"  card={tldr.fandomCard}    emptyText="팬덤 반응이 아직 비어요" />
      </div>
    </div>
  );
}

function TLDRLine({
  icon, label, card, emptyText,
}: {
  icon: string; label: string; card?: FeedCard; emptyText: string;
}) {
  if (!card) {
    return (
      <div className="flex items-center gap-2 px-1 py-1 text-[12px] text-slate-500">
        <span>{icon}</span>
        <span className="text-[10px] font-bold text-slate-500">{label}</span>
        <span className="text-slate-600">·</span>
        <span>{emptyText}</span>
      </div>
    );
  }
  return (
    <a
      href={card.link}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 rounded-lg px-1 py-1 transition-colors hover:bg-slate-950/40"
    >
      <span>{icon}</span>
      <span className="text-[10px] font-bold text-slate-400">{label}</span>
      <span className="line-clamp-1 flex-1 text-[12px] font-semibold text-slate-200">
        {card.title}
      </span>
    </a>
  );
}

function SourceButton({
  label, count, onClick,
}: { label: string; count: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-xl border border-slate-800 bg-slate-900/55 px-2.5 py-2 text-left transition-colors hover:border-slate-600"
    >
      <div className="text-[11px] font-semibold text-slate-500">{label}</div>
      <div className="mt-0.5 text-base font-extrabold text-slate-100">{count}</div>
    </button>
  );
}

function UpcomingEventsBlock({
  events,
  primaryColor,
}: {
  events: UpcomingEvent[];
  primaryColor: string;
}) {
  if (events.length === 0) return null;

  const sortedEvents = [...events].sort((a, b) => {
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/45 p-3">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[13px] font-bold text-slate-200">다가오는 일정</div>
          <div className="mt-0.5 text-[10px] text-slate-600">컴백 · 공연 · 예매 알림 후보</div>
        </div>
      </div>

      <div className="space-y-8">
        {sortedEvents.map(event => {
          const dday = getEventDDay(event.date);
          const ddayClass = getDDayClass(dday.dday);

          return (
            <div
              key={event.id}
              className="pt-1"
            >
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-1.5">
                    <span
                      className="rounded border px-1.5 py-px text-[9px] font-bold"
                      style={{ color: primaryColor, borderColor: `${primaryColor}55` }}
                    >
                      {getEventKindLabel(event.kind)}
                    </span>
                    <span className="text-[11px] font-medium text-slate-600">{formatEventDate(event.date)}</span>
                  </div>
                  <div className="line-clamp-1 text-[13px] font-bold text-slate-200">
                    {event.title}
                  </div>
                  {event.note && (
                    <div className="mt-1 line-clamp-2 text-[11px] font-normal leading-relaxed text-slate-600">
                      {event.note}
                    </div>
                  )}
                </div>

                <div className="flex flex-shrink-0 flex-col items-end gap-2">
                  <div className={`text-[15px] font-black leading-none ${ddayClass}`}>
                    {dday.label}
                  </div>
                  <button
                    type="button"
                    className="h-8 min-w-[76px] rounded-lg border border-slate-300 bg-white px-3 text-[11px] font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50"
                  >
                    예매 알림
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BucketSection({
  title, caption, cards, emptyText, primaryColor,
  showContext = false, compact = false, actionLabel, onAction,
}: {
  title: string;
  caption: string;
  cards: FeedCard[];
  emptyText: string;
  primaryColor: string;
  showContext?: boolean;
  compact?: boolean;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/45 p-3">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[13px] font-bold text-slate-200">{title}</div>
          <div className="mt-0.5 text-[10px] text-slate-600">{caption}</div>
        </div>
        {actionLabel && onAction && (
          <button
            onClick={onAction}
            className="flex-shrink-0 text-[11px] font-bold"
            style={{ color: primaryColor }}
          >
            {actionLabel}
          </button>
        )}
      </div>

      {cards.length === 0 ? (
        <div className="rounded-lg bg-slate-950/45 px-3 py-3 text-center text-[12px] text-slate-500">
          {emptyText}
        </div>
      ) : (
        <div className="space-y-5">
          {cards.map(card => (
            <BucketCard
              key={`${title}-${card.id}`}
              card={card}
              showContext={showContext}
              compact={compact}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BucketCard({
  card, showContext, compact,
}: { card: FeedCard; showContext: boolean; compact: boolean }) {
  const trust = getTrustBadge(card);
  const context = showContext ? getContextHint(card) : null;

  return (
    <a
      href={card.link}
      target="_blank"
      rel="noopener noreferrer"
      className="block transition-colors hover:bg-transparent"
    >
      <div className="mb-0.5 flex items-center gap-1.5">
        <span
          className="rounded border px-1 py-px text-[9px] font-bold"
          style={{ color: trust.color, borderColor: `${trust.color}55` }}
        >
          {trust.label}
        </span>
        <span className="text-[10px] text-slate-600">·</span>
        <span className="text-[10px] font-medium text-slate-500">{formatTime(card.publishedAt)}</span>
        <span className="ml-auto truncate text-[10px] font-medium text-slate-500">{card.sourceName}</span>
      </div>
      <div className={compact
        ? "line-clamp-1 text-[13px] font-bold text-slate-200"
        : "line-clamp-2 text-[13px] font-bold text-slate-200"}
      >
        {card.title}
      </div>
      {context && !compact && (
        <div className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-600">
          💡 {context}
        </div>
      )}
    </a>
  );
}
