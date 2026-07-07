-- 덕뷰 데이터 계층 초기 스키마 (DESIGN_PHASE_A.md A2)
-- 적용: Supabase Dashboard > SQL Editor에 전체 붙여넣기 > Run

-- 아티스트 레지스트리 (SSOT는 repo의 config/artists.ts — sync 스크립트로 upsert)
create table if not exists artists (
  id          text primary key,
  name        text not null,
  en          text,
  group_name  text,
  is_active   boolean not null default true,
  config      jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 피드 카드 (FeedCard 타입 1:1 + 히스토리 필드)
create table if not exists cards (
  id                 bigint generated always as identity primary key,
  artist_id          text not null references artists(id),
  source             text not null check (source in ('youtube','news','community','twitter')),
  source_id          text,
  source_name        text,
  community_provider text check (community_provider in ('dcinside','naver','theqoo')),
  youtube_category   text check (youtube_category in ('official','search')),
  title              text not null,
  summary            text,
  link               text not null,
  link_hash          text not null,   -- "{source}:{hashId(link)}" — 소스 간 충돌 방지
  published_at       timestamptz,
  date_unknown       boolean not null default false,
  thumbnail_url      text,
  is_official        boolean not null default false,
  stats              jsonb,
  first_seen_at      timestamptz not null default now(),  -- P1.5 "놓친 소식" 기준
  last_seen_at       timestamptz not null default now(),
  unique (artist_id, link_hash)
);
create index if not exists cards_feed_idx on cards (artist_id, source, published_at desc nulls last);
create index if not exists cards_seen_idx on cards (artist_id, first_seen_at desc);

-- 수집 실행 로그 (관측성)
create table if not exists collect_runs (
  id          bigint generated always as identity primary key,
  artist_id   text not null,
  source      text not null,
  provider    text,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  status      text not null default 'running'
              check (status in ('running','ok','empty','error')),
  item_count  int not null default 0,
  new_count   int not null default 0,
  error       text
);
create index if not exists collect_runs_recent_idx on collect_runs (artist_id, source, started_at desc);

-- RLS: 읽기 전용 공개, 쓰기는 secret key(service role)만
alter table artists enable row level security;
alter table cards enable row level security;
alter table collect_runs enable row level security;

create policy "public read artists" on artists for select using (true);
create policy "public read cards"   on cards   for select using (true);
-- collect_runs는 공개 정책 없음 (secret key로만 접근)
