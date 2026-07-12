// ─────────────────────────────────────────────────────
// 브리핑 판단 계층 공용 타입 (PR-7)
// UI(OverviewPanel)와 collector(briefing builder)가 공유
// ─────────────────────────────────────────────────────

import { FeedCard } from "../types";

export type Cluster = { tokens: Set<string>; cards: FeedCard[]; topCard: FeedCard };

export type TrustTier = "official" | "press" | "fandom";
export type ClusterStatus = "confirmed" | "likely" | "reaction";

export interface HeroBriefing {
  headline: string;            // 대표 카드 제목 (규칙 기반, 생성문 아님)
  status: ClusterStatus;
  cardCount: number;           // 관련 N건
  diversity: { news: number; fandom: number; official: number };
  whyImportant: string;        // 고정 템플릿 1줄
  topCardIds: string[];        // 상위 5 카드 id
}

export interface TldrLine {
  kind: "official" | "trending" | "fandom";
  text: string;
  cardId?: string;
}
