// ─────────────────────────────────────────────────────
// 신뢰도 2계층 판정 (PR-7 신규)
// 계층 1: 카드 tier — 카드 단독, 소스 기반 결정적
// 계층 2: 클러스터 status — 교차 출처 판정 (briefing builder 전용)
// 규칙 근거: DESIGN_PHASE_B.md B3 (변경 금지)
// ─────────────────────────────────────────────────────

import { FeedCard } from "../types";
import { Cluster, TrustTier, ClusterStatus } from "./types";

const ANNOUNCE_RE = /공식|발표|확정|출연|발매/;
const FORECAST_RE = /컴백|설|예정|전망|임박|준비/;

export function cardTier(card: FeedCard): TrustTier {
  if (card.isOfficial || (card.source === "youtube" && card.youtubeCategory === "official")) return "official";
  if (card.source === "news") return "press";
  return "fandom";
}

export function clusterStatus(cluster: Cluster): ClusterStatus {
  if (cluster.cards.some(c => cardTier(c) === "official")) return "confirmed";
  const press = cluster.cards.filter(c => cardTier(c) === "press");
  const outlets = new Set(press.map(c => c.sourceName)).size;
  const text = cluster.cards.map(c => `${c.title} ${c.summary}`).join(" ");
  if (outlets >= 3 && ANNOUNCE_RE.test(text)) return "confirmed";
  if (press.length >= 1 && FORECAST_RE.test(text)) return "likely";
  return "reaction";
}
