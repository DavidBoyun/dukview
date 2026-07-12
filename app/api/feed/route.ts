// ─────────────────────────────────────────────────────
// /api/feed — Supabase cards 테이블 읽기 전용 (PR-5)
// 수집은 collector(GitHub Actions)가 담당. 이 라우트는 SELECT만.
// 구 실시간 self-fetch 오케스트레이터: _deprecated/api-feed-route-legacy.ts
// ─────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { getPublicDb } from "@/lib/supabasePublic";
import { mapCardRow } from "@/lib/mapCardRow";
import { FeedCard } from "@/lib/types";

export async function GET(req: NextRequest) {
  const artistId = req.nextUrl.searchParams.get("artistId");
  // 기존 파라미터(youtubeOrder/includeYoutubeSearch/useYoutubeSearchApi/keywords)는
  // UI 호환을 위해 받되 무시한다 (DB 전환으로 소멸된 옵션)
  if (!artistId) {
    return NextResponse.json({ error: "artistId가 필요해요" }, { status: 400 });
  }

  // 소스별 union 쿼리 (PR-9) — 단일 최신순 300은 community가 윈도를 독식해 뉴스 탭이 굶음
  const db = getPublicDb();
  const bySource = (source: string, limit: number) =>
    db.from("cards").select("*")
      .eq("artist_id", artistId).eq("source", source)
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(limit);

  const [news, community, youtube] = await Promise.all([
    bySource("news", 100),
    bySource("community", 150),
    bySource("youtube", 50),
  ]);

  const firstError = news.error || community.error || youtube.error;
  if (firstError) {
    return NextResponse.json(
      { error: firstError.message, cards: [], warnings: [] },
      { status: 500 },
    );
  }

  const rows = [...(news.data ?? []), ...(community.data ?? []), ...(youtube.data ?? [])];
  // 병합 후 최신순 재정렬 — date_unknown(발행일 미상)은 최하단
  rows.sort((a, b) => {
    if (a.date_unknown !== b.date_unknown) return a.date_unknown ? 1 : -1;
    return new Date(b.published_at ?? 0).getTime() - new Date(a.published_at ?? 0).getTime();
  });

  const cards: FeedCard[] = rows.map(mapCardRow);

  return NextResponse.json(
    { cards, warnings: [] },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
  );
}
