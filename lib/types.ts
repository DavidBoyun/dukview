// ─────────────────────────────────────────────────────
// 공용 타입 정의
// ─────────────────────────────────────────────────────

export type SourceType = "twitter" | "youtube" | "news" | "community";
export type YoutubeCategory = "official" | "search";
export type YoutubeSearchOrder = "date" | "relevance";
export type ArtistCategory = "idol" | "trot" | "solo" | "group" | "actor";

/** 아웃링크 카드 — [제목 + 요약 + 원문 링크] 구조 */
export interface FeedCard {
  id: string;                    // 고유 ID (링크 해시)
  source: SourceType;
  youtubeCategory?: YoutubeCategory;
  youtubeSearchRank?: number;
  communityProvider?: "dcinside" | "naver" | "theqoo";
  sourceId: string;              // X ID, 유튜브 채널 ID, 뉴스 도메인
  sourceName: string;            // 표시용 이름 (@username, 채널명 등)
  title: string;
  summary: string;               // 요약 (200자 내외)
  link: string;                  // 원문 링크 (아웃링크)
  publishedAt: string;           // ISO 문자열
  thumbnail?: string;            // 썸네일 URL
  artistId: string;              // 어떤 아티스트 피드인지
  isOfficial?: boolean;          // 공식 계정 카드 여부
  stats?: {
    views?: number;
    comments?: number;
    likes?: number;
  };
}

/** 다가오는 일정 — 컴백/콘서트/팬미팅/방송/예매 */
export type UpcomingEventKind =
  | "comeback"
  | "concert"
  | "fanmeeting"
  | "broadcast"
  | "release"
  | "ticket"
  | "other";

export interface UpcomingEvent {
  id: string;
  title: string;       // "샤이니 컴백 쇼케이스", "월드투어 서울 2회차" 등
  date: string;        // YYYY-MM-DD 또는 YYYY-MM-DDTHH:mm
  kind: UpcomingEventKind;
  link?: string;       // 예매/공지 링크 (옵션)
  action?: string;     // 버튼 텍스트 e.g. "예매 페이지", "공지 확인"
  note?: string;       // 짧은 부연 (장소, 채널 등)
}

/** 아티스트 정보 */
export interface Artist {
  id: string;
  category?: ArtistCategory;
  name: string;
  en: string;
  groupName?: string;
  fandomName?: string;
  emoji: string;
  color: string;
  profileImageQuery?: string;
  colors?: {
    primary: string;   // 메인 강조색
    secondary: string; // 보조색
    accent?: string;   // 보조 강조색
    background?: string;
  };
  comeback?: {
    title: string;     // 앨범/타이틀명
    date: string;      // YYYY-MM-DD
  };
  upcomingEvents?: UpcomingEvent[]; // 컴백/콘서트/팬미팅/예매 D-day 위젯용
  officialLinks?: Array<{
    id: string;
    label: string;
    url: string;
    type: "youtube" | "instagram" | "x" | "homepage" | "fanclub" | "ticket" | "other";
    note?: string;
  }>;
  aliases?: string[];            // 검색 별칭
  sources: {
    twitterHandles?: string[];        // (준비중) Nitter RSS 소스
    communitySearchTerms?: string[];  // Naver Blog API 검색어 (첫 번째 term만 사용)
    sharedBoardFilterTerms?: string[]; // 공유 게시판(핫게·케이돌토크·그룹 갤러리) 제목 필터 키워드
    communityBoards?: string[];        // 아티스트 전용 커뮤니티 게시판 URL (DC Inside 솔로 갤 등, 필터 없음)
    communitySharedBoards?: string[];  // 아티스트 입장에서 그룹/공유 게시판 URL — sharedBoardFilterTerms로 제목 필터
    youtubeChannelIds?: string[];// YouTube RSS 채널 ID
    youtubeSharedChannelIds?: string[]; // 아티스트 입장에서 필터가 필요한 YouTube 채널 ID (그룹 공식 등) — matchKeywords로 제목/요약 필터
    youtubeSearchQueries?: string[]; // YouTube Data API 검색어
    youtubeSearchMatchKeywords?: string[]; // YouTube 검색 결과 포함 키워드
    youtubeSearchExcludeKeywords?: string[]; // YouTube 검색 결과 제외 키워드
    youtubeChannelNames?: Record<string, string>;
    newsKeywords?: string[];     // 뉴스 검색 키워드
    newsContextKeywords?: string[];
    newsExcludeKeywords?: string[];
    /** 네이버 블로그·더쿠 검색 설정 — collector가 사용. 하드코딩 금지, config 주입 (PR-4) */
    communityNaver?: {
      blogQueries: string[];     // 네이버 블로그 검색어
      webQueries: string[];      // 더쿠 링크 검색어 (site:theqoo.net ...)
      primaryTerms: string[];    // 본문에 반드시 포함될 아티스트 지칭어
      includeGroups: string[][]; // OR그룹의 AND — 하나의 그룹이 전부 매칭되면 통과
      contextTerms: string[];    // primaryTerm + 음악 컨텍스트 매칭용
      excludeTerms: string[];    // 동명이인·노이즈 제외
    };
    /** DC 갤러리 id → 표시명 (기존 boardNameFromUrl 하드코딩 대체) */
    boardNames?: Record<string, string>;
  };
}

/** 소스 필터 (블랙리스트) */
export interface SourceFilter {
  blockedTwitterIds: string[];   // 차단된 X 계정
  blockedYoutubeIds: string[];   // 차단된 유튜브 채널
  blockedDomains: string[];      // 차단된 뉴스 도메인
}

/** 검색 태그 (필터와 분리!) */
export interface TagState {
  hashtags: string[];            // 해시태그
  keywords: string[];            // 강조 키워드
  trendingTags: string[];        // 총공 태그
}
