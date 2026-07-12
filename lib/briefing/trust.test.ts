// node:test — 신뢰도 2계층 판정 (PR-7 게이트)
// 실행: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { FeedCard } from "../types";
import { Cluster } from "./types";
import { cardTier, clusterStatus } from "./trust";

function card(over: Partial<FeedCard>): FeedCard {
  return {
    id: "1", source: "news", sourceId: "s", sourceName: "매체A",
    title: "제목", summary: "", link: "https://x.test/1",
    publishedAt: "2026-07-13T00:00:00.000Z", artistId: "taemin",
    ...over,
  };
}
function cluster(cards: FeedCard[]): Cluster {
  return { tokens: new Set(), cards, topCard: cards[0] };
}

// ── 계층 1: cardTier ──────────────────────────────────
test("1. official youtube 카드 → official", () => {
  assert.equal(cardTier(card({ source: "youtube", youtubeCategory: "official" })), "official");
});

test("2. is_official=true news 카드 → official", () => {
  assert.equal(cardTier(card({ source: "news", isOfficial: true })), "official");
});

test("3. 일반 news → press", () => {
  assert.equal(cardTier(card({ source: "news" })), "press");
});

test("4. community → fandom", () => {
  assert.equal(cardTier(card({ source: "community" })), "fandom");
});

test("5. youtube search → fandom", () => {
  assert.equal(cardTier(card({ source: "youtube", youtubeCategory: "search" })), "fandom");
});

// ── 계층 2: clusterStatus ─────────────────────────────
test("6. 클러스터에 official 1장 → confirmed", () => {
  const c = cluster([
    card({ source: "community", title: "무대 후기" }),
    card({ id: "2", source: "youtube", youtubeCategory: "official", title: "새 영상" }),
  ]);
  assert.equal(clusterStatus(c), "confirmed");
});

test("7. 서로 다른 sourceName 뉴스 3곳 + 발표 키워드 → confirmed", () => {
  const c = cluster([
    card({ sourceName: "매체A", title: "신곡 발표" }),
    card({ id: "2", sourceName: "매체B", title: "무대 소식" }),
    card({ id: "3", sourceName: "매체C", title: "근황" }),
  ]);
  assert.equal(clusterStatus(c), "confirmed");
});

test("8. 같은 sourceName 뉴스 3장(outlet 1) + 발표 키워드 + 예고류 없음 → reaction", () => {
  const c = cluster([
    card({ sourceName: "매체A", title: "신곡 발표" }),
    card({ id: "2", sourceName: "매체A", title: "무대 소식" }),
    card({ id: "3", sourceName: "매체A", title: "근황" }),
  ]);
  assert.equal(clusterStatus(c), "reaction");
});

test("9. 뉴스 1장 + 컴백 준비 → likely", () => {
  const c = cluster([
    card({ title: "컴백 준비 정황 포착" }),
    card({ id: "2", source: "community", title: "기대된다" }),
  ]);
  assert.equal(clusterStatus(c), "likely");
});

test("10. 커뮤니티만 10장 → reaction", () => {
  const cards = Array.from({ length: 10 }, (_, i) =>
    card({ id: String(i), source: "community" as const, title: `후기 ${i}` })
  );
  assert.equal(clusterStatus(cluster(cards)), "reaction");
});
