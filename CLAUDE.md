# CLAUDE.md — Dukview 프로젝트 인덱스

K-pop 팬 아티스트 전용 뉴스 피드 애그리게이터.  
YouTube, 뉴스, 커뮤니티 소스를 통합해 하나의 피드로 보여주고 스팸/루머 계정을 필터링.  
MVP는 태민(TAEMIN) 단독. 아웃링크 카드 방식으로 저작권 최소화.

---

## 문서 인덱스

| 문서 | 내용 |
|------|------|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | 기술 스택, 프로젝트 구조, 데이터 흐름, 아키텍처 결정 사항 |
| [`docs/SOURCES.md`](docs/SOURCES.md) | 소스별 상세 (커뮤니티/YouTube/뉴스/X) + 환경변수 |
| [`docs/PHASE1-MVP.md`](docs/PHASE1-MVP.md) | Phase 1 완료/미완료 목록, 현재 상태 |
| [`docs/PHASE2-BETA.md`](docs/PHASE2-BETA.md) | Phase 2 작업 계획 (커뮤니티 정상화, 차단 UI, 멀티 아티스트) |
| [`docs/DEBUGGING.md`](docs/DEBUGGING.md) | 알려진 버그, API 직접 테스트 방법, 환경변수 체크리스트 |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | 제품 정의·타깃·원칙·우선순위 로드맵 (P0 Hero Briefing / TL;DR / 신뢰도 분류) |
| [`HANDOFF.md`](HANDOFF.md) | 세션별 진행 로그 |

---

## 현재 상태 (2026-05-20)

**Phase 1 진행 중.** 태민 단독, RSS + API 혼합, localStorage 상태 관리.
Internal preview 배포 준비 완료 (`.gitignore`, `.env.example`, README 정비, `/api/og-image` SSRF guard, GitHub private repo push).

**제품 방향 (2026-05-20 확정):** "오늘 덕질에서 진짜 중요한 것만 정리해주는 앱" — Hero Briefing / 3줄 TL;DR / 확정·추정·반응 신뢰도 분류가 P0. 상세는 [`docs/ROADMAP.md`](docs/ROADMAP.md) 참조.

| 소스 | 탭 | 상태 |
|------|-----|------|
| Google News RSS | 뉴스 | ✅ 정상 |
| YouTube RSS / Data API | 영상 | ✅ 정상 (API 키 없으면 RSS fallback) |
| YouTube 스크레이핑 | 영상 (검색) | ✅ 정상 |
| DC Inside 마이너 갤러리 스크레이핑 | 커뮤니티 | ✅ 정상 (태민갤·샤이니갤) |
| 더쿠 링크 카드 (네이버 웹 검색 API) | 커뮤니티 | ⚠️ env 키 필요 |
| 네이버 블로그 API | 커뮤니티 | ⚠️ env 키 필요 |
| X (Twitter) | X | 🕐 준비중 placeholder |

**환경 상태:**
- `.env.local`에 `NAVER_CLIENT_ID` + `NAVER_CLIENT_SECRET` 설정 완료 → 네이버 블로그 + 더쿠 링크 카드 활성
- DC Inside 스크레이핑은 env 키 없이도 작동 중
- 신규 협업자는 `cp .env.example .env.local` 후 실제 키 채우면 됨

---

## 핵심 파일 (자주 수정)

```
lib/artists.ts          ← 아티스트/소스 설정 (새 아티스트 추가 여기만)
app/api/feed/route.ts   ← 소스 오케스트레이터
app/api/community/route.ts  ← 더쿠 + 네이버 블로그
app/api/youtube/route.ts    ← YouTube API + 스크레이핑
app/page.tsx            ← 탭 UI + 피드 렌더링
components/FeedCard.tsx ← 카드 컴포넌트
```

---

## 개발 시작

```bash
npm run dev              # 개발 서버 http://localhost:3000
npx claude-mem status    # 메모리 워커 상태 (포트 37701)
```

---

## 컨벤션

- TypeScript `strict: false` (MVP 속도 우선, 향후 타이트닝 가능)
- 경로 alias: `@/*`
- 스타일: Tailwind 유틸리티 + 동적 색상은 `style={{}}`
- 테마: 라이트 베이스 (`#f6f7fb`), 다크 fallback 가능 (`app/layout.tsx`의 `light-theme` 토큰 제거 시 다크 복귀)
- Provider 순서 고정: `Premium → Filter → Tag`
- 소스 타입: `"twitter" | "youtube" | "news" | "community"`
- 새 아티스트 = `lib/artists.ts`의 `DEFAULT_ARTISTS` 배열에 항목 추가만

---

## 주의

- `node_modules/`, `.env.local` 절대 커밋 금지 (`.gitignore`로 차단됨, 2026-05-18)
- `AdSlot.tsx` — Phase 3 전까지 실제 광고 코드 넣지 않을 것
- YouTube `search.list` 절대 사용 금지 (100 units/call → quota 폭발)
- `app/api/og-image` SSRF guard 적용됨 (Tier 1 사설/예약 IP·hostname 차단 + Tier 2 DNS lookup 재검증 + manual redirect 3-hop, 2026-05-20) — public 배포 전 IP-pin custom Agent + 응답 본문 크기 가드 필요
- 모든 API 라우트가 unauth/no-rate-limit — 공개 배포 전 rate limit 필요 (P1 보류)
- 헤드라인 스코어링: `cards.length` cap 5, 7일 초과 클러스터 -8, `NEGATIVE_PENALTY_CAP=18` (2026-05-18)
