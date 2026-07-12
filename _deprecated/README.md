# _deprecated — 격리된 미사용 코드 (PR-1·PR-5, 2026-07-07)

삭제 대신 격리 (파일 삭제 금지 원칙). tsconfig `exclude` 처리되어 빌드/타입체크에서 제외됨.

| 파일 | 원위치 | 격리 사유 | 복귀 시점 |
|------|--------|-----------|-----------|
| AdSlot.tsx | components/ | placeholder, 실광고 없음 | 페이즈 C (애드센스 장착 시 재작성) |
| ArtistTabs.tsx | components/ | page.tsx 미연결 | 페이즈 D (멀티 아티스트 UI) |
| PremiumContext.tsx | contexts/ | isPremium 항상 false, 호출처 0 | 유료 티어 결정 시 |
| TagContext.tsx | contexts/ | useTagContext 호출처 0 | 관심사 태그(P2) 착수 시 |
| api-twitter-route.ts | app/api/twitter/route.ts | Nitter 폐기 후 호출처 0 | X 소스 재개 시 |
| api-feed-route-legacy.ts | app/api/feed/route.ts | PR-5: 실시간 self-fetch 오케스트레이터 → DB SELECT-only 라우트로 교체 | 복귀 없음 (참조용) |
| api-news-route.ts | app/api/news/route.ts | PR-5: 수집이 collector/sources/news.ts로 이관, 라우트 호출처 0 | 복귀 없음 (참조용) |
| api-community-route.ts | app/api/community/route.ts | PR-5: 수집이 collector/sources/community.ts로 이관, 라우트 호출처 0 | 복귀 없음 (참조용) |
| api-youtube-route.ts | app/api/youtube/route.ts | PR-5: 수집이 collector/sources/youtube.ts로 이관, 라우트 호출처 0 | 복귀 없음 (참조용) |
