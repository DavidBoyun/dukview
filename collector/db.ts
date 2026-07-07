// ─────────────────────────────────────────────────────
// collector DB 계층 — Supabase upsert + collect_runs 기록
// 실행 환경: GitHub Actions 러너 (tsx), secret key 필요
// ─────────────────────────────────────────────────────

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Artist, FeedCard } from "../lib/types";
import { hashId, isUnknownDate } from "../lib/shared";

export function getDb(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL / SUPABASE_SECRET_KEY 환경변수가 필요합니다");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

/** config/artists.ts → artists 테이블 sync */
export async function syncArtists(db: SupabaseClient, artists: Artist[]) {
  const rows = artists.map(a => ({
    id: a.id,
    name: a.name,
    en: a.en,
    group_name: a.groupName ?? null,
    is_active: true,
    config: a.sources,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await db.from("artists").upsert(rows, { onConflict: "id" });
  if (error) throw new Error(`artists sync 실패: ${error.message}`);
}

/** FeedCard[] → cards upsert. 반환: 신규 삽입 건수 */
export async function upsertCards(db: SupabaseClient, cards: FeedCard[]): Promise<number> {
  if (cards.length === 0) return 0;

  const rows = cards.map(c => ({
    artist_id: c.artistId,
    source: c.source,
    source_id: c.sourceId ?? null,
    source_name: c.sourceName ?? null,
    community_provider: c.communityProvider ?? null,
    youtube_category: c.youtubeCategory ?? null,
    title: c.title,
    summary: c.summary ?? null,
    link: c.link,
    link_hash: `${c.source}:${hashId(c.link)}`,
    published_at: isUnknownDate(c.publishedAt) ? null : c.publishedAt,
    date_unknown: isUnknownDate(c.publishedAt),
    thumbnail_url: c.thumbnail ?? null,
    is_official: c.isOfficial ?? false,
    stats: c.stats ?? null,
    last_seen_at: new Date().toISOString(),
  }));

  // 배치 내 link_hash 중복 제거 (같은 카드가 쿼리 2개에 걸리는 경우)
  const seen = new Set<string>();
  const unique = rows.filter(r => {
    const key = `${r.artist_id}|${r.link_hash}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // 신규 건수 파악용: 기존 link_hash 조회
  const { data: existing, error: selErr } = await db
    .from("cards")
    .select("link_hash")
    .eq("artist_id", unique[0].artist_id)
    .in("link_hash", unique.map(r => r.link_hash));
  if (selErr) throw new Error(`cards 조회 실패: ${selErr.message}`);
  const existingSet = new Set((existing ?? []).map(r => r.link_hash));
  const newCount = unique.filter(r => !existingSet.has(r.link_hash)).length;

  const { error } = await db.from("cards").upsert(unique, {
    onConflict: "artist_id,link_hash",
    ignoreDuplicates: false, // 충돌 시 last_seen_at 등 갱신
  });
  if (error) throw new Error(`cards upsert 실패: ${error.message}`);
  return newCount;
}

/** collect_runs 기록 헬퍼 */
export async function recordRun(
  db: SupabaseClient,
  run: {
    artistId: string;
    source: string;
    provider?: string;
    status: "ok" | "empty" | "error";
    itemCount: number;
    newCount: number;
    error?: string;
    startedAt: string;
  },
) {
  const { error } = await db.from("collect_runs").insert({
    artist_id: run.artistId,
    source: run.source,
    provider: run.provider ?? null,
    started_at: run.startedAt,
    finished_at: new Date().toISOString(),
    status: run.status,
    item_count: run.itemCount,
    new_count: run.newCount,
    error: run.error ?? null,
  });
  if (error) console.error(`collect_runs 기록 실패: ${error.message}`);
}

/** 경보 판정: 직전 24h 내 ok였던 (artist,source)가 이번에 empty/error → true */
export async function hadRecentSuccess(
  db: SupabaseClient,
  artistId: string,
  source: string,
): Promise<boolean> {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data } = await db
    .from("collect_runs")
    .select("id")
    .eq("artist_id", artistId)
    .eq("source", source)
    .eq("status", "ok")
    .gte("started_at", since)
    .limit(1);
  return (data ?? []).length > 0;
}
