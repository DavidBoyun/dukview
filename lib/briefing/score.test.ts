// node:test — 이식 스코어링 스냅숏 (PR-7 게이트)
// 기대값은 이식 전 OverviewPanel 현행 로직의 실행값을 고정한 것 (값 재설계 금지)
// 실행: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { FeedCard } from "../types";
import { negativePenalty, scoreCluster, pickHeadline } from "./score";
import { Cluster } from "./types";

function card(over: Partial<FeedCard>): FeedCard {
  return {
    id: "1", source: "community", sourceId: "s", sourceName: "디씨",
    title: "제목", summary: "", link: "https://x.test/1",
    publishedAt: new Date(Date.now() - 30 * 60000).toISOString(), // 30분 전
    artistId: "taemin",
    ...over,
  };
}
function cluster(cards: FeedCard[]): Cluster {
  return { tokens: new Set(), cards, topCard: cards[0] };
}

test("11. 열애설 텍스트 + official 없음 → penalty 18 (T2 10 + 설 8, cap 18)", () => {
  assert.equal(negativePenalty("열애설 정리", false), 18);
});

test("12. 같은 텍스트 + official 클러스터 → penalty 0 (중화)", () => {
  assert.equal(negativePenalty("열애설 정리", true), 0);
});

test("스냅숏: 커뮤니티 2장·30분 전·중립 제목 → score 16 (건수 6 + recency 10)", () => {
  const c = cluster([card({ title: "오늘 근황" }), card({ id: "2", title: "사진 모음" })]);
  assert.equal(scoreCluster(c), 16);
});

test("스냅숏: official 1장·30분 전·중립 제목 → score 28 (3 + 10 + 15)", () => {
  const c = cluster([
    card({ source: "youtube", youtubeCategory: "official", title: "새 영상 올라옴" }),
  ]);
  assert.equal(scoreCluster(c), 28);
});

test("헤드라인 가드: 1위 negative(penalty>=8)·2위가 80% 이상이면 swap", () => {
  const noisy = cluster([card({ title: "열애설 정리" })]);
  const clean = cluster([card({ id: "2", title: "콘서트 후기" })]);
  const picked = pickHeadline([
    { cluster: noisy, score: 10 },
    { cluster: clean, score: 9 },   // 10*0.8=8 이상 → swap
  ]);
  assert.equal(picked, clean);
});
