// ─────────────────────────────────────────────────────
// /api/feed — Supabase cards 테이블 읽기 전용 (PR-5)
// 수집은 collector(GitHub Actions)가 담당. 이 라우트는 SELECT만.
// 구 실시간 self-fetch 오케스트레이터: _deprecated/api-feed-route-legacy.ts
// ─────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { getPublicDb } from "@/lib/supabasePublic";
import { UNKNOWN_DATE_ISO } from "@/lib/shared";
import { FeedCard } from "@/lib/types";

export async function GET(req: NextRequest) {
  const artistId = req.nextUrl.searchParams.get("artistId");
  // 기존 파라미터(youtubeOrder/includeYoutubeSearch/useYoutubeSearchApi/keywords)는
  // UI 호환을 위해 받되 무시한다 (DB 전환으로 소멸된 옵션)
  if (!artistId) {
    return NextResponse.json({ error: "artistId가 필요해요" }, { status: 400 });
  }

  const { data, error } = await getPublicDb()
    .from("cards")
    .select("*")
    .eq("artist_id", artistId)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(300);

  if (error) {
    return NextResponse.json(
      { error: error.message, cards: [], warnings: [] },
      { status: 500 },
    );
  }

  const cards: FeedCard[] = (data ?? []).map(row => ({
    id: String(row.id),
    source: row.source,
    youtubeCategory: row.youtube_category ?? undefined,
    communityProvider: row.community_provider ?? undefined,
    sourceId: row.source_id ?? "",
    sourceName: row.source_name ?? "",
    title: row.title,
    summary: row.summary ?? "",
    link: row.link,
    publishedAt: row.date_unknown ? UNKNOWN_DATE_ISO : row.published_at,
    thumbnail: row.thumbnail_url ?? undefined,
    artistId: row.artist_id,
    isOfficial: row.is_official,
    stats: row.stats ?? undefined,
  }));

  return NextResponse.json(
    { cards, warnings: [] },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
  );
}
