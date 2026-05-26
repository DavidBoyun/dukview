# HANDOFF — Dukview

## 2026-04-30

### 완료
- 프로젝트 전체 구조 분석 (app/, components/, contexts/, lib/, 환경 변수, 스크립트)
- `CLAUDE.md` 생성 — 기술 스택, 디렉터리 구조, 데이터 흐름, 아키텍처 결정 사항, 로드맵, 컨벤션 문서화

### 현재 상태
- MVP Phase 1 진행 중 (태민 단독, RSS 기반, localStorage 상태 관리)
- `ArtistTabs.tsx`, `AdSlot.tsx`는 Phase 2/3 준비용 placeholder

### 2026-04-30 (2차)
- `app/api/youtube/route.ts` 재작성
  - `search.list` (100 quota/call) 제거
  - `channels.list` (1 unit) → `playlistItems.list` (1 unit/채널) 로 교체 (`fetchYoutubeChannelApi`)
  - 캐시 TTL 15분 → 1시간 (`CACHE_TTL_MS`)
  - 캐시 키: 채널 경로 `ch:{sortedIds}`, 스크레이핑 경로 `scrape:{order}:{queries}`
  - `GET` 핸들러: `?channelIds=` → channel API, `?query=` → scraping 분기
- `app/api/feed/route.ts` 수정
  - `fetchYoutubeChannels` 함수 추가 (channel API 호출 래퍼)
  - YouTube 섹션: `YOUTUBE_DATA_API_ENABLED=true` + API 키 있으면 → channel API, 없으면 → RSS fallback

### 현재 quota 소비 구조
| 상황 | 채널당 quota |
|------|-------------|
| Data API 활성화 | `1(channels.list) + N(playlistItems.list)` |
| Data API 비활성화 | `0` (RSS) |
| 이전 search.list | `100 × 쿼리 수` |

### 2026-04-30 (3차)
- **X(트위터) 탭** → `comingSoon: true` 배지 + 준비중 placeholder UI
- **Nitter 완전 제거** (`NITTER_INSTANCES`, `fetchNitter`, `GROUP_TWITTER`, Twitter 섹션 삭제)
- **`app/api/community/route.ts` 신규 생성**
  - 더쿠 스타 게시판 RSS (`https://theqoo.net/star?act=rss`) 수집 → 아티스트 키워드 필터링
  - 네이버 블로그 API (선택, `NAVER_CLIENT_ID` + `NAVER_CLIENT_SECRET` 환경변수 필요)
  - 캐시 1시간
- **아티스트별 검색어 변수화** (`lib/artists.ts`: `communitySearchTerms`)
  - 태민: `["태민", "TAEMIN", "SHINee 태민"]`
  - 새 아티스트 추가 시 `communitySearchTerms` 배열만 채우면 자동 적용
- **`SourceType`에 "community" 추가** (`lib/types.ts`)
- **`FeedCard.tsx`**: 커뮤니티 아이콘 💬 / 색상 amber, block 버튼 비활성

### 소스 흐름 (현재)
| 소스 | 탭 | 방식 |
|------|-----|------|
| 커뮤니티 | 커뮤니티 | 더쿠 RSS + 네이버 블로그 API (옵션) |
| 유튜브 | 영상 | channels.list + playlistItems.list (API) or RSS fallback |
| 뉴스 | 뉴스 | Google News RSS |
| X | X | 준비중 placeholder |

### 필요 환경변수 (옵션)
- `NAVER_CLIENT_ID` / `NAVER_CLIENT_SECRET` — 네이버 블로그 검색 API

### 2026-04-30 (4차)
- **claude-mem MCP 설치** (`npx claude-mem install`, Bun 설치 포함, 워커 포트 37701)
- **프로젝트 문서 구조화** (`docs/` 폴더 신규)
  - `docs/ARCHITECTURE.md` — 기술 스택, 구조, 데이터 흐름, 아키텍처 원칙
  - `docs/SOURCES.md` — 소스별 상세 (더쿠/네이버/YouTube/뉴스/X) + 개선 방안
  - `docs/PHASE1-MVP.md` — 현재 완료/미완료 목록
  - `docs/PHASE2-BETA.md` — 차기 작업 계획
  - `docs/DEBUGGING.md` — 알려진 버그 + API 직접 테스트 방법
- **CLAUDE.md 전면 재작성** — docs/ 인덱스 역할, 현재 상태 요약 포함
- **커뮤니티 피드 미작동 원인 파악**
  - 더쿠: 스타 게시판 로그인 필수 → 서버사이드 fetch 차단
  - 네이버: `NAVER_CLIENT_ID` / `NAVER_CLIENT_SECRET` env 없음

### 현재 알려진 버그

| 버그 | 원인 | 해결책 |
|------|------|--------|
| 커뮤니티 카드 0건 | 더쿠 로그인 차단 + Naver env 없음 | `.env.local`에 Naver 키 추가 OR Daum 카페 RSS 대체 |

### 다음 작업 후보
- **즉시**: `.env.local`에 `NAVER_CLIENT_ID` + `NAVER_CLIENT_SECRET` 추가 → 커뮤니티 활성화
- **Phase 2 P0**: Daum 카페 공개 RSS `fetchDaumCafe()` 추가 (`docs/PHASE2-BETA.md`)
- **Phase 2 P1**: 수동 차단 버튼 UI (`SourceFilter.tsx` 확장)
- **Phase 2 P2**: `readabilityFilter.ts` 활성화 및 UI 연동
- **Phase 2 P3**: 멀티 아티스트 지원 (`lib/artists.ts` 확장 + `ArtistTabs.tsx` 완성)

### 2026-04-30 (5차)
- **`app/api/community/route.ts` 전면 재작성** — 더쿠 스타 게시판 RSS 방식 완전 폐기
  - `fetchDCInside()`: DC Inside 마이너 갤러리 HTML 스크레이핑
    - 태민갤 (`?id=taemin`), 샤이니갤 (`?id=shinee`) 각 3페이지씩 수집
    - `ub-content` 행 파싱 → 링크·제목·날짜 추출
    - 아티스트 전용 게시판이므로 키워드 필터 없이 전체 수집
    - **API 키 불필요 — 현재 작동 중** ✅
  - `fetchTheqooLinks()`: 네이버 웹 검색 API로 더쿠 링크 카드 수집
    - `site:theqoo.net 태민` 등 쿼리 → `isTheqooLink()` 필터로 theqoo.net 결과만 남김
    - 날짜는 네이버 웹 검색에서 제공 안 되므로 `1970-01-01` (날짜 미상 처리)
    - **`NAVER_CLIENT_ID` + `NAVER_CLIENT_SECRET` env 필요** ⚠️
  - `fetchNaverBlog()`: 기존 유지 (네이버 블로그 API)
  - `communityProvider` 구분: `"dcinside"` | `"naver"` | `"theqoo"`
- **`lib/artists.ts`** — `communityBoards` DC Inside URL로 교체
  - `https://gall.dcinside.com/mgallery/board/lists/?id=taemin`
  - `https://gall.dcinside.com/mgallery/board/lists/?id=shinee`
- **`components/FeedCard.tsx`** — `COMMUNITY_META` 배지 추가
  - 디시 파란색 `#3232FF`, 네이버 초록색 `#03C75A`, 더쿠 퍼플 `#8B5CF6`

### 커뮤니티 소스 현황 (5차 이후 정정)

| 소스 | 방식 | 상태 |
|------|------|------|
| DC Inside 태민갤·샤이니갤 | HTML 스크레이핑 | ✅ env 없이 작동 |
| 더쿠 링크 카드 | 네이버 웹 검색 API | ⚠️ Naver env 필요 |
| 네이버 블로그 | 네이버 블로그 API | ⚠️ Naver env 필요 |

---

## 2026-05-11

### 완료
- CLAUDE.md 현행화 — 커뮤니티 소스 상태 테이블 정정 (더쿠 RSS ❌ → DC Inside ✅)
- HANDOFF.md 현행화 — 5차(community/route.ts 재작성) 내용 추가

### 현재 상태
- DC Inside 스크레이핑 정상 작동 (env 불필요)
- Naver env 없으면 커뮤니티는 DC Inside 카드만 표시됨

### 다음 작업 후보
- `.env.local`에 `NAVER_CLIENT_ID` + `NAVER_CLIENT_SECRET` 추가 → 더쿠 링크 + 네이버 블로그 활성화
- Phase 2 P1: 수동 차단 버튼 UI
- Phase 2 P3: 멀티 아티스트 지원

---

## 2026-05-12

### 완료 — OverviewPanel P0 고도화
- `components/OverviewPanel.tsx`에 P0 작업 반영 (5/12 14:18 기준)
  - 헤드라인 클러스터링 (`clusterCards`, `scoreCluster`)
  - 트러스트 뱃지 (`getTrustBadge`) — 🟢공식/🟡언론/🟣팬커뮤니티/🔵X반응/🔴영상
  - 입문자 글로사리 (`TERM_GLOSSARY`, `getContextHint`) — 코첼라/컴백/직캠/단콘/음방/티저/뮤비/빌보드/팬싸/굿즈/위버스
  - TL;DR 3줄 요약 (`TLDRSection`) — 공식🚨 / 화제📰 / 팬덤💬
  - 중요도 3카테고리 (`bucketOf`, `BucketSection`) — 🚨 꼭 봐야 함 / 🔥 지금 화제 / 💎 여유 되면

### 발견 — 두 코드베이스 공존
- `~/Downloads/dukview` (포트 3000) — **정본**
- `~/Documents/Codex/2026-04-27/files-mentioned-by-the-user-dukview-2/dukview` (포트 3001) — Codex.app 워크트리 사본
- 두 사본이 5/12 이후 분기 진화함 (Codex는 라이트 테마, AI 브리핑(Groq), 커뮤니티 탭 제거 등 별도 방향)

---

## 2026-05-13

### 결정 — 정본 확정
- **정본 경로**: `/Users/kong/Downloads/dukview`
- Codex 사본은 **참고용으로만 사용** (cherry-pick 소스로만 활용)
- Codex 사본의 `HANDOFF.md`/`CLAUDE.md`는 정본에 절대 덮어쓰지 않음

### 완료 — P1 데이터 1차 반영 (Codex 사본에서 cherry-pick)
- `lib/types.ts`
  - `UpcomingEventKind` 유니온 추가 (`comeback | concert | fanmeeting | broadcast | release | ticket | other`)
  - `UpcomingEvent` 인터페이스 추가 (`id`, `title`, `date`, `kind`, `link?`, `action?`, `note?`)
  - `Artist.upcomingEvents?: UpcomingEvent[]` 필드 추가
  - 기존 community/colors/comeback/officialLinks/fandomName/category/isOfficial/stats 등 정본 자산 모두 보존
- `config/artists.ts`
  - 태민 객체에 `upcomingEvents` 데이터 2건 추가 (예상치, 공식 발표 시 교체 주석 명시)
    - `shinee-fanmeet-2026` (2026-07-15, fanmeeting)
    - `taemin-album-2026` (2026-09-01, comeback)
- `npx tsc --noEmit` 통과

### 보류 — 후속 작업 (정본 미반영)
| 항목 | 위치 | 비고 |
|------|------|------|
| OverviewPanel UI 연결 (`upcomingEvents` props 수신 + 렌더 호출) | Downloads `components/OverviewPanel.tsx` | Props 시그니처 다름 — 다크 테마 + 기존 구조에 맞춰 재작성 필요 |
| `UpcomingEventsBlock` 컴포넌트 | Codex 참고 → Downloads 포팅 | 통째 복붙 X |
| `getDDay`, `formatEventDate`, `EVENT_META` 헬퍼 | 위 컴포넌트 종속 | 같이 처리 |
| `app/page.tsx`에서 props 전달 (`upcomingEvents={artist.upcomingEvents \|\| []}`) | Downloads `app/page.tsx` | 한 줄 추가 |
| 라이트 테마 적용 (별도 Phase 후보) | 전 영역 | 별도 검토 — `dv-shell`/`dv-card` 클래스, 배경/카드 톤, OverviewPanel 영향 |
| `app/api/briefing` (Groq LLM) | Codex 사본 단독 | `GROQ_API_KEY` 필요. P1과 무관, 별도 의사결정 |

### 다음 작업 순서
1. **OverviewPanel `upcomingEvents` UI 연결** ← **현재 우선순위**
   - Downloads `OverviewPanel` Props에 `upcomingEvents?: UpcomingEvent[]` + `artistId?: string` 추가
   - `UpcomingEventsBlock` 다크 테마로 재작성하여 렌더 호출
   - `app/page.tsx`에서 props 전달
2. **D-day 표시** — `getDDay()` 헬퍼 + 임박도 색상 (D-3 빨강, D-14 앰버)
3. **예매 알림 액션 버튼 검토**
   - 1차: 외부 링크 (`event.link`) 버튼만
   - 2차: 캘린더 추가 (.ics blob 또는 Google Calendar URL) — 4050/입문자 친화

### 결정 — 라이트 테마 방향 (적용 보류)

**최종 제품 방향**
- **라이트 모드를 기본 주체로 한다.**
- 다크 모드는 나중에 옵션/토글로 제공한다.
- 단 현재 우선순위는 P1 OverviewPanel 기능 완성 — **지금은 라이트 테마 코드를 적용하지 않는다.**

**Light Theme Phase α — 적용 후보 (분석 완료, 코드 미반영)**

검토 결과 Codex 사본의 라이트 테마는 두 트랙으로 구성:
1. `body.light-theme` CSS 셀렉터로 기존 `bg-slate-XXX` 다크 클래스를 흰색 계열로 일괄 오버라이드 (가역적)
2. `dv-shell`/`dv-card`/`dv-surface`/`dv-pill`/`dv-topbar` 등 신규 시멘틱 클래스로 컴포넌트 직접 교체 (비가역적, 광범위)

| 코드 | 항목 | 위험도 | 비고 |
|------|------|--------|------|
| **A1** | Codex `globals.css` line 110~167의 `body.light-theme .bg-slate-XXX → 흰색` 오버라이드 룰 ~30개를 Downloads `app/globals.css`에 이식 | 🟢 즉시 적용 가능 | `light-theme` 클래스 없으면 비활성, 기존 다크 무영향 |
| **A2** | Downloads `app/layout.tsx` body에 `light-theme` 클래스 토글 | 🟢 즉시 적용 가능 | 떼면 다크 복귀 |
| **A3** | layout.tsx body 클래스를 `bg-[#f6f7fb] text-slate-900` 라이트 베이스로 (다크 토글 시에만 `bg-[#0d0d1a] text-slate-100`) | 🟢 즉시 적용 가능 | A2와 함께 |
| **B1** | `OverviewPanel.tsx` line 327의 `style={{ color: "#0d0d1a" }}` (헤드라인 뱃지 글자색) — 라이트에서 가독성 검토 | 🟡 검토 후 | 인라인 색은 CSS 오버라이드 안 됨 |
| **B2** | `app/page.tsx`의 `#0d0d1a` 3회, `#101425` 1회 인라인 색 — 사용처 확인 후 판단 | 🟡 검토 후 | 인라인 색 동일 사유 |

**Light Theme Phase β — 선택 후속**
- Codex `globals.css`의 `body.light-theme` 본문 그라디언트 (radial × 2) 채택 여부 — 시각적 인상 크게 바뀜
- 라이트/다크 토글 버튼 UI

**Light Theme Phase γ — 장기 보류**
- **C1**: `dv-shell`/`dv-card`/`dv-surface`/`dv-pill`/`dv-topbar` 시멘틱 클래스로 컴포넌트 7개(layout.tsx, page.tsx, OverviewPanel.tsx, FeedCard.tsx, SourceFilter.tsx, XSignalComposer.tsx, AdSlot.tsx) 전반 마이그레이션
- 다크 모드 폐기를 결정한 이후에만 진행 (비가역적, 광범위 수정)

**현재 작업 복귀**: 위 라이트 테마 작업 보류. 다음 작업은 위 「다음 작업 순서」 1번 — **OverviewPanel `upcomingEvents` UI 연결**.

### 절대 금지
- Codex 사본의 `HANDOFF.md` / `CLAUDE.md`를 정본에 덮어쓰기
- Codex 사본 전체 merge
- 정본 파일 전체 overwrite (모든 변경은 `Edit`으로 부분 수정)

---

## 2026-05-13 — 추가 완료 기록

### 완료 — OverviewPanel upcomingEvents UI 연결
- 정본 `/Users/kong/Downloads/dukview` 기준으로 작업 완료
- 수정 파일은 아래 2개만 사용
  - `components/OverviewPanel.tsx`
  - `app/page.tsx`
- `OverviewPanel`에 `upcomingEvents?: UpcomingEvent[]` props 연결
- `UpcomingEventsBlock` 추가
  - 다크 테마 톤 유지 (`slate-900/45`, `slate-950/45`, `slate-800` 계열)
  - 일정 종류 라벨 표시
  - 날짜 표시
  - D-day 표시 (`D-DAY`, `D-N`, `D+N`)
  - 임박도 색상 구분 (`D-3` 이내 red, `D-14` 이내 amber, 그 외 cyan)
  - `예매 알림` 버튼은 기능 없이 UI 구조만 추가
- `app/page.tsx`에서 `upcomingEvents={artist.upcomingEvents || []}` 전달
- 라이트 테마 관련 수정 없음
- `app/api/briefing` 수정 없음
- Codex 사본 참조/merge/overwrite 없음
- 타입 체크 통과
  - `npx tsc --noEmit`

### 현재 상태
- OverviewPanel upcomingEvents UI는 정본에 연결 완료
- UI 피드백 대기 상태

### 다음 작업 후보
1. upcomingEvents UI 실제 화면 피드백 반영
2. `예매 알림` 버튼 동작 정의
   - 외부 예매/공지 링크 열기
   - 캘린더 추가 기능
   - 알림 설정 UX
3. 공식 일정 확정 시 `config/artists.ts`의 태민 예상 일정 데이터 교체
4. 라이트 테마 Phase α 재검토 (별도 승인 후)

---

## 2026-05-15

### 완료 — Light Theme Phase α 적용 (B안: 단색 라이트 베이스)

**범위 (사용자 승인 범위 그대로)**
- A1: `body.light-theme` CSS 오버라이드 룰 이식
- A2: `app/layout.tsx` body에 `light-theme` 토큰 추가
- A3: 기본 body 배경/텍스트를 라이트 기준으로 전환

**금지 사항 준수**
- dv-* 시멘틱 클래스 마이그레이션 ❌ 없음
- FeedCard / OverviewPanel 구조 리팩토링 ❌ 없음
- `app/api/briefing` 수정 ❌ 없음 (정본에 존재하지 않음)
- 다크 모드 제거 ❌ 없음 — 다크 베이스 클래스 유지

**수정 파일 (2개)**
1. `app/globals.css` — 끝에 라이트 테마 오버라이드 블록 append (+77줄)
   - `body.light-theme { background: #f6f7fb; color: #172033; … }` 단색 베이스 (radial/cyan/purple 글로우 제외)
   - Codex 기준 룰 + OverviewPanel 실사용 변형 4개 추가 (`slate-900/55`, `slate-950/45`, `slate-950/55`, `slate-800/80`)
2. `app/layout.tsx` — body className에 `light-theme` 토큰 1단어 추가
   - 다크 베이스 (`bg-[#0d0d1a] text-slate-100`) 그대로 유지

**가역성**
- `app/layout.tsx`의 `light-theme` 토큰 1단어만 제거하면 즉시 다크 복귀
- 다른 파일 변경 불필요
- CSS specificity: `body.light-theme` (0,1,1) > Tailwind utility (0,1,0)

**검증**
- `npx tsc --noEmit` → 0 errors

### 실제 화면 확인 필요 항목 (Phase α 적용 후 잔여 리스크)

1. **흰 위 흰 뱃지 3곳** — 본문(`#f6f7fb`)과 카드 배경(흰색 94%)이 유사해 강세 약화
   - `OverviewPanel.tsx:383` — `bg-slate-800/80 text-slate-300` 카운트 뱃지
   - `OverviewPanel.tsx:530` — `bg-slate-900 text-slate-300` "여유 되면" 영역 D-day/액션 뱃지
   - `FeedCard.tsx:54` — `bg-slate-800 text-slate-600` 빈 썸네일 placeholder
   - 해결 후보: 라이트 모드 전용 보더/배경 톤(예: `#f1f4f9` 또는 보더 강화)

2. **UpcomingEventsBlock D-day 색상** — 다크 톤 기준 채도(red/amber/cyan 인라인)로 작성되어 라이트 위에서 채도가 강해 보일 가능성
   - 해결 후보: D-3 빨강 / D-14 앰버 / 그 외 cyan의 채도/명도 라이트용 재조정

3. **FeedCard 뱃지 대비** — 소스별 색 뱃지(`bg: ${color}18`, `border: ${color}40`)
   - DC `#3232FF` / 네이버 `#03C75A` / 더쿠 `#8B5CF6` — 라이트 베이스에서 대비 충분 확인됨 ✅
   - 단 `${color}18`(10% 알파) 톤이 흰 위에서 약해 보일 수 있음 — 실제 렌더 후 판단

### 다음 작업
- **실제 화면 확인 후 UI 디테일 조정**
  - 위 1~3번 항목 시각 확인
  - 필요 시 라이트 모드 전용 보더/배경/채도 미세 튜닝
- Phase β (토글 버튼 UI) 및 Phase γ (dv-* 시멘틱 마이그레이션)는 계속 보류

### 절대 금지 (재확인)
- Codex 사본의 `HANDOFF.md` / `CLAUDE.md`를 정본에 덮어쓰기
- Codex 사본 전체 merge
- 정본 파일 전체 overwrite (모든 변경은 `Edit`으로 부분 수정)

---

## 2026-05-15 — UI/UX polish 및 다음 인계 메모

### 방향 확정
- 라이트 테마는 현재 제품 방향으로 유지한다.
- 다크 fallback 가능성은 유지한다. `app/layout.tsx`의 `light-theme` 토큰 제거로 되돌릴 수 있는 구조는 계속 보존한다.
- 최근 glassmorphism / 강한 shadow / 떠오르는 hover 실험은 제품 방향이 아닌 것으로 판단했다.
- UI 방향은 효과 중심이 아니라 정보 구조 중심으로 정리한다.
  - 명확한 정보 위계
  - 안정적인 surface/border 구분
  - 충분한 spacing
  - 낮은 채도의 라이트 배경
  - Notion / Linear / 토스 / 최신 SaaS류의 절제된 정보 피드 톤

### 진행된 재점검
- typography / hierarchy 재점검 진행
  - OverviewPanel 내부 제목/메타/설명/D-day/액션 버튼 스케일을 검토 및 일부 조정
  - FeedCard는 현재 `16px title / 13px summary / 11px meta` 스케일을 유지하는 방향
- OverviewPanel hierarchy 이슈 확인
  - 일정 제목, note, date/meta, D-day, 예매 알림 버튼 간 균형이 아직 최종 확정은 아님
  - D-day는 강조 유지, 예매 알림은 보조 액션으로 유지
- 예매 알림 버튼 상태감 문제 확인
  - 너무 ghost 처리하면 disabled/off 상태처럼 보임
  - 현재는 Quiet Filled 방향으로 조정했으나, 실제 화면 기준 추가 디자인 판단 필요
- glass/shadow/hover 정리
  - 강한 shadow, hover `translateY`, 떠오르는 카드 효과는 제거/비권장
  - hover는 background/border 중심의 subtle interaction으로 유지

### 현재 UI/UX 상태 요약
1. 안정된 점: 라이트 테마 기본 방향, 정보 피드형 톤, 다크 fallback 구조는 안정됨.
2. 안정된 점: 카드가 둥둥 뜨는 느낌은 줄었고, hover도 과한 효과보다 조용한 반응으로 정리됨.
3. 안정된 점: FeedCard의 제목/요약/meta 스케일은 당분간 유지해도 될 수준으로 정돈됨.
4. 아직 어색한 점: OverviewPanel 내부의 일정/D-day/예매 알림 버튼 위계는 실제 화면 기준 최종 판단 필요.
5. 아직 어색한 점: 예매 알림 버튼은 보조 액션이지만 clickable하게 보여야 하며, disabled처럼 보이면 안 됨.
6. 아직 어색한 점: OverviewPanel 섹션 내부 spacing과 제목/meta 대비가 일부 구간에서 미세하게 흔들릴 수 있음.
7. 다음 우선순위: Claude에서 디자인 판단을 이어받아 OverviewPanel hierarchy와 버튼 상태감을 실제 화면 기준으로 재평가.
8. 다음 우선순위: 태민 화면에 타 멤버/타 아티스트 브리핑이 섞이는 데이터 정확도 이슈 추적 준비.
9. 다음 우선순위: 뉴스 썸네일 fallback 개선은 별도 데이터/UX 이슈로 분리해 검토.

### 다음 작업 후보 (Claude 인계)
1. **디자인 판단**
   - OverviewPanel 일정 블록의 D-day / 예매 알림 버튼 배치와 상태감 확인
   - 섹션 제목, meta, note, item title의 실제 모바일 가독성 확인
   - 버튼이 primary처럼 튀지 않으면서 clickable하게 보이는지 판단
2. **데이터 정확도 분석**
   - 태민 화면에 타 멤버 또는 타 아티스트 브리핑이 섞이는 원인 추적
   - source filtering / keyword matching / news context keyword 우선 확인
3. **뉴스 썸네일 fallback 개선 준비**
   - 썸네일 없음/부정확 썸네일 상황에서 정보 피드 톤을 해치지 않는 fallback 검토

### 계속 보류
- Hero Briefing 구현
- 입문자 모드
- 하단 네비게이션 개편
- dv-* 시멘틱 마이그레이션
- app/api/briefing 또는 LLM briefing 계열 구현
- 전체 리팩토링

---

## 2026-05-18

### 완료 — OverviewPanel 헤드라인 스코어링 보정 (F2 + F3)

**배경**
- 오래된 가십/도배 클러스터(예: 3월 "성형설")가 `cards.length` 가중치로 헤드라인을 독식
- 이전 라운드의 negative-weight damping (D1/D3)만으로는 길이 가중치를 못 누름

**수정 파일 (1개)**
- `components/OverviewPanel.tsx`

**F3: NEGATIVE_PENALTY_CAP 12 → 18** (line 50)
- 부정 키워드 누적 페널티 상한 상향
- 효과: T1·T2·T3 다중 키워드 겹친 어그로 클러스터의 디모트 폭 확대

**F2: cards.length cap + 7일 초과 클러스터 페널티** (`scoreCluster` 내부)
- `let score = cluster.cards.length * 3;` → `let score = Math.min(cluster.cards.length, 5) * 3;`
- recency 블록에 `else if (recency > 10080) score -= 8;` 추가 (7일 = 10080분 초과)
- 효과: 10+ 매체 도배 시 점수 30+ 먹는 구조 차단, stale cluster 디모트

**점수 시뮬레이션 (검증용)**

| 케이스 | 변경 전 | 변경 후 |
|--------|---------|---------|
| 3월 성형설 클러스터 (10 cards, T2/T3 다중, 7일 초과) | 30 | 7 |
| 어그로 클러스터 (T1+T2+T3, 7일 초과) | 43 | 7 |
| 단콘 fresh (4 cards) | 26 | 26 |
| 일반 핫 (5 cards, recency 양호) | 57 | 48 |

**보류 — F1 (group official whitelist)**
- `groupName` + `GROUP_OFFICIAL_KEYWORDS` 화이트리스트는 이번 라운드 보류
- 이유: 타 멤버 단독 활동이 태민 피드로 들어오는 false positive 위험 우선 회피
- 재시도 조건 후보 (다음 라운드):
  - `Artist.groupMembers: string[]` 필드 신설 → 다른 멤버명 포함 시 score ×0.5 디모트
  - 화이트리스트 키워드 보수적으로: "컴백/신보/발매" 제외, "단콘/콘서트/팬미팅" 위주
  - 소스 제약: 공식 채널 / 공식 보도 도메인만 통과

**제약 준수**
- 태민 하드코딩 없음 (모든 변경은 공용 상수/스코어 레벨)
- shared-source filtering 구조 유지 (`youtubeSharedChannelIds`, `communitySharedBoards`, `sharedBoardFilterTerms`)
- 멀티 아티스트 확장성 유지
- UI / 타입 구조 / 썸네일 / Hero Briefing 미수정
- `npx tsc --noEmit` → 0 errors

---

### 완료 — Internal Preview 배포 준비 (P0 1~3)

**배경**
- 정식 배포가 아니라 internal preview 가능성 점검 요청
- 현재 git repo 아니고 `.gitignore` 없음 → `.env.local` (TUBE / NAVER 키) 노출 차단이 최우선

**보안 감사 요약**

| 우선순위 | 항목 | 상태 |
|---------|------|------|
| P0 | `.gitignore` 없음 → `.env.local` 노출 위험 | ✅ 해결 |
| P0 | `.env.example` 없음 → 협업자 설정 가이드 부재 | ✅ 해결 |
| P0 | README 구버전 (2026-04-23 초안, 현 구조와 괴리) | ✅ 해결 |
| P1 | `/api/og-image` SSRF (임의 URL fetch, 사설 IP 미차단) | ⏸ 보류 |
| P1 | 모든 API 라우트 인증/rate limit 없음 | ⏸ 보류 |
| P2 | Naver search HTML 스크레이핑 ToS 회색 | ⏸ 정식 배포 시 재검토 |
| 안심 | DB 없음, 서버측 PII 0, AdSlot placeholder, PremiumContext placeholder | — |

**수정 파일 (3개)**

1. **`.gitignore`** (NEW, 33줄)
   - secrets: `.env*` + `!.env.example`
   - deps/build: `node_modules/`, `.next/`, `*.tsbuildinfo`, `next-env.d.ts`
   - OS/editor: `.DS_Store`, `Thumbs.db`, `.vscode/`, `.idea/`, `*.swp`
   - AI 세션: `.claude/`
   - 오타폴더: `{app/`

2. **`.env.example`** (NEW, 15줄)
   - YouTube / Naver 키 placeholder + 발급 URL 주석
   - 실제 키 값 없음
   - `search.list` 호출 금지 주석 명시

3. **`README.md`** (UPDATE, 67 → 86줄)
   - Phase 1 MVP / internal preview 단계 명시
   - 설치 3단계 (`npm install` → `cp .env.example .env.local` → `npm run dev`)
   - 환경변수 표 (`TUBE_API_KEY` / `NAVER_*` 등)
   - `.env.local` 커밋 금지 경고
   - 보안 민감 항목(SSRF / 내부 인시던트 / `.claude/`) **미포함**

**`.env.local` 무수정 확인**
- 타임스탬프 2026-04-30 그대로, 215 bytes 유지
- 실제 키 5개 (TUBE / YOUTUBE_DATA_API_ENABLED / YOUTUBE_SEARCH_DAILY_LIMIT / NAVER_CLIENT_ID / NAVER_CLIENT_SECRET) 그대로

**다음 사용자 작업 순서 (이번 라운드 외)**
1. `git init && git branch -M main`
2. `git check-ignore -v .env.local` → 매칭 확인 (출력 없으면 STOP)
3. `git add . && git status` → 목록에 `.env.local` 없는지 확인
4. `git commit -m "chore: initial commit (Phase 1 MVP, internal preview)"`
5. GitHub **Private** repo 생성 후 push
6. push 직후 GitHub 페이지에서 키 검색 (`AIzaSy`, Naver secret 일부) → 0건 확인
7. 노출 발견 시 즉시 Google / Naver 콘솔에서 키 폐기·재발급

**보류 작업 (별도 라운드)**
- P1 SSRF 가드 (`/api/og-image` 도메인 화이트리스트 또는 사설 IP 블록리스트)
- P1 rate limiting / Vercel Password Protection
- Vercel 환경변수 입력 + preview deploy 자체 실행
- 키 회전 결정

### 절대 금지 (재확인)
- Codex 사본의 `HANDOFF.md` / `CLAUDE.md`를 정본에 덮어쓰기
- Codex 사본 전체 merge
- 정본 파일 전체 overwrite (모든 변경은 `Edit`으로 부분 수정)
- `.env.local` 직접 수정

---

## 2026-05-20 (1차 — SSRF guard 적용)

### 완료 — `/api/og-image` SSRF guard 적용 (Tier 1 + Tier 2)

**수정 파일 (1개)**
- `app/api/og-image/route.ts` — 58줄 → 178줄, 단일 파일 수정
- 기존 cache / `extractOgImage` / 응답 스키마 (`{ imageUrl: string \| null }`) 유지
- UI 수정 ❌ / 다른 API route 수정 ❌

**Tier 1 — 정적 검증**
- `new URL()` 파싱, `protocol ∈ {http:, https:}` 강제 (regex 검증 폐기)
- 포트: 명시 없음 또는 `80`/`443`만 허용
- hostname 차단: `localhost`, `*.localhost`, `*.local`, `*.internal`
- IPv4 사설/예약 대역 차단: `0/8`, `10/8`, `127/8`, `169.254/16`, `172.16/12`, `192.168/16`, `100.64/10` (CGNAT), `224/4` (multicast/reserved)
- IPv6 차단: `::1`, `::`, `fe80::/10` (link-local), `fc00::/7` (ULA), `::ffff:<사설 IPv4>` 매핑

**Tier 2 — DNS lookup 재검증**
- `node:dns/promises.lookup(hostname, { all: true })`로 모든 resolve된 IP를 Tier 1 규칙으로 재판정
- DNS rebinding / wildcard DNS (`*.nip.io` 류) 우회 차단
- resolve 실패 / 결과 0건이면 null

**Redirect 처리**
- `redirect: "manual"` + 최대 3 hop
- 각 hop의 `Location`을 `validateUrl`로 재검증 후 진행
- hop budget 초과 / 검증 실패 시 null

**Fail-safe**
- 모든 실패 경로에서 `{ imageUrl: null }` 반환 → NewsCard placeholder fallback으로 흡수
- 앱 크래시 없음
- per-hop 타임아웃 `AbortSignal.timeout(6000)` 유지

**검증**
- `npx tsc --noEmit` → 0 errors
- 차단 케이스: localhost / 127.0.0.1 / 169.254.169.254 / 10.x / 172.16~31.x / 192.168.x / 100.64.x / `[::1]` / `[fe80::1]` / `[fc00::1]` / `[::ffff:127.0.0.1]` / `ftp://` / `javascript:` / `:22` 등 비표준 포트 / 302 → 사설IP 우회 / 4+ hop
- 통과 케이스: `news.google.com` / `n.news.naver.com` / `chosun.com` / `hankyung.com` / `mk.co.kr` / `news1.kr` / `yna.co.kr` 등 한국 언론사 도메인 전반

---

### Internal preview 배포 사전 준비 (5/18 ~ 5/20 누적)

| 항목 | 상태 | 비고 |
|------|------|------|
| `.gitignore` | ✅ | secrets / `.env*` / `node_modules` / `.next` / `.claude` / OS junk |
| `.env.example` | ✅ | YouTube / Naver placeholder + 발급 URL 주석 |
| `README.md` | ✅ | Phase 1 MVP / preview 단계 명시, 설치 3단계, env 표 |
| GitHub private repo 생성 + initial commit + push | ✅ | `06ea067 chore: initial commit (Phase 1 MVP, internal preview)` |
| `.env.local` 미커밋 확인 | ✅ | `.gitignore` 차단, 215 bytes 원본 그대로 |
| `/api/og-image` SSRF guard | ✅ | Tier 1 + Tier 2 |

---

### Internal preview 기준 보안 상태 요약

| 항목 | 상태 | public 배포 전 |
|------|------|----------------|
| Secrets 노출 차단 | ✅ | — |
| `/api/og-image` SSRF | ✅ Tier 1+2 | IP-pin custom Agent (TOCTOU race 차단) |
| 다른 API 라우트 SSRF | 🟢 위험 낮음 | 외부 URL 직접 입력 받는 라우트 없음 (Google News / Naver / YouTube / DC만 호출) |
| Auth / Rate limit | ❌ 없음 | P1 별도 라운드 |
| HTTPS 강제 | ❌ http 허용 | 검토 |
| 응답 본문 크기 가드 | ❌ 무제한 | `Content-Length` 검사 또는 stream + max-bytes |
| Vercel Password Protection | ❌ 미적용 | preview 공개 범위 결정 후 |
| WAF / Vercel firewall | ❌ 미적용 | public 배포 시 |

---

### 배포 전 남은 체크리스트

1. **Vercel 계정 문제 해결** ⚠️ — deploy 강행 금지, 계정 정상화 우선
2. Vercel 프로젝트 환경변수 입력
   - `TUBE_API_KEY`
   - `YOUTUBE_DATA_API_ENABLED`
   - `YOUTUBE_SEARCH_DAILY_LIMIT`
   - `NAVER_CLIENT_ID`
   - `NAVER_CLIENT_SECRET`
3. Preview deploy 실행 (Vercel dashboard 또는 CLI)
4. 배포 직후 GitHub repo 페이지에서 secret 키워드 검색 (`AIzaSy`, Naver secret 앞 8자) → 0건 재확인
5. `git log --all -- .env.local` 빈 출력 확인 (`.env.local` 커밋 이력 0건)
6. preview URL 공유 범위 제한
   - Vercel Password Protection 또는 비공개 링크 운영
   - 외부 SNS / 커뮤니티 공유 ❌

---

### 다음 개발 우선순위 (preview 운영 중 관찰)

1. **데이터 품질 관찰**
   - 태민 화면에 타 멤버 / 타 아티스트 브리핑 섞이는 빈도 추적
   - source filtering / keyword matching / news context keyword 우선 확인
2. **블로그 노이즈 사례 수집**
   - 네이버 블로그 카드에서 광고 / 도배 / 저질 콘텐츠 사례 기록
   - 차단 키워드 / 블랙리스트 후보 누적
3. **썸네일 누락 사례 수집**
   - og:image 추출 실패 도메인 목록화
   - placeholder fallback 비율 측정
   - SSRF guard에 의한 false positive 사례 발생 여부 확인

후순위 / 보류
- Event Intelligence (D-day 일정 자동 수집·LLM 추출) — **후순위, 대공사 금지**
- Hero Briefing (LLM 요약) — **계속 보류**
- 입문자 모드 / 하단 네비게이션 개편 / dv-* 시멘틱 마이그레이션 — **계속 보류**
- `/api/briefing` (Groq LLM) — **계속 보류**

---

### 아직 하지 말 것

- ❌ public release / public 공개 deploy
- ❌ GitHub repo를 public으로 전환
- ❌ 대규모 UI 수정 / 전체 리팩토링
- ❌ Hero Briefing 구현 / `/api/briefing` 신설
- ❌ Event Intelligence 대공사 (`upcomingEvents` 자동 수집·LLM 추출 등)
- ❌ 다른 API 라우트에 rate limit / auth 같은 P1 작업을 이번 라운드에서 묶어 처리
- ❌ Vercel deploy를 계정 문제 미해결 상태에서 강행

### 절대 금지 (재확인)
- Codex 사본의 `HANDOFF.md` / `CLAUDE.md`를 정본에 덮어쓰기
- Codex 사본 전체 merge
- 정본 파일 전체 overwrite (모든 변경은 `Edit`으로 부분 수정)
- `.env.local` 직접 수정

---

## 2026-05-20 (2차 — IPv6-mapped 보강 + live 검증 + push)

### 완료 — IPv6-mapped IPv4 hex 형식 보강

**버그 발견 (재시작 후 live 검증 중)**
- `[::ffff:127.0.0.1]` 요청이 HTTP 200으로 통과 — Tier 1 hole
- 원인: WHATWG URL 파서가 `::ffff:127.0.0.1` → `::ffff:7f00:1` (16진수)로 정규화. 1차 패치의 `isIpv6Blocked` regex는 점-구분 형식만 매칭해서 우회됨

**패치 (commit `9b84e15`)**
- `app/api/og-image/route.ts` +14 / −2
- `isIpv6Blocked`에 hex 형식(`::ffff:HHHH:HHHH`) + 옛 IPv4-compatible 형식(`::HHHH:HHHH`) 매칭 추가
- 16-bit hex 2개를 octet 4개로 분해 → `isIpv4Blocked` 재사용
- `npx tsc --noEmit` → 0 errors

---

### 완료 — Dev server 재시작 + live 검증

`kill 20915` (19일 떠 있던 묵은 서버) → `npm run dev` 재시작 → curl 30 케이스 검증.

**차단 케이스 (HTTP 400, body `{"imageUrl":null}`) — 20/20 통과**

| 카테고리 | 통과 패턴 |
|---------|-----------|
| 입력 검증 | no `url` 파라미터, 비-URL, `ftp://`, `javascript:`, port `:22` |
| hostname 차단 | `localhost`, `app.localhost`, `something.local` |
| IPv4 사설 | `127.0.0.1`, `0.0.0.0`, `10.0.0.5`, `169.254.169.254`, `172.20.1.1`, `192.168.1.1`, `100.64.0.1` |
| IPv6 리터럴 | `[::1]`, `[fe80::1]`, `[fc00::1]` |
| **IPv6-mapped (패치 후)** | `[::ffff:127.0.0.1]`, `[::ffff:10.0.0.1]`, `[::ffff:192.168.0.1]`, `[::ffff:169.254.1.1]`, hex `[::ffff:c0a8:1]`, deprecated `[::7f00:1]` |
| **Tier 2 DNS rebinding** | `127.0.0.1.nip.io` (wildcard DNS → 127.0.0.1) |

**통과 케이스 (HTTP 200) — 10/10 통과**

| 도메인 | 결과 |
|--------|------|
| `news.google.com` | ✅ og:image 추출 |
| `n.news.naver.com` | ✅ og:image 추출 |
| `www.naver.com` | ✅ og:image 추출 |
| `www.chosun.com` | null (도메인이 og:image 미제공 — placeholder fallback 정상) |
| `www.hankyung.com` | ✅ |
| `www.mk.co.kr` | ✅ |
| `news1.kr` | ✅ |
| `www.yna.co.kr` | ✅ |
| `www.youtube.com` | ✅ |
| `example.com` | null (정상) |

회귀 없음. 차단/통과 분기 모두 의도대로 동작.

---

### 완료 — push 처리

- 로컬 commit 2건
  - `d8e30e6 chore: add SSRF guard to /api/og-image`
  - `9b84e15 fix: cover IPv6-mapped IPv4 forms in SSRF guard`
- 터미널 `git push` → HTTPS 자격 증명 미설정으로 `fatal: could not read Username for 'https://github.com'`
- 해결: GitHub Desktop으로 push origin 진행 → `origin/main` 동기화 완료 (`git status` clean)
- `gh` CLI 미설치 — 다음 push도 GitHub Desktop 사용 권장 (또는 SSH remote 전환 / Personal Access Token + keychain)

---

### 로컬 dev server

- `npm run dev` 백그라운드 실행 중 → http://localhost:3000
- SSRF guard 최신 코드 반영된 상태
- 다음 세션 진입 시 살아 있을 수 있음 — 필요하면 `lsof -nP -iTCP:3000 -sTCP:LISTEN`으로 확인 후 `kill <pid>`

---

### 다음 행동 후보 (불변)

1. Vercel 계정 정상화 → preview deploy
2. 운영 중 데이터 품질·블로그 노이즈·썸네일 누락 사례 수집
3. public 배포 전 P1 항목 (rate limit, IP-pin Agent, 응답 크기 가드, HTTPS 강제)

### 절대 금지 (재확인)
- Codex 사본의 `HANDOFF.md` / `CLAUDE.md`를 정본에 덮어쓰기
- Codex 사본 전체 merge
- 정본 파일 전체 overwrite (모든 변경은 `Edit`으로 부분 수정)
- `.env.local` 직접 수정

---

## 2026-05-20 (3차 — 제품 고도화 계획 정리)

### 완료 — `docs/ROADMAP.md` 신규 작성

**작성 파일 (1개 신규)**
- `docs/ROADMAP.md` — 제품 정의·핵심 타깃·제품 원칙·UI 방향·우선순위 로드맵 (P0~P3)

**핵심 문장**
> 오늘 덕질에서 진짜 중요한 것만 정리해주는 앱

**핵심 타깃 (재확정)**
- 4050 직장인 팬 — 시간 없음 / X 안 함 / 용어 어려움 / 루머·렉카 구분 힘듦
- 덕질 입문자 — 컴백·직캠·단콘 용어 어려움 / 맥락 부족
- 공통 — 공식 vs 추정 vs 팬덤 반응 구분 / D-day / 오늘 할 일 / 놓친 소식 요약

**우선순위 로드맵 요약**

| Tier | 항목 | 비고 |
|------|------|------|
| **P0** | Hero Briefing | 페이지 최상단 오늘의 핵심 토픽 1개, 신뢰도·관련 N건·왜 중요한지 한 줄 |
| **P0** | 3줄 TL;DR | 공식 / 화제 / 팬덤 — 카드 없는 날도 "오늘은 조용해요" 솔직 표시 |
| **P0** | 확정 / 추정 / 반응 / 노이즈 분류 | "이거 진짜야?" 판단 도구 |
| P1 | 3섹션 구조 유지 | 꼭 봐야 함 / 지금 화제 / 여유 되면 |
| P1 | 카드별 "왜 중요한지" 한 줄 | 중요 카드만 짧게 |
| P1 | 출처 다양성 표시 | 관련 7건 · 뉴스 3 · 팬덤 3 · 공식 1 |
| P1 | 다가오는 일정 위젯 (현행 유지 + 확장) | 확정/예상 표시, 캘린더 후보 |
| P1 | 오늘 놓치면 안 되는 액션 | "오늘 체크할 것 3개" |
| P1 | 알림 / 리마인더 (MVP는 캘린더·D-day) | 푸시는 후순위 |
| P1.5 | 놓친 소식 요약 / 조용한 날 UX / 팬덤 온도 / 오늘의 대표 영상 | 재방문 핵심, localStorage 기반 가능 |
| P2 | 입문자 모드 / 관심사 태그 / 노이즈 리포트 | 덕뷰 차별점 |
| P3 | 로그인(선택) / 프리미엄 | 기능 안정화 후 |

---

### 우선순위 변경 — 이전 "아직 하지 말 것"의 일부 해제

**이전 (1차 entry, 2026-05-20 14시경 기준)** 에서 `❌ Hero Briefing 구현 / /api/briefing 신설` 및 `❌ Event Intelligence 대공사` 가 보류 항목으로 명시되어 있었음.

**3차 entry (현재)** 부터 **다음 항목은 정식 우선순위로 진입**:
- Hero Briefing → **P0**
- 3줄 TL;DR → **P0**
- 확정 / 추정 / 반응 분류 → **P0**
- 다가오는 일정 위젯 확장 (확정/예상, 캘린더 후보) → **P1**

**여전히 유효한 제약** (해제되지 않음):
- ❌ public release / public 공개 deploy
- ❌ GitHub repo를 public으로 전환
- ❌ 대규모 UI 수정 / 전체 리팩토링 (P0·P1 작업도 점진적으로)
- ❌ 하단 네비 개편 먼저 하기
- ❌ 다른 API 라우트에 rate limit / auth 같은 P1 보안 작업을 같은 라운드에 묶어 처리
- ❌ Vercel deploy를 계정 문제 미해결 상태에서 강행
- ❌ 처음부터 로그인 강제
- ❌ 과한 glass / shadow / 떠오르는 카드
- ❌ 입문자 설명 과다 노출

---

### 다음 작업 진입 전 점검 사항

1. **데이터 모델 — 신뢰도 분류**
   - `FeedCard`에 신뢰도(`confidence: "confirmed" | "estimated" | "reaction" | "noise"`) 필드 추가 검토
   - 분류 로직: 공식 채널 화이트리스트 / 언론 도메인 / 팬커뮤니티 / 키워드 패턴
   - 기존 `isOfficial`, `stats`, `sources` 필드와 충돌·중복 확인
2. **Hero Briefing 데이터 소스**
   - 기존 `OverviewPanel`의 `clusterCards` / `scoreCluster` 결과를 1위 클러스터 뽑아 재사용 가능한지 검토
   - 신규 `/api/briefing` LLM 라우트 필요 여부 — 우선 결정론적(non-LLM)으로 시작 가능한지 점검 (`/api/briefing` 신설은 별도 의사결정)
3. **3줄 TL;DR 데이터 소스**
   - 공식 / 화제 / 팬덤 각 카테고리에 카드 매핑 규칙
   - 카드 0건일 때 문구 fallback 처리
4. **신뢰도 표현 / 카드 디자인**
   - 라이트 톤에 맞는 배지 / 라벨 디자인 (shadow 없이 border + 채도 조절)
   - 기존 `OverviewPanel` `getTrustBadge` 결과와 통일성 점검

작업 순서는 `docs/ROADMAP.md` 우선순위 따라가되, **한 라운드당 1~2개 P0 항목**을 작은 단위로. 한 번에 P0 3개 동시 착수 금지.

---

### 절대 금지 (재확인)
- Codex 사본의 `HANDOFF.md` / `CLAUDE.md`를 정본에 덮어쓰기
- Codex 사본 전체 merge
- 정본 파일 전체 overwrite (모든 변경은 `Edit`으로 부분 수정)
- `.env.local` 직접 수정
