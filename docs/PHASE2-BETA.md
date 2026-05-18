# Phase 2 — Beta 계획

**목표:** 커뮤니티 소스 정상화 + 차단 UI + 멀티 아티스트  
**선행 조건:** Phase 1 커뮤니티 소스 문제 해결

---

## 우선순위별 작업 목록

### P0 — 커뮤니티 소스 정상화 (Phase 1에서 이월)

#### 옵션 A: Daum 카페 RSS (추천)
- 태민 팬카페: `https://cafe.daum.net/TAEMINFANCAFE/rss` (공개 카페만 가능)
- 인증 불필요, 즉시 적용 가능
- `app/api/community/route.ts`에 `fetchDaumCafe()` 추가

#### 옵션 B: 네이버 블로그 활성화
- `.env.local`에 `NAVER_CLIENT_ID` + `NAVER_CLIENT_SECRET` 추가
- 이미 구현 완료, env만 넣으면 됨
- 발급: https://developers.naver.com/apps

#### 옵션 C: 멜론 / 벅스 아티스트 피드
- 공개 RSS 여부 확인 필요

---

### P1 — 수동 차단 버튼 UI 개선

**현재:** 계정 차단 버튼이 있지만 `SourceFilter.tsx` 차단 목록 UI가 미완성

**작업:**
- [ ] `SourceFilter.tsx` — 차단된 계정 목록 표시 + 해제 버튼
- [ ] 커뮤니티 소스도 차단 가능하도록 (현재 비활성)
- [ ] 차단 버튼 누르면 즉시 피드에서 사라지는 UX

**관련 파일:**
- `components/SourceFilter.tsx`
- `contexts/FilterContext.tsx`
- `lib/sourceFilter.ts`

---

### P2 — 저가독성 필터 UI 연동

**현재:** `lib/readabilityFilter.ts` 구현 완료, `FeedCard.tsx`에 `collapsed` prop 있음  
**미작동:** `page.tsx`에서 `readabilityFilter` 호출 안 함

**작업:**
- [ ] `page.tsx`에서 `detectLowReadability(card)` 호출
- [ ] 접힌 카드 표시 (`collapsed={true}`) 연동
- [ ] 설정 UI에서 저가독성 필터 ON/OFF 토글

---

### P3 — 멀티 아티스트 지원

**현재:** `ArtistTabs.tsx`는 placeholder, `DEFAULT_ARTISTS`에 태민만 있음

**작업:**
- [ ] `ArtistTabs.tsx` 완성 — 수평 스크롤 아티스트 탭
- [ ] `lib/artists.ts`에 두 번째 아티스트 추가 (SHINee 전체 또는 다른 아티스트)
- [ ] 아티스트 전환 시 피드 캐시 관리 (`artistId` 기반)
- [ ] 아티스트별 설정 저장 (localStorage)

**아티스트 추가 방법:**
```typescript
// lib/artists.ts — DEFAULT_ARTISTS 배열에 추가
{
  id: "shinee",
  name: "샤이니",
  en: "SHINee",
  emoji: "💎",
  color: "#a78bfa",
  sources: {
    communitySearchTerms: ["샤이니", "SHINee"],
    youtubeChannelIds: ["UCyPwRgc3gQGqhk6RoGS50Ug"],
    newsKeywords: ["샤이니", "SHINee"],
    ...buildYoutubeSearchConfig({ name: "샤이니", en: "SHINee" }),
  }
}
```

---

### P4 — UX 개선

- [ ] 피드 로딩 스켈레톤 UI (현재: 빈 화면)
- [ ] 에러 상태 UI (소스별 실패 표시)
- [ ] 무한 스크롤 또는 "더 보기" 버튼
- [ ] 카드 공유 버튼 (Web Share API)
- [ ] PWA 설정 (`manifest.json`, service worker)

---

## 완료 기준

Phase 2 완료 = 다음 모두 충족:
1. 커뮤니티 탭에 실제 콘텐츠 표시
2. 차단 계정 목록 UI에서 관리 가능
3. 아티스트 2명 이상 전환 가능
