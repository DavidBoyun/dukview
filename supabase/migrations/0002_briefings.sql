-- 덕뷰 브리핑 스냅샷 테이블 (DESIGN_PHASE_B.md B2, PR-8)
-- 적용: Supabase Dashboard > SQL Editor에 전체 붙여넣기 > Run

-- 브리핑 스냅샷 (아티스트 × 수집 사이클)
create table if not exists briefings (
  id           bigint generated always as identity primary key,
  artist_id    text not null references artists(id),
  built_at     timestamptz not null default now(),
  hero         jsonb not null,   -- HeroBriefing (lib/briefing/types.ts)
  tldr         jsonb not null,   -- TldrLine[3]
  stats        jsonb not null,   -- {cardCount24h, bySource:{news,community,youtube}, officialActive}
  is_latest    boolean not null default true
);
create index if not exists briefings_latest_idx on briefings (artist_id, is_latest) where is_latest;
create index if not exists briefings_history_idx on briefings (artist_id, built_at desc);

-- RLS: 읽기 전용 공개, 쓰기는 secret key(service role)만 (cards와 동형)
alter table briefings enable row level security;

create policy "public read briefings" on briefings for select using (true);
