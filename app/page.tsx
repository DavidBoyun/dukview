"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import type { CSSProperties } from "react";
import { Artist, FeedCard as FeedCardType, YoutubeSearchOrder } from "@/lib/types";
import { DEFAULT_ARTIST_ID, getArtistConfig } from "@/config/artists";
import { filterBlocked } from "@/lib/sourceFilter";
import { isLowReadability } from "@/lib/readabilityFilter";
import { useFilterContext } from "@/contexts/FilterContext";
import FeedCard from "@/components/FeedCard";
import SourceFilterPanel from "@/components/SourceFilter";
import OverviewPanel from "@/components/OverviewPanel";
import XSignalComposer from "@/components/XSignalComposer";

const SOURCES = [
  { id: "all",       label: "전체",    icon: "🏠",  comingSoon: false },
  { id: "twitter",   label: "X",       icon: "✕",   comingSoon: false },
  { id: "community", label: "커뮤니티", icon: "💬",  comingSoon: false },
  { id: "youtube",   label: "영상",    icon: "▶️",  comingSoon: false },
  { id: "news",      label: "뉴스",    icon: "📰",  comingSoon: false },
];

// comingSoon 탭은 숨김
const VISIBLE_SOURCES = SOURCES.filter(s => !s.comingSoon);

const YOUTUBE_CATEGORIES = [
  { id: "all",      label: "전체"     },
  { id: "official", label: "공식채널"  },
  { id: "search",   label: "키워드 검색" },
] as const;

const YOUTUBE_SORTS: Array<{ id: YoutubeSearchOrder; label: string }> = [
  { id: "date",      label: "최신순"   },
  { id: "relevance", label: "관련도순" },
];

const COMMUNITY_PROVIDERS = [
  { id: "dcinside", label: "디시", color: "#3232FF" },
  { id: "naver",    label: "네이버", color: "#03C75A" },
  { id: "theqoo",   label: "더쿠",  color: "#8B5CF6" },
] as const;
type CommunityProviderId = typeof COMMUNITY_PROVIDERS[number]["id"];

const COMMUNITY_PROVIDER_OPTIONS: Array<{ id: "all" | CommunityProviderId; label: string }> = [
  { id: "all", label: "전체" },
  ...COMMUNITY_PROVIDERS,
];

function aliasStorageKey(artistId: string) {
  return `dukview-aliases:${artistId}`;
}

function twitterLinksStorageKey(artistId: string) {
  return `dukview-twitter-links:${artistId}`;
}

function normalizeTwitterUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  try {
    const url = new URL(value.startsWith("http") ? value : `https://${value}`);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (!["x.com", "twitter.com", "mobile.twitter.com"].includes(host)) return null;
    url.hostname = "x.com";
    const parts = url.pathname.split("/").filter(Boolean);
    const statusIndex = parts.indexOf("status");
    if (statusIndex < 1 || !parts[statusIndex + 1]) return null;
    return url.toString();
  } catch {
    return null;
  }
}

type ManualTwitterEntry = {
  url: string;
  memo?: string;
  createdAt?: string;
};

function twitterCardFromEntry(entry: ManualTwitterEntry, artistId: string): FeedCardType {
  const url = entry.url;
  const parsed = new URL(url);
  const parts = parsed.pathname.split("/").filter(Boolean);
  const username = parts[0] || "x";
  const statusId = parts.includes("status")
    ? parts[parts.indexOf("status") + 1]
    : parts[parts.length - 1] || url;

  return {
    id: `manual-x-${statusId}`,
    source: "twitter",
    sourceId: username,
    sourceName: `@${username}`,
    title: entry.memo?.trim() || `확인할 X 링크`,
    summary: `직접 추가한 실시간 반응 · ${url}`,
    link: url,
    publishedAt: entry.createdAt || new Date().toISOString(),
    artistId,
  };
}

function getDDay(dateStr: string): { dday: number; label: string } {
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

function formatTime(d: Date | null) {
  if (!d) return "";
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 10) return "방금";
  if (diff < 60) return `${diff}초 전`;
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  return `${Math.floor(diff / 3600)}시간 전`;
}

export default function HomePage() {
  const artist: Artist = getArtistConfig(DEFAULT_ARTIST_ID)!;
  const primaryColor = artist.colors?.primary ?? artist.color;
  const secondaryColor = artist.colors?.secondary ?? "#ffffff";
  const accentColor = artist.colors?.accent ?? artist.color;
  const backgroundColor = artist.colors?.background ?? "#0d0d1a";
  const artistThemeStyle = {
    "--artist-primary": primaryColor,
    "--artist-secondary": secondaryColor,
    "--artist-accent": accentColor,
    "--artist-bg": backgroundColor,
    boxShadow: `0 0 60px ${primaryColor}30`,
  } as CSSProperties;

  const [activeSource, setActiveSource] = useState("all");
  const [activeYoutubeCategory, setActiveYoutubeCategory] = useState<"all" | "official" | "search">("all");
  const [activeYoutubeSort, setActiveYoutubeSort] = useState<YoutubeSearchOrder>("date");
  const [activeCommunityProvider, setActiveCommunityProvider] = useState<"all" | CommunityProviderId>("all");
  const [cards, setCards] = useState<FeedCardType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [aliasDraft, setAliasDraft] = useState("");
  const [twitterLinkDraft, setTwitterLinkDraft] = useState("");
  const [twitterMemoDraft, setTwitterMemoDraft] = useState("");
  const [twitterLinkError, setTwitterLinkError] = useState("");
  const [customAliases, setCustomAliases] = useState<string[]>([]);
  const [manualTwitterCards, setManualTwitterCards] = useState<FeedCardType[]>([]);
  const [profileImageFailed, setProfileImageFailed] = useState(false);
  const [heroVisible, setHeroVisible] = useState(true);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const heroRef = useRef<HTMLDivElement>(null);
  const feedRequestRef = useRef<{ key: string; controller: AbortController } | null>(null);

  const { filter } = useFilterContext();

  // ── IntersectionObserver: 히어로 카드가 뷰포트를 벗어나면 미니 헤더 표시 ─────
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setHeroVisible(entry.isIntersecting),
      { threshold: 0 }
    );
    if (heroRef.current) observer.observe(heroRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 500);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(aliasStorageKey(artist.id));
      if (!saved) return;
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        setCustomAliases(parsed.filter((a: unknown) => typeof a === "string" && (a as string).trim()).map((a: string) => a.trim()));
      }
    } catch {}
  }, [artist.id]);

  useEffect(() => {
    try {
      localStorage.setItem(aliasStorageKey(artist.id), JSON.stringify(customAliases));
    } catch {}
  }, [artist.id, customAliases]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(twitterLinksStorageKey(artist.id));
      if (!saved) return;
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return;
      setManualTwitterCards(
        parsed
          .flatMap((entry: unknown) => {
            if (typeof entry === "string") {
              return [twitterCardFromEntry({ url: entry }, artist.id)];
            }
            if (
              entry &&
              typeof entry === "object" &&
              "url" in entry &&
              typeof (entry as ManualTwitterEntry).url === "string"
            ) {
              return [twitterCardFromEntry(entry as ManualTwitterEntry, artist.id)];
            }
            return [];
          })
      );
    } catch {}
  }, [artist.id]);

  useEffect(() => {
    try {
      localStorage.setItem(
        twitterLinksStorageKey(artist.id),
        JSON.stringify(manualTwitterCards.map(card => ({
          url: card.link,
          memo: card.title === "확인할 X 링크" ? "" : card.title,
          createdAt: card.publishedAt,
        })))
      );
    } catch {}
  }, [artist.id, manualTwitterCards]);

  useEffect(() => { setProfileImageFailed(false); }, [artist.id]);

  // ── 피드 로드 (기존 로직 유지) ───────────────────────────────────────────────
  const loadFeed = useCallback(async (options?: { includeYoutubeSearch?: boolean; useYoutubeSearchApi?: boolean }) => {
    const params = new URLSearchParams({ artistId: artist.id, youtubeOrder: activeYoutubeSort });
    if (options?.includeYoutubeSearch)  params.set("includeYoutubeSearch", "true");
    if (options?.useYoutubeSearchApi)   params.set("useYoutubeSearchApi", "true");
    if (customAliases.length > 0)       params.set("keywords", customAliases.join(","));

    const requestKey = params.toString();
    if (feedRequestRef.current?.key === requestKey) return;
    feedRequestRef.current?.controller.abort();
    const controller = new AbortController();
    feedRequestRef.current = { key: requestKey, controller };

    setLoading(true);
    setError("");
    setWarning("");
    try {
      const res = await fetch(`/api/feed?${requestKey}`, { signal: controller.signal });
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        const text = await res.text();
        throw new Error(text.includes("<!DOCTYPE") ? "서버가 잠깐 꼬였어요. 개발 서버를 다시 켜볼게요." : "피드 응답 형식이 올바르지 않아요.");
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "피드를 불러오지 못했어요");
      if (data.error) throw new Error(data.error);
      setCards(data.cards || []);
      setWarning(Array.isArray(data.warnings) ? data.warnings[0] || "" : "");
      setLastUpdated(new Date());
    } catch (e: any) {
      if (e.name === "AbortError") return;
      setError(e.message || "피드를 불러오지 못했어요");
      setCards([]);
    } finally {
      if (feedRequestRef.current?.controller === controller) feedRequestRef.current = null;
      setLoading(false);
    }
  }, [activeYoutubeSort, artist.id, customAliases]);

  useEffect(() => { loadFeed(); }, [loadFeed]);

  function refreshFeed() {
    const shouldSearchYoutube = activeSource === "youtube" && activeYoutubeCategory === "search";
    loadFeed({ includeYoutubeSearch: shouldSearchYoutube, useYoutubeSearchApi: shouldSearchYoutube });
  }

  // ── 필터링 (기존 로직 유지) ──────────────────────────────────────────────────
  const mergedCards = [...manualTwitterCards, ...cards];
  let filteredCards = filterBlocked(mergedCards, filter);
  if (activeSource === "all") {
    filteredCards = filteredCards.filter(c => c.source !== "community");
  } else {
    filteredCards = filteredCards.filter(c => c.source === activeSource);
  }
  if (activeSource === "youtube" && activeYoutubeCategory !== "all") {
    filteredCards = filteredCards.filter(c => c.youtubeCategory === activeYoutubeCategory);
  }
  if (activeSource === "community" && activeCommunityProvider !== "all") {
    filteredCards = filteredCards.filter(c => c.communityProvider === activeCommunityProvider);
  }

  const blockedCount  = mergedCards.length - filterBlocked(mergedCards, filter).length;
  const visibleCards  = filterBlocked(mergedCards, filter);
  const nonCommunityCards = visibleCards.filter(c => c.source !== "community");

  const counts = {
    all:       nonCommunityCards.length,
    twitter:   visibleCards.filter(c => c.source === "twitter").length,
    community: visibleCards.filter(c => c.source === "community").length,
    youtube:   visibleCards.filter(c => c.source === "youtube").length,
    news:      visibleCards.filter(c => c.source === "news").length,
  };
  const youtubeCounts = {
    all:      visibleCards.filter(c => c.source === "youtube").length,
    official: visibleCards.filter(c => c.source === "youtube" && c.youtubeCategory === "official").length,
    search:   visibleCards.filter(c => c.source === "youtube" && c.youtubeCategory === "search").length,
  };
  const communityCounts = {
    all:      visibleCards.filter(c => c.source === "community").length,
    dcinside: visibleCards.filter(c => c.source === "community" && c.communityProvider === "dcinside").length,
    naver:    visibleCards.filter(c => c.source === "community" && c.communityProvider === "naver").length,
    theqoo:   visibleCards.filter(c => c.source === "community" && c.communityProvider === "theqoo").length,
  };

  const officialChannels = activeSource === "youtube" && activeYoutubeCategory === "official"
    ? (artist.officialLinks || []).filter(link => link.type === "youtube")
    : [];
  const profileImageSrc = `/api/artist-image?artistId=${encodeURIComponent(artist.id)}`;

  function addAlias() {
    const value = aliasDraft.trim();
    if (!value) return;
    if (customAliases.some(a => a.toLowerCase() === value.toLowerCase())) { setAliasDraft(""); return; }
    setCustomAliases(prev => [...prev, value]);
    setAliasDraft("");
  }
  function removeAlias(a: string) { setCustomAliases(prev => prev.filter(x => x !== a)); }

  function addTwitterLink() {
    const normalized = normalizeTwitterUrl(twitterLinkDraft);
    if (!normalized) {
      setTwitterLinkError("X 계정 주소가 아니라 게시물 링크를 넣어주세요. 예: https://x.com/계정/status/123");
      return;
    }
    if (manualTwitterCards.some(card => card.link === normalized)) {
      setTwitterLinkDraft("");
      setTwitterMemoDraft("");
      setTwitterLinkError("");
      return;
    }
    setManualTwitterCards(prev => [
      twitterCardFromEntry({
        url: normalized,
        memo: twitterMemoDraft.trim(),
        createdAt: new Date().toISOString(),
      }, artist.id),
      ...prev,
    ]);
    setTwitterLinkDraft("");
    setTwitterMemoDraft("");
    setTwitterLinkError("");
  }

  function removeTwitterLink(id: string) {
    setManualTwitterCards(prev => prev.filter(card => card.id !== id));
  }

  const comebackInfo = artist.comeback ? getDDay(artist.comeback.date) : null;
  const showOverview = activeSource === "all" && !showSettings && mergedCards.length > 0;

  return (
    <div className="min-h-screen max-w-[430px] mx-auto relative pb-20"
      style={artistThemeStyle}>

      {/* ── Sticky 헤더 ─────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-50 bg-[#0d0d1a]/95 backdrop-blur-md border-b border-slate-800">

        {/* 로고 또는 미니 아티스트 바 */}
        <div className="px-4 py-3 flex items-center gap-3 min-h-[52px]">
          {heroVisible ? (
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black tracking-tight">
                <span className="text-purple-500">🦆 덕</span>
                <span className="text-slate-100">뷰</span>
              </span>
              <span className="text-[10px] text-purple-400 font-bold px-1.5 py-0.5 rounded bg-purple-500/20">MVP</span>
            </div>
          ) : (
            /* 미니 아티스트 정보 (스크롤 후) */
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 bg-slate-800 border border-slate-700">
                {profileImageFailed ? (
                  <span className="flex items-center justify-center w-full h-full text-sm">{artist.emoji}</span>
                ) : (
                  <img
                    src={profileImageSrc}
                    alt={artist.name}
                    className="w-full h-full object-cover"
                    onError={() => setProfileImageFailed(true)}
                  />
                )}
              </div>
              <span className="font-bold text-slate-100 text-sm truncate">{artist.name}</span>
              <span className="text-[12px] text-[#888] flex-shrink-0">
                {filteredCards.length}건
                {blockedCount > 0 && <span className="text-red-400 ml-1">· {blockedCount} 차단</span>}
              </span>
              <div className="ml-auto flex items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={refreshFeed}
                  disabled={loading}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-950/50 text-sm text-slate-300 transition-colors hover:border-purple-500 disabled:opacity-50"
                  aria-label="새로고침"
                >🔄</button>
                <button
                  onClick={() => setShowSettings(true)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-950/50 text-sm text-slate-300 transition-colors hover:border-cyan-500"
                  aria-label="설정"
                >⚙️</button>
              </div>
            </div>
          )}
        </div>

        {/* 소스 탭 (comingSoon 탭 숨김) */}
        <div
          className="flex min-w-0 touch-pan-x gap-1.5 overflow-x-scroll px-4 pb-3 pr-8"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {VISIBLE_SOURCES.map(s => {
            const active = activeSource === s.id;
            const cnt = counts[s.id as keyof typeof counts] ?? 0;
            return (
              <button
                key={s.id}
                onClick={() => {
                  setActiveSource(s.id);
                  if (s.id !== "youtube") setActiveYoutubeCategory("all");
                  if (s.id !== "community") setActiveCommunityProvider("all");
                }}
                className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                  active ? "source-pill-active" : "source-pill-inactive"
                }`}
                style={active ? ({ "--source-pill-color": primaryColor } as React.CSSProperties) : undefined}
              >
                {s.icon} {s.label}
                {cnt > 0 && <span className="ml-1 opacity-70">{cnt}</span>}
              </button>
            );
          })}
        </div>

        {/* YouTube 서브 필터 */}
        {activeSource === "youtube" && (
          <div className="px-4 pb-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="min-w-0">
                <label className="mb-1 block text-[11px] font-semibold text-slate-500">영상 구분</label>
                <select
                  value={activeYoutubeCategory}
                  onChange={e => setActiveYoutubeCategory(e.target.value as "all" | "official" | "search")}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-slate-200 outline-none focus:border-red-500"
                >
                  {YOUTUBE_CATEGORIES.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.label} {youtubeCounts[c.id] > 0 ? `(${youtubeCounts[c.id]})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-w-0">
                <label className="mb-1 block text-[11px] font-semibold text-slate-500">검색 정렬</label>
                <select
                  value={activeYoutubeSort}
                  onChange={e => setActiveYoutubeSort(e.target.value as YoutubeSearchOrder)}
                  disabled={activeYoutubeCategory === "official"}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-slate-200 outline-none focus:border-cyan-500 disabled:opacity-40"
                >
                  {YOUTUBE_SORTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* 커뮤니티 서브 필터 */}
        {activeSource === "community" && communityCounts.all > 0 && (
          <div className="px-4 pb-3">
            <label className="mb-1 block text-[11px] font-semibold text-slate-500">커뮤니티 구분</label>
            <select
              value={activeCommunityProvider}
              onChange={e => setActiveCommunityProvider(e.target.value as "all" | CommunityProviderId)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-slate-200 outline-none focus:border-amber-500"
            >
              {COMMUNITY_PROVIDER_OPTIONS.map(p => {
                const count = p.id === "all" ? communityCounts.all : communityCounts[p.id];
                return (
                  <option key={p.id} value={p.id}>
                    {p.label} {count > 0 ? `(${count})` : ""}
                  </option>
                );
              })}
            </select>
          </div>
        )}
      </div>

      {/* ── 아티스트 히어로 배너 ─────────────────────────────────────────────── */}
      <div
        ref={heroRef}
        className="mx-4 mt-4 mb-3 p-5 rounded-2xl flex items-center gap-4"
        style={{
          background: `linear-gradient(135deg, ${primaryColor}20, ${primaryColor}05)`,
          border: `1px solid ${primaryColor}30`,
        }}
      >
        <div
          className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-slate-950/40 text-4xl"
          style={{ borderColor: `${primaryColor}30` }}
        >
          {profileImageFailed ? (
            <span>{artist.emoji}</span>
          ) : (
            <img
              src={profileImageSrc}
              alt={`${artist.name} 프로필`}
              className="h-full w-full object-cover"
              onError={() => setProfileImageFailed(true)}
            />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="font-extrabold text-xl text-slate-100">{artist.name}</div>
            <div className="ml-auto flex items-center gap-1.5">
              <button
                onClick={refreshFeed}
                disabled={loading}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 bg-slate-950/50 text-base text-slate-300 transition-colors hover:border-purple-500 hover:text-purple-300 disabled:opacity-50"
                aria-label="새로고침"
              >🔄</button>
              <button
                onClick={() => setShowSettings(true)}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 bg-slate-950/50 text-base text-slate-300 transition-colors hover:border-cyan-500 hover:text-cyan-300"
                aria-label="설정"
              >⚙️</button>
            </div>
          </div>
          <div className="text-[12px] text-slate-400 mt-1 tracking-wide">
            {artist.en}{artist.groupName ? ` · ${artist.groupName} 💎` : ""}
          </div>
          <div className="text-[12px] text-[#888] mt-1.5">
            {filteredCards.length}건
            {blockedCount > 0 && <span className="text-red-400 ml-1.5">· {blockedCount} 차단</span>}
            {lastUpdated && <span className="ml-1.5">· 갱신 {formatTime(lastUpdated)}</span>}
          </div>
        </div>
      </div>

      {/* ── 컴백 D-day 배너 ─────────────────────────────────────────────────── */}
      {artist.comeback && comebackInfo && (
        <div
          className="mx-4 mb-3 rounded-xl overflow-hidden cursor-pointer"
          onClick={() => setActiveSource("youtube")}
          style={{
            background: "linear-gradient(135deg, #6d28d9 0%, #9333ea 50%, #ca8a04 100%)",
          }}
        >
          <div className="px-5 py-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-white/60 uppercase tracking-widest mb-0.5">Comeback</div>
              <div className="text-lg font-black text-white leading-tight truncate">{artist.comeback.title}</div>
              <div className="text-[12px] text-white/70 mt-0.5">{artist.comeback.date}</div>
            </div>
            <div
              className="text-4xl font-black flex-shrink-0"
              style={{ color: "#fde68a", textShadow: "0 0 20px rgba(253,230,138,0.6)" }}
            >
              {comebackInfo.label}
            </div>
          </div>
        </div>
      )}

      {/* ── 커스텀 키워드 배지 ───────────────────────────────────────────────── */}
      {customAliases.length > 0 && (
        <div className="mx-4 mb-3 flex flex-wrap gap-1.5 text-[10px]">
          <span className="text-slate-500">추가 키워드:</span>
          {customAliases.map(a => (
            <span key={`custom-${a}`} className="px-2 py-0.5 rounded-md font-semibold"
              style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}>
              {a}
            </span>
          ))}
        </div>
      )}

      {showOverview && (
        <OverviewPanel
          cards={visibleCards}
          counts={counts}
          artistName={artist.name}
          primaryColor={primaryColor}
          upcomingEvents={artist.upcomingEvents || []}
          clusterStopTerms={[artist.name, artist.en, ...(artist.aliases || [])]}
          onSelectSource={(source) => {
            setActiveSource(source);
            if (source !== "youtube") setActiveYoutubeCategory("all");
            if (source !== "community") setActiveCommunityProvider("all");
          }}
        />
      )}

      {/* ── 피드 ────────────────────────────────────────────────────────────── */}
      <div className="px-4">
        {activeSource === "twitter" && (
          <div className="mb-3 space-y-3">
            <XSignalComposer
              memo={twitterMemoDraft}
              url={twitterLinkDraft}
              error={twitterLinkError}
              onMemoChange={(value) => {
                setTwitterMemoDraft(value);
                setTwitterLinkError("");
              }}
              onUrlChange={(value) => {
                setTwitterLinkDraft(value);
                setTwitterLinkError("");
              }}
              onSubmit={addTwitterLink}
            />
            {manualTwitterCards.length === 0 && (
              <div className="rounded-xl border border-slate-800 bg-slate-900/45 px-4 py-5 text-center">
                <div className="text-sm font-bold text-slate-200">X 자동 수집은 아직 실험 전이에요</div>
                <div className="mt-1 text-[11px] leading-relaxed text-slate-500">
                  지금은 계정 추가가 아니라 게시물 링크를 골라 넣는 방식이에요.<br/>
                  중요한 글만 꽂아두면 전체 대시보드의 실시간 반응에 바로 떠요.
                </div>
              </div>
            )}
          </div>
        )}

        {officialChannels.length > 0 && (
          <div className="mb-3 space-y-3">
            {officialChannels.map(channel => (
              <a
                key={channel.id}
                href={channel.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-xl border border-cyan-500/20 bg-cyan-500/8 px-4 py-3 transition-colors hover:border-cyan-400/40"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-cyan-400/15 text-lg">▶️</div>
                  <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-slate-100">{channel.label}</div>
                    <div className="mt-0.5 text-[11px] text-slate-400">{channel.note}</div>
                  </div>
                  <div className="text-[11px] font-bold text-cyan-300">채널 열기</div>
                </div>
              </a>
            ))}
          </div>
        )}

        {activeSource === "youtube" && activeYoutubeCategory === "search" && filteredCards.length === 0 && !loading && !error && !warning && (
          <div className="mb-3 rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-5 text-center">
            <div className="text-sm font-semibold text-slate-200">키워드 검색 결과가 아직 없어요</div>
            <div className="mt-1 text-[11px] text-slate-500">🔄를 누르면 YouTube API를 아껴서 정확 검색해요.</div>
          </div>
        )}

        {loading && mergedCards.length === 0 && (
          <div className="text-center py-16">
            <div className="inline-block w-8 h-8 border-2 border-slate-700 border-t-purple-500 rounded-full animate-spin" />
            <div className="mt-3 text-xs text-slate-500">태민 소식 긁어오는 중...</div>
            <div className="mt-1 text-[10px] text-slate-600">RSS 수집 (10~20초)</div>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
            ⚠ {error}
            <button onClick={refreshFeed} className="ml-2 underline">재시도</button>
          </div>
        )}

        {warning && !error && (
          <div className="mb-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-200">
            {warning}
            <button onClick={refreshFeed} className="ml-2 underline">재시도</button>
          </div>
        )}

        {!loading && filteredCards.length === 0 && officialChannels.length === 0 && !error && (
          <div className="text-center py-16 text-slate-500">
            <div className="text-4xl mb-3">🌙</div>
            <div className="text-sm">아직 관련 소식이 없어요</div>
          </div>
        )}

        {filteredCards.map(card => {
          const lowRead = isLowReadability(card.title) || isLowReadability(card.summary);
          return <FeedCard key={card.id} card={card} collapsed={lowRead} />;
        })}
      </div>

      {/* 푸터 */}
      <div className="px-4 py-6 text-center text-[10px] text-slate-600 leading-relaxed">
        덕뷰는 외부 플랫폼의 공개 정보를 집계하는 서비스예요.<br/>
        모든 콘텐츠의 저작권은 원저작자에게 있어요 💜
      </div>

      {/* ── 설정 모달 (키워드 + 차단계정) ──────────────────────────────────── */}
      {showSettings && (
        <div className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm px-4 py-8 overflow-y-auto">
          <div className="mx-auto max-w-[430px] rounded-2xl border border-slate-800 bg-[#101425] p-4 shadow-2xl">

            {/* 헤더 */}
            <div className="flex items-center justify-between mb-4">
              <div className="text-base font-bold text-slate-100">설정</div>
              <button
                onClick={() => setShowSettings(false)}
                className="rounded-xl border border-slate-700 px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:border-slate-500"
              >닫기</button>
            </div>

            {/* 영상 추가 키워드 */}
            <div className="mb-5">
              <div className="text-sm font-bold text-slate-200 mb-1">영상 추가 키워드</div>
              <div className="text-[11px] text-slate-500 mb-3">팬캠/직캠 기본값은 유지되고, 여기서는 추가 검색어만 관리해요.</div>
              <div className="flex gap-2">
                <input
                  value={aliasDraft}
                  onChange={e => setAliasDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addAlias(); } }}
                  placeholder="예: 공항, 콘서트, 리허설"
                  className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500"
                />
                <button
                  onClick={addAlias}
                  className="rounded-xl px-3 py-2 text-sm font-bold text-slate-950 transition-colors"
                  style={{ backgroundColor: primaryColor }}
                >추가</button>
              </div>
              {customAliases.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {customAliases.map(alias => (
                    <span
                      key={alias}
                      className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold"
                      style={{ color: primaryColor, borderColor: `${primaryColor}40`, backgroundColor: `${primaryColor}10` }}
                    >
                      {alias}
                      <button onClick={() => removeAlias(alias)} className="opacity-60 hover:opacity-100">×</button>
                    </span>
                  ))}
                </div>
              )}
              {customAliases.length === 0 && (
                <div className="mt-2 text-xs text-slate-500">추가한 키워드가 아직 없어요.</div>
              )}
            </div>

            {/* 구분선 */}
            <div className="border-t border-slate-800 mb-5" />

            {/* X 링크 직접 추가 */}
            <div className="mb-5">
              <XSignalComposer
                memo={twitterMemoDraft}
                url={twitterLinkDraft}
                error={twitterLinkError}
                onMemoChange={(value) => {
                  setTwitterMemoDraft(value);
                  setTwitterLinkError("");
                }}
                onUrlChange={(value) => {
                  setTwitterLinkDraft(value);
                  setTwitterLinkError("");
                }}
                onSubmit={addTwitterLink}
                compact
              />
              {manualTwitterCards.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {manualTwitterCards.map(card => (
                    <div key={card.id} className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-semibold text-slate-200">{card.title}</div>
                        <div className="truncate text-[11px] text-slate-500">{card.link}</div>
                      </div>
                      <button
                        onClick={() => removeTwitterLink(card.id)}
                        className="rounded-lg border border-slate-700 px-2 py-1 text-[11px] font-semibold text-slate-400 hover:border-red-500 hover:text-red-300"
                      >
                        삭제
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-2 text-xs text-slate-500">추가한 X 링크가 아직 없어요.</div>
              )}
            </div>

            {/* 구분선 */}
            <div className="border-t border-slate-800 mb-5" />

            {/* 차단 계정 관리 */}
            <div>
              <div className="text-sm font-bold text-slate-200 mb-3">차단 계정 관리</div>
              <SourceFilterPanel />
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        aria-label="맨 위로"
        className={`fixed bottom-5 right-4 z-40 flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 bg-slate-900/70 text-sm font-bold text-slate-300 shadow-sm backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:border-slate-600 hover:bg-slate-900/80 hover:shadow-md ${
          showScrollTop ? "opacity-80 hover:opacity-95" : "pointer-events-none opacity-0"
        }`}
      >
        ↑
      </button>
    </div>
  );
}
