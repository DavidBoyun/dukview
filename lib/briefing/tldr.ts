// ─────────────────────────────────────────────────────
// 3줄 TL;DR 후보 선정 — components/OverviewPanel.tsx에서 이식 (PR-7)
// ─────────────────────────────────────────────────────

import { FeedCard } from "../types";
import { HOT_TERMS } from "./score";

export function getTLDR(cards: FeedCard[]) {
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
