// ─────────────────────────────────────────────────────
// 클러스터 스코어링 + 헤드라인 가드 — components/OverviewPanel.tsx에서 이식 (PR-7)
// 상수(HOT_TERMS, cap 5, stale -8, NEGATIVE_PENALTY_CAP=18, SWAP_RATIO 0.8) 변경 금지
// ─────────────────────────────────────────────────────

import { FeedCard } from "../types";
import { isUnknownDate } from "../shared";
import { Cluster } from "./types";

export const HOT_TERMS = [
  "컴백", "티저", "콘서트", "팬미팅", "공연", "앨범", "스케줄",
  "공지", "예매", "티켓", "방송", "무대", "단독", "공식",
  "신곡", "신보", "발표", "확정", "데뷔",
];

export const MUST_SEE_RE = /컴백|신곡|신보|단독|콘서트|팬미팅|예매|티저|공지|발표|확정|데뷔/;
export const FOR_FUN_RE = /직캠|팬캠|fancam|focus|커버|cover|리액션|reaction/i;

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
export const NEGATIVE_PENALTY_CAP = 18;
// 헤드라인 가드 임계값 — 2위 점수가 1위의 80% 이상이면 swap 허용
export const HEADLINE_SWAP_RATIO = 0.8;

export function clusterHasOfficial(cluster: Cluster): boolean {
  return cluster.cards.some(
    c => c.source === "youtube" && c.youtubeCategory === "official"
  );
}

export function negativePenalty(text: string, hasOfficial: boolean): number {
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

export function getMinutesAgo(card: FeedCard): number {
  const d = new Date(card.publishedAt);
  if (Number.isNaN(d.getTime()) || isUnknownDate(card.publishedAt)) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 60000));
}

export function scoreCluster(cluster: Cluster): number {
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

/**
 * 헤드라인 가드 (D3) — 1위 클러스터가 negative 점수면, 2위가 1위의 80% 이상 점수일 때 swap.
 * 정보 자체는 다른 섹션/일반 피드에 그대로 노출됨.
 */
export function pickHeadline(
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
