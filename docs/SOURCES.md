# Dukview — 데이터 소스 상세

## 1. 커뮤니티 (`source: "community"`)

### 더쿠 스타 게시판 RSS

| 항목 | 내용 |
|------|------|
| URL | `https://theqoo.net/star?act=rss` |
| 방식 | XE CMS 표준 RSS 2.0 |
| 인증 | **로그인 필요** (서버사이드 fetch 차단) |
| 현재 상태 | ❌ 작동 안 함 |
| 대안 | 아래 "커뮤니티 소스 개선 방안" 참고 |

**구현 위치:** `app/api/community/route.ts` → `fetchTheqoo()`

### 네이버 블로그 검색 API

| 항목 | 내용 |
|------|------|
| URL | `https://openapi.naver.com/v1/search/blog.json` |
| 인증 | `NAVER_CLIENT_ID` + `NAVER_CLIENT_SECRET` 헤더 |
| 쿼터 | 25,000 calls/day |
| 현재 상태 | ✅ 구현 완료 (env 없으면 skip) |
| 검색어 | `artist.sources.communitySearchTerms[0]` 첫 번째만 사용 |

**발급:** https://developers.naver.com/apps → 검색 API 신청

### 커뮤니티 소스 개선 방안 (다음 작업 후보)

1. **더쿠 대체**: 멜론 차트/팬카페 공개 RSS, 디시인사이드 마이너 갤러리 RSS
2. **네이버 카페 API**: 공개 카페 게시글 검색 (네이버 개발자 센터)
3. **아티스트별 팬카페 RSS**: Daum 카페 공개 RSS (`https://cafe.daum.net/{id}/rss`)
4. **더쿠 쿠키 인증**: `.env.local`에 세션 쿠키 보관 (유지보수 부담)

---

## 2. YouTube (`source: "youtube"`)

### 공식 채널 (youtubeCategory: "official")

| 조건 | 방식 |
|------|------|
| `YOUTUBE_DATA_API_ENABLED=true` + API 키 있음 | `channels.list` + `playlistItems.list` |
| API 키 없음 | YouTube Atom RSS fallback |

**RSS URL:** `https://www.youtube.com/feeds/videos.xml?channel_id={channelId}`

**Data API 경로:**
- `channels.list?part=contentDetails,snippet&id={ids}` — 1 unit (배치)
- `playlistItems.list?part=snippet&playlistId={uploadId}&maxResults=15` — 1 unit/채널

**공유 채널 (SMTOWN 등):** 아티스트 키워드 필터링 적용 (`matchesArtist()`)

### 검색 (youtubeCategory: "search")

| 항목 | 내용 |
|------|------|
| 방식 | ytInitialData 스크레이핑 |
| Quota | 0 (API 미사용) |
| 검색어 | `artist.sources.youtubeSearchQueries` + 사용자 커스텀 키워드 |
| 제외 키워드 | `artist.sources.youtubeSearchExcludeKeywords` |

**공유 채널 ID (SHARED_YOUTUBE_CHANNELS):**
- `UCEf_Bc-KVd7onSeifS3py9g` — SMTOWN
- `UCLkAepWjdylmXSltofFvsYQ` — HYBE
- `UCIHstIcyaD8tJBkfMkJFMOg` — JYP
- `UCJ1wC5yRahIM0ycKjYpZgTA` — YG

---

## 3. 뉴스 (`source: "news"`)

| 항목 | 내용 |
|------|------|
| 소스 | Google News RSS |
| URL | `https://news.google.com/rss/search?q={keyword}&hl=ko&gl=KR&ceid=KR:ko` |
| 인증 | 불필요 |
| 현재 상태 | ✅ 정상 작동 |

- 제목 파싱: `"기사 제목 - 언론사명"` → 언론사명 추출 + 제목 정리
- 차단 단위: 언론사명 (`sourceId = realSource`)
- 키워드 필터링: `matchesArtist()` (동명이인 기사 제거)

---

## 4. X (Twitter) (`source: "twitter"`)

| 현재 상태 | 준비중 (`comingSoon: true`) |
|------|------|
| 구현 | placeholder UI만 |
| 이전 구현 | Nitter RSS (불안정 → 완전 제거) |
| 다음 계획 | Phase 2 이후 Twitter API v2 또는 대안 검토 |

---

## 아티스트 소스 설정 (lib/artists.ts)

```typescript
{
  id: "taemin",
  sources: {
    twitterHandles: [],          // 준비중
    communitySearchTerms: [      // 더쿠/네이버 검색어
      "태민", "TAEMIN", "SHINee 태민"
    ],
    youtubeChannelIds: [         // 공식 채널
      "UCa2YkG6KvkGXJd5UmvZbXGw",  // 태민
      "UCyPwRgc3gQGqhk6RoGS50Ug",  // SHINee
    ],
    youtubeSearchQueries: [...], // 자동 생성 (buildYoutubeSearchConfig)
    newsKeywords: ["태민", "TAEMIN", "SHINee 태민"],
  }
}
```

새 아티스트 추가 시 `DEFAULT_ARTISTS` 배열에 항목만 추가하면 자동 동작.
