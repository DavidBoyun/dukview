# Dukview — 아키텍처 문서

## 기술 스택

| 구분 | 기술 |
|------|------|
| 언어 | TypeScript 5.5 (`strict: false` — MVP 의도적 선택) |
| 프레임워크 | Next.js 14 (App Router) |
| UI | React 18, Tailwind CSS 3.4 |
| RSS 파싱 | fast-xml-parser 4.4 |
| 상태 관리 | React Context API + localStorage |
| 메모리 | claude-mem (세션 기억 MCP) |

---

## 프로젝트 구조

```
dukview/
├── app/
│   ├── layout.tsx              # Provider 중첩: Premium → Filter → Tag (순서 고정)
│   ├── page.tsx                # 탭 UI + /api/feed 호출, 필터 적용
│   ├── globals.css
│   └── api/
│       ├── feed/route.ts       # 메인 오케스트레이터 (모든 소스 병렬 수집)
│       ├── youtube/route.ts    # YouTube Data API + 스크레이핑 fallback
│       └── community/route.ts  # 더쿠 RSS + 네이버 블로그 API
├── components/
│   ├── FeedCard.tsx            # 아웃링크 카드 (제목+요약+원문링크)
│   ├── SourceFilter.tsx        # 차단 계정 관리 UI
│   ├── AdSlot.tsx              # 광고 슬롯 placeholder (Phase 3)
│   └── ArtistTabs.tsx          # 아티스트 탭 (Phase 2)
├── contexts/
│   ├── FilterContext.tsx       # 블랙리스트 상태
│   ├── TagContext.tsx          # 검색/강조 태그 상태
│   └── PremiumContext.tsx      # 프리미엄 플래그
├── lib/
│   ├── types.ts                # FeedCard, Artist, SourceFilter 타입
│   ├── artists.ts              # 아티스트별 소스 설정 (핵심 설정 파일)
│   ├── rssParser.ts            # RSS 파싱 유틸 (RSS 2.0 + Atom 공통)
│   ├── sourceFilter.ts         # 블랙리스트 로직
│   └── readabilityFilter.ts    # 저가독성 감지 (미활성)
└── docs/                       # 프로젝트 문서
    ├── ARCHITECTURE.md         # (이 파일)
    ├── SOURCES.md              # 데이터 소스별 상세
    ├── PHASE1-MVP.md           # Phase 1 현재 상태
    ├── PHASE2-BETA.md          # Phase 2 계획
    └── DEBUGGING.md            # 알려진 이슈 + 해결책
```

---

## 데이터 흐름

```
page.tsx
  └→ GET /api/feed?artistId=taemin&youtubeOrder=date
        ├─ /api/community?terms=태민,TAEMIN&boards=...&artistId=taemin
        │    ├─ DC Inside 마이너 갤러리 HTML 스크레이핑 (communityBoards)
        │    └─ 네이버 블로그 API (NAVER_CLIENT_ID env 있을 때)
        ├─ YouTube 채널 RSS (Data API 활성화 시 channels.list+playlistItems.list)
        │    └─ /api/youtube?channelIds=UCxxx,UCyyy
        ├─ YouTube 검색 스크레이핑
        │    └─ /api/youtube?query=태민+직캠&order=date
        └─ Google News RSS (googleNewsUrl(keyword))
              ↓
           파싱 → 키워드 필터링 → 중복 제거 → publishedAt 정렬
              ↓
           FeedCard[] → FilterContext(블랙리스트) 적용 → UI
```

---

## 커뮤니티 데이터 수집 정책

### 아티스트 전용 게시판 (`communityBoards`)
> 예: DC Inside 태민 마이너갤, 샤이니 마이너갤

- 팬 전용 게시판 → **모든 글을 필터링 없이 가져온다**
- `artists.ts`의 `communityBoards` 배열에 게시판 URL 등록
- 방식: **HTML 스크레이핑** (`ub-content` 행 → 제목·링크·날짜 파싱)
- `needsFilter = false`

### 공유 게시판 (향후 확장용, 현재 미사용)
- 전체 이용자 게시판이면 **제목에 `sharedBoardFilterTerms` 키워드가 포함된 글만** 표시
- 본문/요약은 필터 대상 아님 (오탐 방지)
- `needsFilter = true`

### 네이버 블로그 (`communitySearchTerms`)
- `communitySearchTerms[0]` 첫 번째 키워드로 API 검색
- `NAVER_CLIENT_ID` + `NAVER_CLIENT_SECRET` env 없으면 자동 skip

### `artists.ts` 필드 요약

| 필드 | 용도 |
|------|------|
| `communityBoards` | 아티스트 전용 게시판 URL 목록 (DC Inside 등) |
| `sharedBoardFilterTerms` | 공유 게시판 **제목 필터** 키워드 |
| `communitySearchTerms` | 네이버 블로그 API **검색어** |

---

## 소스 탭 구조

| 탭 | source 값 | 상태 |
|----|----------|------|
| 전체 | (all) | 활성 |
| X | twitter | 준비중 (comingSoon: true) |
| 커뮤니티 | community | 활성 (더쿠 RSS 접근 문제 있음 → DEBUGGING.md) |
| 영상 | youtube | 활성 |
| 뉴스 | news | 활성 |

---

## 아키텍처 결정 원칙

### 저작권 최소화
- 원문 링크 아웃링크 방식 (제목+요약만, 전문 노출 없음)
- 썸네일은 공식 제공분만 사용

### API 키 없이도 동작
- YouTube: RSS fallback → Data API는 선택
- 커뮤니티: 환경변수 없으면 소스 skip (에러 없이 빈 배열)

### 아티스트 중심 설정
- 모든 소스 설정은 `lib/artists.ts` 한 파일에 집중
- 새 아티스트 추가 = `DEFAULT_ARTISTS` 배열에 항목 추가만

### Context 분리
- `FilterContext` ≠ `TagContext` — 관심사 분리, 순서 변경 금지
- Provider 중첩: `Premium → Filter → Tag`

### YouTube Quota 절약
- `search.list` (100 units/call) 제거
- `channels.list` (1 unit 배치) + `playlistItems.list` (1 unit/채널)
- 2채널 기준: 200+ units → 3 units

### 캐시 전략
- YouTube channel API: 1시간 TTL, 키 = `ch:{sortedChannelIds}`
- YouTube 스크레이핑: 1시간 TTL, 키 = `scrape:{order}:{queries}`
- 커뮤니티: 1시간 TTL, 키 = `{artistId}:{terms}`

---

## 환경 변수

```bash
# YouTube Data API (선택 — 없으면 RSS/스크레이핑 fallback)
TUBE_API_KEY=AIza...
YOUTUBE_DATA_API_ENABLED=true

# 네이버 블로그 API (선택 — 없으면 네이버 소스 skip)
NAVER_CLIENT_ID=...
NAVER_CLIENT_SECRET=...
```

---

## 개발 명령어

```bash
npm run dev       # 개발 서버 (http://localhost:3000)
npm run build     # 프로덕션 빌드
npm run start     # 프로덕션 서버
npm run lint      # ESLint
npx claude-mem status   # 메모리 워커 상태 확인
```

---

## 비즈니스 로드맵 & DB 설계

### 수익화 전략

| Phase | 수익 모델 |
|-------|----------|
| Phase 1 (현재) | 무료, 광고 슬롯 placeholder만 |
| Phase 3-A | Google AdSense 배너 (일반 타겟) |
| Phase 3-B | **팬덤 타겟 광고** (성별·연령 세그먼트 기반 CPM 상승) |
| Phase 3-C | 프리미엄 구독 (광고 제거, 월정액) |

### 사용자 데이터 수집 계획

광고 타겟팅을 위해 **성별·연령대**를 수집한다.  
수집 방식: 온보딩 팝업에서 선택적 입력 (강제 아님).  
식별자: `localStorage` UUID → DB `device_id` (익명).

> **한국 개인정보보호법(PIPA) 필수 준수**  
> - 수집 전 동의 팝업 의무  
> - 수집 항목·목적·보유기간 명시  
> - 언제든 삭제 요청 가능한 UI 제공

---

### DB 스키마 설계 (PostgreSQL — Supabase 권장)

**추천 스택:** Supabase (PostgreSQL + Auth + RLS) + Prisma ORM

#### `users` — 사용자 (익명 허용)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | `UUID` PK | - |
| `device_id` | `TEXT` UNIQUE | localStorage UUID (브라우저 익명 ID) |
| `gender` | `TEXT` nullable | `'M'` / `'F'` / `'OTHER'` |
| `birth_year` | `INTEGER` nullable | 연도만 저장 (생일 전체 불필요) |
| `created_at` | `TIMESTAMP` | - |

```sql
CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id   TEXT UNIQUE NOT NULL,
  gender      TEXT CHECK (gender IN ('M','F','OTHER')),
  birth_year  INTEGER CHECK (birth_year BETWEEN 1930 AND 2020),
  created_at  TIMESTAMP DEFAULT now()
);
```

#### `user_artists` — 팔로우 아티스트

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `user_id` | `UUID` FK → users | - |
| `artist_id` | `TEXT` | `'taemin'`, `'shinee'` 등 |
| `created_at` | `TIMESTAMP` | - |

```sql
CREATE TABLE user_artists (
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  artist_id  TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT now(),
  PRIMARY KEY (user_id, artist_id)
);
```

#### `events` — 행동 로그 (클릭·탭 전환·광고 노출)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | `UUID` PK | - |
| `user_id` | `UUID` FK nullable | 미동의 사용자 포함 가능 |
| `type` | `TEXT` | `'card_click'` / `'tab_view'` / `'ad_impression'` |
| `artist_id` | `TEXT` | 이벤트 발생 아티스트 |
| `source` | `TEXT` | `'youtube'` / `'news'` / `'community'` |
| `meta` | `JSONB` | 카드 ID 등 추가 데이터 |
| `created_at` | `TIMESTAMP` | - |

```sql
CREATE TABLE events (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  type       TEXT NOT NULL,
  artist_id  TEXT,
  source     TEXT,
  meta       JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT now()
);
CREATE INDEX ON events (artist_id, created_at DESC);
CREATE INDEX ON events (user_id, type);
```

#### `ad_segments` — 광고 타겟 세그먼트 (집계 캐시)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `user_id` | `UUID` FK | - |
| `age_bracket` | `TEXT` | `'10s'`/`'20s'`/`'30s'`/`'40s+'` (birth_year에서 계산) |
| `gender` | `TEXT` | users.gender 복사 |
| `top_artists` | `TEXT[]` | 가장 많이 본 아티스트 |
| `updated_at` | `TIMESTAMP` | 주기적 재계산 |

```sql
CREATE TABLE ad_segments (
  user_id      UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  age_bracket  TEXT,
  gender       TEXT,
  top_artists  TEXT[] DEFAULT '{}',
  updated_at   TIMESTAMP DEFAULT now()
);
```

#### 광고 타겟팅용 성별·연령 데이터 수집 원칙

- 성별·연령대는 온보딩에서 선택 입력으로만 받는다. 필수 가입 정보로 만들지 않는다.
- 원본 생년월일 대신 `age_bracket` 형태의 연령대만 광고 세그먼트에 사용한다.
- 광고 타겟팅에는 개인별 원문 행동 로그를 직접 전달하지 않고, `ad_segments`의 집계값만 사용한다.
- 사용자가 미입력 또는 철회한 경우 `gender`, `age_bracket`은 `null`로 유지하고 일반 광고만 노출한다.
- 향후 개인정보 처리방침에 광고 목적, 보관 기간, 철회 방법을 명시한 뒤 Phase 3에서 활성화한다.

---

### 구현 순서 (Phase 3 진입 시)

```
1. Supabase 프로젝트 생성 + Prisma 연동
2. 온보딩 팝업 UI (성별·연령대 선택, 선택적)
3. device_id localStorage 생성 → users 테이블 upsert
4. 카드 클릭 시 events INSERT (비동기, fire-and-forget)
5. 주간 배치로 ad_segments 재계산
6. Google AdSense 코드 AdSlot.tsx에 삽입
7. 세그먼트 데이터를 광고 네트워크에 전달 (커스텀 파라미터)
```
