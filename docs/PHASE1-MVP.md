# Phase 1 — MVP 현재 상태

**대상 아티스트:** 태민(TAEMIN) 단독  
**상태:** 진행 중  
**최종 업데이트:** 2026-04-30

---

## 완료된 작업

### 기본 UI
- [x] 다크 테마 (`#0d0d1a` 배경, 퍼플 악센트)
- [x] 소스 탭 바 (전체 / X준비중 / 커뮤니티 / 영상 / 뉴스)
- [x] `FeedCard` 아웃링크 카드 (썸네일 + 제목 + 요약 + 원문 링크)
- [x] 가독성 낮은 카드 접힘(`collapsed`) 처리
- [x] 아티스트 헤더 (이름 + 새로고침 버튼 + 설정 버튼)
- [x] 광고 슬롯 placeholder (`AdSlot.tsx`)

### 피드 소스
- [x] YouTube 공식 채널 RSS fallback
- [x] YouTube Data API (`channels.list` + `playlistItems.list`) — quota 절약
- [x] YouTube 스크레이핑 검색 (ytInitialData, quota 0)
- [x] Google News RSS (언론사명 자동 추출)
- [x] 더쿠 스타 게시판 RSS (`fetchTheqoo`) — **구현 완료, 접근 차단 문제**
- [x] 네이버 블로그 API (`fetchNaverBlog`) — **구현 완료, env 필요**
- [x] X 탭 준비중 placeholder

### 필터링 / 상태
- [x] `FilterContext` (블랙리스트, localStorage)
- [x] `TagContext` (검색 태그)
- [x] `PremiumContext`
- [x] 계정 차단 버튼 (YouTube, Twitter 소스에만 표시)
- [x] 중복 제거 (link 해시 기반)
- [x] `publishedAt` 시간순 정렬

### 아키텍처
- [x] `lib/artists.ts` 중심 설정 구조 (새 아티스트 추가 용이)
- [x] YouTube quota 최적화 (search.list → channels.list)
- [x] 1시간 TTL 인메모리 캐시 (YouTube + 커뮤니티)
- [x] Nitter 완전 제거

---

## 현재 미작동 항목

| 기능 | 원인 | 우선순위 |
|------|------|----------|
| 더쿠 RSS | 로그인 필요 (서버사이드 차단) | 높음 |
| 네이버 블로그 | `NAVER_CLIENT_ID` env 없음 | 중간 |
| X 탭 | 준비중 placeholder | Phase 2 |
| `readabilityFilter.ts` | 구현됐으나 UI 미연동 | Phase 2 |

---

## 다음 즉시 해결 후보 (Phase 1.5)

1. **커뮤니티 소스 교체**: 더쿠 대신 Daum 카페 공개 RSS 또는 멜론 팬보드
2. **네이버 블로그 활성화**: `.env.local`에 Naver API 키 추가
3. **커뮤니티 API 로깅 개선**: 실패 시 `warnings[]`에 포함 (현재 silent fail)

---

## 핵심 파일

| 파일 | 역할 |
|------|------|
| `lib/artists.ts` | 아티스트 소스 설정 (여기만 수정하면 됨) |
| `app/api/feed/route.ts` | 소스 병렬 수집 오케스트레이터 |
| `app/api/community/route.ts` | 더쿠 + 네이버 블로그 |
| `app/api/youtube/route.ts` | YouTube Data API + 스크레이핑 |
| `app/page.tsx` | 탭 UI + 피드 렌더링 |
| `components/FeedCard.tsx` | 카드 컴포넌트 |
