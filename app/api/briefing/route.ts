// ─────────────────────────────────────────────────────
// /api/briefing — 최신 브리핑 스냅샷 읽기 전용 (PR-8)
// 작성은 collector/briefing.ts (service role)만.
// built_at desc 1행 조회 — is_latest 미의존 (builder insert→clear 레이스 무해)
// ─────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { getPublicDb } from "@/lib/supabasePublic";

export async function GET(req: NextRequest) {
  const artistId = req.nextUrl.searchParams.get("artistId");
  if (!artistId) {
    return NextResponse.json({ error: "artistId가 필요해요" }, { status: 400 });
  }

  const { data, error } = await getPublicDb()
    .from("briefings")
    .select("*")
    .eq("artist_id", artistId)
    .order("built_at", { ascending: false })
    .limit(1);

  if (error) {
    return NextResponse.json({ error: error.message, briefing: null }, { status: 500 });
  }

  return NextResponse.json(
    { briefing: data?.[0] ?? null },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
  );
}
