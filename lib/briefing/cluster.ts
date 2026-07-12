// ─────────────────────────────────────────────────────
// 카드 클러스터링 — components/OverviewPanel.tsx에서 이식 (PR-7)
// 로직·상수 변경 금지 (결정 10: 스코어 상수 재설계 금지)
// ─────────────────────────────────────────────────────

import { FeedCard } from "../types";
import { Cluster } from "./types";

/**
 * 제목 토큰화 — 클러스터링 입력.
 * 아티스트 본인 식별자(name/en/aliases)와 일반어를 stopword로 빼서 진짜 토픽 키워드만 남긴다.
 * groupName은 stopword에서 제외 — 솔로/그룹 클러스터를 분리하기 위함.
 */
export function tokenizeForCluster(
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

export function cardPriority(card: FeedCard): number {
  if (card.source === "youtube" && card.youtubeCategory === "official") return 5;
  if (card.source === "news") return 4;
  if (card.source === "community") return 3;
  if (card.source === "twitter") return 2;
  return 1;
}

export function clusterCards(
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
