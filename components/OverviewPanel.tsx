"use client";

import { FeedCard, UpcomingEvent } from "@/lib/types";
import { formatTimeAgo as formatTime } from "@/lib/shared";
import { Cluster } from "@/lib/briefing/types";
import { clusterCards } from "@/lib/briefing/cluster";
import { MUST_SEE_RE, FOR_FUN_RE, scoreCluster, pickHeadline } from "@/lib/briefing/score";
import { getTLDR } from "@/lib/briefing/tldr";

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

// 클러스터링·스코어링·TLDR 로직은 lib/briefing/으로 이식됨 (PR-7)

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
