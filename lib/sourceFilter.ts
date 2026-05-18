// ─────────────────────────────────────────────────────
// SourceFilter — X ID / 유튜브 채널 ID / 뉴스 도메인 블랙리스트
// 정병·렉카·찌라시 입구 컷 시스템
// ─────────────────────────────────────────────────────

import { FeedCard, SourceFilter } from "./types";

// ═══ 하드코딩 기본 블랙리스트 ═══════════════════════════════
// 1단계 MVP는 하드코딩, 2단계에서 유저 수동 차단 추가
export const DEFAULT_BLACKLIST: SourceFilter = {
  // X ID — 정병·저격·루머 생산 계정 (예시, 실제 운영 시 팬덤 협의 필요)
  blockedTwitterIds: [
    // 예: "RumorAccount1", "GossipDealer2"
  ],

  // 유튜브 채널 ID — 렉카·어그로 채널
  blockedYoutubeIds: [
    // 예: "UC_XXXXXXXXXXXXXXXXXXXXXX"  (사이버렉카 채널)
  ],

  // 뉴스 도메인 — 찌라시 매체
  blockedDomains: [
    // 예: "tabloid-site.com"
  ],
};

/**
 * 피드 카드가 차단 대상인지 확인
 */
export function isBlocked(card: FeedCard, filter: SourceFilter): boolean {
  if (card.source === "twitter") {
    return filter.blockedTwitterIds.some(
      id => id.toLowerCase() === card.sourceId.toLowerCase()
    );
  }
  if (card.source === "youtube") {
    return filter.blockedYoutubeIds.includes(card.sourceId);
  }
  if (card.source === "news") {
    // 뉴스는 도메인 기반 차단
    try {
      const host = new URL(card.link).hostname.replace(/^www\./, "");
      return filter.blockedDomains.some(d => host.includes(d));
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * 피드 배열에서 차단 대상 제거
 */
export function filterBlocked(cards: FeedCard[], filter: SourceFilter): FeedCard[] {
  return cards.filter(card => !isBlocked(card, filter));
}

/**
 * 특정 소스를 블랙리스트에 추가
 */
export function addToBlacklist(
  filter: SourceFilter,
  card: FeedCard
): SourceFilter {
  const updated = { ...filter };
  if (card.source === "twitter" && !updated.blockedTwitterIds.includes(card.sourceId)) {
    updated.blockedTwitterIds = [...updated.blockedTwitterIds, card.sourceId];
  } else if (card.source === "youtube" && !updated.blockedYoutubeIds.includes(card.sourceId)) {
    updated.blockedYoutubeIds = [...updated.blockedYoutubeIds, card.sourceId];
  } else if (card.source === "news") {
    try {
      const host = new URL(card.link).hostname.replace(/^www\./, "");
      if (!updated.blockedDomains.includes(host)) {
        updated.blockedDomains = [...updated.blockedDomains, host];
      }
    } catch {}
  }
  return updated;
}

/**
 * 블랙리스트에서 제거
 */
export function removeFromBlacklist(
  filter: SourceFilter,
  source: "twitter" | "youtube" | "news",
  id: string
): SourceFilter {
  const updated = { ...filter };
  if (source === "twitter") {
    updated.blockedTwitterIds = updated.blockedTwitterIds.filter(x => x !== id);
  } else if (source === "youtube") {
    updated.blockedYoutubeIds = updated.blockedYoutubeIds.filter(x => x !== id);
  } else if (source === "news") {
    updated.blockedDomains = updated.blockedDomains.filter(x => x !== id);
  }
  return updated;
}
