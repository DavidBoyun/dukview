# 🦆 덕뷰 (Dukview)

K-pop 아티스트 전용 뉴스 피드 애그리게이터.
YouTube / 뉴스 / 커뮤니티 소스를 하나의 피드로 통합하고 스팸·루머를 필터링.

> **Phase 1 MVP — internal preview 단계.** 정식 배포 아님.
> 현재 MVP는 태민(TAEMIN) 단독.

---

## ⚙️ 기술 스택

- Next.js 14 (App Router, TypeScript)
- Tailwind CSS
- 상태 관리: Context API + LocalStorage (가입/백엔드 DB 없음)
- 데이터 소스: Google News RSS, YouTube Data API v3, DC Inside 스크레이핑, Naver Search/Blog API

---

## 🚀 설치 & 실행

```bash
# 1. 의존성 설치
npm install

# 2. 환경변수 파일 생성 (실제 키 값으로 채우기)
cp .env.example .env.local

# 3. 개발 서버 실행
npm run dev
# → http://localhost:3000
```

---

## 🔑 환경변수

`.env.example` 참고. 필요한 키:

| 변수 | 용도 | 미설정 시 |
|------|------|-----------|
| `TUBE_API_KEY` | YouTube Data API v3 | RSS fallback으로 동작 |
| `YOUTUBE_DATA_API_ENABLED` | API 사용 토글 | `true`로 두면 활성화 |
| `YOUTUBE_SEARCH_DAILY_LIMIT` | 일일 쿼터 가드 | 기본 20 |
| `NAVER_CLIENT_ID` / `NAVER_CLIENT_SECRET` | 네이버 검색·블로그 API | 더쿠/네이버 블로그 카드 미표시 |

---

## ⚠️ 보안 주의

- **`.env.local` 절대 커밋 금지** — `.gitignore`에 차단되어 있지만, push 전 `git status`로 한 번 더 확인.
- `node_modules/`, `.next/` 도 커밋 금지 (gitignore 처리됨).
- 협업자에게 키 공유 시 `.env.example` 구조만 안내, 실제 키는 별도 채널.

---

## 📦 주요 디렉터리

```
app/                Next.js App Router (페이지 + API 라우트)
components/         UI 컴포넌트 (FeedCard, OverviewPanel 등)
config/artists.ts   아티스트/소스 설정 (새 아티스트 추가는 여기)
lib/                공용 타입·유틸
contexts/           Premium / Filter / Tag Provider
docs/               아키텍처·소스·페이즈 문서
```

---

## 📋 Phase 진행 상태

- **Phase 1 (MVP)** — 진행 중. 태민 단독, 피드 통합, 차단 시스템 기본.
- **Phase 2 (Beta)** — 계획. 멀티 아티스트, 차단 UI, 커뮤니티 정상화.
- **Phase 3 (Service)** — 정식 배포·광고 도입은 별도 결정.

상세는 `docs/PHASE1-MVP.md`, `docs/PHASE2-BETA.md` 참조.

---

## 🛠️ 개발 메모

- TypeScript `strict: false` (MVP 속도 우선)
- 경로 alias: `@/*`
- 새 아티스트 추가: `config/artists.ts`의 `ARTISTS` 배열 한 줄 추가
- 카드 타입: `"twitter" | "youtube" | "news" | "community"`
