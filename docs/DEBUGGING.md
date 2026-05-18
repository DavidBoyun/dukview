# Dukview — 알려진 이슈 & 디버깅 가이드

---

## 현재 알려진 이슈

### [BUG-001] 커뮤니티 탭 — 더쿠 RSS 차단

**증상:** 커뮤니티 탭에 카드가 전혀 안 뜸  
**원인:** `https://theqoo.net/star?act=rss` — 스타 게시판은 로그인 필수, 서버사이드 fetch 차단  
**영향:** 커뮤니티 소스 완전 무력화  

**해결책 옵션:**
```
1. Daum 카페 공개 RSS 사용 (즉시 가능)
2. 네이버 블로그 API 활성화 (.env.local에 Naver 키 추가)
3. 더쿠 세션 쿠키를 env에 보관 (유지보수 부담 큼)
```

**임시 확인 방법:**
```bash
# .env.local에 추가
NAVER_CLIENT_ID=your_id
NAVER_CLIENT_SECRET=your_secret
# → 네이버 블로그만이라도 카드가 뜸
```

---

### [BUG-002] 커뮤니티 탭 — 네이버 블로그 비활성

**증상:** 네이버 블로그 결과가 안 뜸  
**원인:** `NAVER_CLIENT_ID` / `NAVER_CLIENT_SECRET` 환경변수 없음  
**해결:** `.env.local`에 추가 후 서버 재시작  

**발급:** https://developers.naver.com/apps → "검색" API 선택

---

### [BUG-003] YouTube 스크레이핑 — ytInitialData 구조 변경

**증상:** YouTube 검색 탭에 결과가 안 뜨거나 갑자기 줄어듦  
**원인:** YouTube가 `ytInitialData` JSON 구조를 가끔 변경  
**확인:**
```bash
curl "https://www.youtube.com/results?search_query=태민+직캠&sp=..." | grep -o 'ytInitialData.*' | head -c 500
```
**해결:** `app/api/youtube/route.ts`의 스크레이핑 파서 경로 업데이트

---

## 디버깅 방법

### API 직접 테스트
```bash
# 커뮤니티 API
curl "http://localhost:3000/api/community?terms=태민,TAEMIN&artistId=taemin"

# 피드 전체 (warnings 확인)
curl "http://localhost:3000/api/feed?artistId=taemin" | jq '{cardCount: (.cards|length), warnings}'

# YouTube 채널 API
curl "http://localhost:3000/api/youtube?channelIds=UCa2YkG6KvkGXJd5UmvZbXGw"

# YouTube 검색
curl "http://localhost:3000/api/youtube?query=태민+직캠&order=date"
```

### 더쿠 RSS 접근성 확인
```bash
curl -I "https://theqoo.net/star?act=rss"
# 200 OK → 접근 가능 (로그인 상태에서만)
# 302 → 로그인 페이지 리다이렉트 → 차단 확인
```

### 캐시 초기화
- YouTube/커뮤니티 캐시는 **인메모리** Map → 서버 재시작하면 자동 초기화
- `npm run dev` 재시작 = 캐시 flush

---

## 환경변수 체크리스트

```bash
# .env.local 필수 아님 (없어도 RSS fallback으로 동작)
TUBE_API_KEY=            # YouTube Data API v3 키
YOUTUBE_DATA_API_ENABLED=true

# 커뮤니티 소스 활성화
NAVER_CLIENT_ID=         # 네이버 검색 API
NAVER_CLIENT_SECRET=
```

---

## rssParser.ts 파싱 규칙

| RSS 형식 | 항목 위치 | 비고 |
|----------|-----------|------|
| RSS 2.0 | `rss.channel.item[]` | 더쿠, Google News |
| Atom | `feed.entry[]` | YouTube |
| content:encoded | `item.encoded` (removeNSPrefix) | WordPress 계열 |

`fast-xml-parser` 옵션: `removeNSPrefix: true` → `content:encoded` → `encoded`  
더쿠 XE CMS가 `content:encoded` 사용 시 `item.description`이 비어 있을 수 있음.
