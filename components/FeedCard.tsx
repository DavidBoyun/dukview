"use client";

import { useEffect, useState } from "react";
import { FeedCard as FeedCardType } from "@/lib/types";
import { useFilterContext } from "@/contexts/FilterContext";

interface Props {
  card: FeedCardType;
  collapsed?: boolean;
}

const COMMUNITY_META = {
  dcinside: { label: "디시", color: "#3232FF" },
  naver:    { label: "네이버", color: "#03C75A" },
  theqoo:   { label: "더쿠",  color: "#8B5CF6" },
} as const;

function formatTime(iso: string): string {
  if (iso === "1970-01-01T00:00:00.000Z") return "날짜 미상";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "날짜 미상";
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "방금 전";
  if (mins < 60) return `${mins}분 전`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}시간 전`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}일 전`;
  return d.toLocaleDateString("ko-KR");
}

// ── YouTube Card ──────────────────────────────────────────────────────────────

function YoutubeCard({ card, onBlock }: { card: FeedCardType; onBlock: (e: React.MouseEvent) => void }) {
  const isOfficial = card.youtubeCategory === "official";

  return (
    <a href={card.link} target="_blank" rel="noopener noreferrer" className="block mb-3 group card-enter">
      <div
        className="bg-slate-900/60 rounded-xl overflow-hidden transition-all"
        style={{ border: isOfficial ? "1px solid rgba(234,179,8,0.4)" : "1px solid rgba(51,65,85,0.4)" }}
      >
        {/* 16:9 썸네일 */}
        <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
          {card.thumbnail ? (
            <img
              src={card.thumbnail}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="absolute inset-0 bg-slate-800 flex items-center justify-center text-4xl text-slate-600">
              ▶️
            </div>
          )}
          {/* ▶ 배지 (좌하단) */}
          <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded px-1.5 py-0.5 bg-red-600/90 backdrop-blur-sm">
            <span className="text-white text-[11px] font-bold">▶</span>
            {isOfficial && <span className="text-white text-[10px] font-semibold">공식</span>}
          </div>
          {/* ✦ 공식 배지 (우상단) */}
          {isOfficial && (
            <div className="absolute top-2 right-2 rounded px-1.5 py-0.5 bg-yellow-400/90 backdrop-blur-sm">
              <span className="text-slate-950 text-[10px] font-black">✦ 공식</span>
            </div>
          )}
        </div>

        <div className="p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-[11px] font-semibold text-red-400 truncate flex-1">{card.sourceName}</span>
            <span className="text-[11px] text-[#888] flex-shrink-0">{formatTime(card.publishedAt)}</span>
          </div>
          <div className="text-[16px] font-bold text-slate-100 leading-snug line-clamp-2">{card.title}</div>
        </div>

        <div className="px-3 py-2.5 border-t border-slate-800 flex items-center justify-between">
          <button onClick={onBlock} className="text-[12px] text-slate-500 hover:text-red-400 transition-colors">
            🚫 채널 차단
          </button>
          <span className="text-[12px] text-purple-400 font-bold group-hover:text-purple-300">원문 →</span>
        </div>
      </div>
    </a>
  );
}

// ── News Card ─────────────────────────────────────────────────────────────────

function NewsCard({ card }: { card: FeedCardType }) {
  const [ogImage, setOgImage] = useState<string | null>(card.thumbnail || null);

  useEffect(() => {
    if (ogImage || !card.link) return;
    fetch(`/api/og-image?url=${encodeURIComponent(card.link)}`)
      .then(r => r.json())
      .then(d => { if (d.imageUrl) setOgImage(d.imageUrl); })
      .catch(() => {});
  }, [card.link]);

  return (
    <a href={card.link} target="_blank" rel="noopener noreferrer" className="block mb-3 group card-enter">
      <div className="bg-slate-900/60 border border-slate-700/40 rounded-xl overflow-hidden transition-all hover:border-slate-600/60">
        <div className="p-3">
          <div className="flex items-start gap-3">
            {ogImage ? (
              <img
                src={ogImage}
                alt=""
                className="w-20 h-[60px] rounded-xl object-cover flex-shrink-0 bg-slate-800"
                loading="lazy"
                onError={() => setOgImage(null)}
              />
            ) : (
              <div className="w-20 h-[60px] rounded-xl flex items-center justify-center text-2xl flex-shrink-0 bg-green-500/8 border border-green-500/20">
                📰
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold text-green-300 bg-green-500/15 border border-green-500/20 flex-shrink-0">
                  뉴스
                </span>
                <span className="text-[11px] font-semibold text-green-400 truncate">{card.sourceName}</span>
                <span className="ml-auto text-[11px] text-[#888] flex-shrink-0">{formatTime(card.publishedAt)}</span>
              </div>
              <div className="text-[16px] font-bold text-slate-100 leading-snug line-clamp-2">{card.title}</div>
              {card.summary && (
                <div className="mt-1 text-[13px] text-slate-400 leading-relaxed line-clamp-2">{card.summary}</div>
              )}
            </div>
          </div>
        </div>
        <div className="px-3 py-2.5 border-t border-slate-800 flex items-center justify-end">
          <span className="text-[12px] text-purple-400 font-bold group-hover:text-purple-300">원문 →</span>
        </div>
      </div>
    </a>
  );
}

// ── Community Card ────────────────────────────────────────────────────────────

function CommunityCard({ card }: { card: FeedCardType }) {
  const meta = card.communityProvider ? COMMUNITY_META[card.communityProvider] : null;
  const color = meta?.color ?? "#f59e0b";
  const label = meta?.label ?? "커뮤";

  return (
    <a href={card.link} target="_blank" rel="noopener noreferrer" className="block mb-3 group card-enter">
      <div className="bg-slate-900/60 border border-slate-700/40 rounded-xl overflow-hidden transition-all hover:border-slate-600/60">
        <div className="p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span
              className="px-1.5 py-0.5 rounded text-[10px] font-bold border flex-shrink-0"
              style={{ color, backgroundColor: `${color}18`, borderColor: `${color}40` }}
            >
              {label}
            </span>
            <span className="text-[11px] font-semibold truncate flex-1" style={{ color }}>
              {card.sourceName}
            </span>
            <span className="text-[11px] text-[#888] flex-shrink-0">{formatTime(card.publishedAt)}</span>
          </div>
          <div className="text-[16px] font-bold text-slate-100 leading-snug line-clamp-2">{card.title}</div>
          {card.summary && (
            <div className="mt-1 text-[13px] text-slate-400 leading-relaxed line-clamp-2">{card.summary}</div>
          )}
          {/* 통계 (있을 때만 표시) */}
          {(card.stats?.views != null || card.stats?.comments != null || card.stats?.likes != null) && (
            <div className="mt-2 flex items-center gap-3 text-[11px] text-[#888]">
              {card.stats?.views    != null && <span>👁 {card.stats.views.toLocaleString()}</span>}
              {card.stats?.comments != null && <span>💬 {card.stats.comments.toLocaleString()}</span>}
              {card.stats?.likes    != null && <span>👍 {card.stats.likes.toLocaleString()}</span>}
            </div>
          )}
        </div>
        <div className="px-3 py-2.5 border-t border-slate-800 flex items-center justify-end">
          <span className="text-[12px] text-purple-400 font-bold group-hover:text-purple-300">원문 →</span>
        </div>
      </div>
    </a>
  );
}

// ── X Card ────────────────────────────────────────────────────────────────────

function TwitterCard({ card, onBlock }: { card: FeedCardType; onBlock: (e: React.MouseEvent) => void }) {
  return (
    <a href={card.link} target="_blank" rel="noopener noreferrer" className="block mb-3 group card-enter">
      <div className="rounded-xl border border-sky-500/25 bg-slate-900/60 overflow-hidden transition-all hover:border-sky-400/45">
        <div className="p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold text-sky-300 bg-sky-500/15 border border-sky-500/20">
              X
            </span>
            <span className="text-[11px] font-semibold text-sky-300 truncate flex-1">{card.sourceName}</span>
            <span className="text-[11px] text-[#888] flex-shrink-0">{formatTime(card.publishedAt)}</span>
          </div>
          <div className="text-[16px] font-bold text-slate-100 leading-snug line-clamp-2">{card.title}</div>
          {card.summary && (
            <div className="mt-1 text-[13px] text-slate-400 leading-relaxed line-clamp-2">{card.summary}</div>
          )}
        </div>
        <div className="px-3 py-2.5 border-t border-slate-800 flex items-center justify-between">
          <button onClick={onBlock} className="text-[12px] text-slate-500 hover:text-red-400 transition-colors">
            🚫 계정 차단
          </button>
          <span className="text-[12px] text-sky-300 font-bold group-hover:text-sky-200">X에서 보기 →</span>
        </div>
      </div>
    </a>
  );
}

// ── Main dispatcher ───────────────────────────────────────────────────────────

export default function FeedCard({ card, collapsed = false }: Props) {
  const { blockSource } = useFilterContext();

  function handleBlock(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (confirm(`${card.sourceName} 계정을 차단할까요?\n앞으로 이 계정의 글은 보이지 않아요.`)) {
      blockSource(card);
    }
  }

  if (collapsed) {
    return (
      <details className="mb-3 bg-slate-900/50 border border-slate-700/40 rounded-xl p-3 text-xs text-slate-500 cursor-pointer card-enter">
        <summary className="flex items-center gap-2 list-none">
          <span>🔇</span>
          <span className="flex-1 truncate">가독성 낮은 글 — {card.title}</span>
          <span className="text-slate-600">펼치기 ▾</span>
        </summary>
        <div className="mt-2 pt-2 border-t border-slate-800 text-slate-400">{card.summary}</div>
      </details>
    );
  }

  if (card.source === "twitter")   return <TwitterCard   card={card} onBlock={handleBlock} />;
  if (card.source === "youtube")   return <YoutubeCard   card={card} onBlock={handleBlock} />;
  if (card.source === "news")      return <NewsCard      card={card} />;
  if (card.source === "community") return <CommunityCard card={card} />;

  return (
    <a href={card.link} target="_blank" rel="noopener noreferrer" className="block mb-3 group card-enter">
      <div className="bg-slate-900/60 border border-slate-700/40 rounded-xl p-4 hover:border-slate-600/60 transition-all">
        <div className="text-[16px] font-bold text-slate-100 line-clamp-2">{card.title}</div>
        {card.summary && <div className="mt-1 text-[13px] text-slate-400 line-clamp-2">{card.summary}</div>}
      </div>
    </a>
  );
}
