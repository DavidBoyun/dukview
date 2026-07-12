// ─────────────────────────────────────────────────────
// cards 행 → FeedCard 매핑 단일화 (PR-8)
// /api/feed(PR-5)와 briefing builder가 공용. 매핑 필드 변경 금지.
// ─────────────────────────────────────────────────────

import { FeedCard } from "./types";
import { UNKNOWN_DATE_ISO } from "./shared";

export function mapCardRow(row: any): FeedCard {
  return {
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
  };
}
