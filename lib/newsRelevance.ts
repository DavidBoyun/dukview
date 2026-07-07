// ─────────────────────────────────────────────────────
// 뉴스 관련성 판정 — /api/news 라우트와 collector가 공유 (PR-3)
// ─────────────────────────────────────────────────────

import { Artist, FeedCard } from "./types";

export function includesArtistName(text: string, artist: Artist): boolean {
  const lower = text.toLowerCase();
  const koreanNamePattern = new RegExp(`(^|[^가-힣])${artist.name}([^가-힣]|$)`);
  return koreanNamePattern.test(text) || lower.includes(artist.en.toLowerCase());
}

export function isRelevantArtistNews(card: FeedCard, artist: Artist): boolean {
  const text = `${card.title} ${card.summary}`;
  const title = card.title;
  const lower = text.toLowerCase();
  const excludeTerms = artist.sources.newsExcludeKeywords || [];
  const contextTerms = artist.sources.newsContextKeywords || [
    artist.name,
    artist.en,
    artist.groupName || "",
    "가수",
    "콘서트",
    "앨범",
    "무대",
  ];

  if (excludeTerms.some(term => lower.includes(term.toLowerCase()))) return false;
  if (!includesArtistName(title, artist)) return false;
  return contextTerms.filter(Boolean).some(term => lower.includes(term.toLowerCase()));
}
