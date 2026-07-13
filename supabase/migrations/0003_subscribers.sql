-- 덕뷰 뉴스레터 구독자 테이블 (DESIGN_PHASE_B.md B2 + confirm_sent_at, PR-10)
-- 적용: Supabase Dashboard > SQL Editor에 전체 붙여넣기 > Run

create table if not exists subscribers (
  id              bigint generated always as identity primary key,
  email           text not null unique,
  artist_id       text not null references artists(id) default 'taemin',
  status          text not null default 'pending'
                  check (status in ('pending','confirmed','unsubscribed')),
  confirm_token   text not null,     -- UUID, 확인/해지 링크 공용
  confirm_sent_at timestamptz,       -- 확인 메일 최종 발송 시각 (10분 재발송 가드)
  created_at      timestamptz not null default now(),
  confirmed_at    timestamptz,
  last_sent_at    timestamptz
);

-- RLS 활성 + 정책 0개 = anon 전면 거부. 읽기·쓰기 전부 service role만
-- (이메일 = 개인정보. 공개 정책 절대 금지 — 결정 10 금지 조항)
alter table subscribers enable row level security;
