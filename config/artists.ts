import { Artist } from "@/lib/types";

// 글로벌 공유 채널 (소속사 통합 채널) — 모든 아티스트에게 제목 필터 적용
export const SHARED_YOUTUBE_CHANNELS = [
  "UCEf_Bc-KVd7onSeifS3py9g",  // SMTOWN
  "UCLkAepWjdylmXSltofFvsYQ",  // HYBE (BANGTANTV)
  "UCIHstIcyaD8tJBkfMkJFMOg",  // JYP
  "UCJ1wC5yRahIM0ycKjYpZgTA",  // YG
];

function uniqueClean(values: Array<string | undefined>) {
  return Array.from(
    new Set(values.map(value => value?.trim()).filter(Boolean) as string[])
  );
}

// 커뮤니티(네이버 블로그·더쿠) 검색 설정 빌더 — 아티스트별 하드코딩 방지
const COMMON_COMMUNITY_EXCLUDES = [
  "bj", "아프리카tv", "롤", "리그오브레전드", "league of legends", "lol",
  "발로란트", "브롤스타즈", "pubg", "free fire",
];
const BASE_MUSIC_CONTEXT = [
  "가수", "아이돌", "솔로", "무대", "콘서트", "팬미팅",
  "앨범", "뮤직비디오", "직캠", "팬캠", "fancam",
];

function buildCommunityNaverConfig(params: {
  name: string;             // 한글 활동명 ("태민")
  en: string;               // 영문명 ("TAEMIN")
  groupKo?: string;         // 그룹 한글명 ("샤이니")
  groupEn?: string;         // 그룹 영문명 ("SHINee")
  extraContextTerms?: string[]; // 곡명 등 아티스트 고유 컨텍스트
  excludeTerms?: string[];      // 동명이인 등
}) {
  const { name, en, groupKo, groupEn } = params;
  const lowerEn = en.toLowerCase();
  const lowerGroupEn = groupEn?.toLowerCase();

  return {
    blogQueries: uniqueClean([
      `가수 ${name}`,
      ...(groupKo ? [`${groupKo} ${name}`] : []),
    ]),
    webQueries: uniqueClean([
      `site:theqoo.net ${name}`,
      ...(groupKo ? [`site:theqoo.net ${groupKo} ${name}`] : []),
      `site:theqoo.net ${en.toUpperCase()}`,
    ]),
    primaryTerms: uniqueClean([name, lowerEn]),
    includeGroups: [
      ["가수", name],
      ...(groupKo ? [[groupKo, name]] : []),
      ...(lowerGroupEn ? [[lowerGroupEn, lowerEn]] : []),
      ...(lowerGroupEn ? [[lowerGroupEn, name]] : []),
      ...(groupKo ? [[lowerEn, groupKo]] : []),
    ],
    contextTerms: uniqueClean([
      ...(groupKo ? [groupKo] : []),
      ...(lowerGroupEn ? [lowerGroupEn] : []),
      ...BASE_MUSIC_CONTEXT,
      ...(params.extraContextTerms || []),
    ]),
    excludeTerms: uniqueClean([
      ...(params.excludeTerms || []),
      ...COMMON_COMMUNITY_EXCLUDES,
    ]),
  };
}

function buildYoutubeSearchConfig(params: {
  name: string;
  en: string;
  groupName?: string;
  aliases?: string[];
  extraQueries?: string[];
  excludeKeywords?: string[];
}) {
  const artistTerms = uniqueClean([
    params.name,
    params.en,
    params.en.toLowerCase(),
    params.en.toUpperCase(),
    params.groupName,
    params.groupName?.toLowerCase(),
    ...(params.groupName ? [`${params.groupName} ${params.name}`] : []),
    ...(params.groupName ? [`${params.groupName} ${params.en}`] : []),
  ]);

  const youtubeSearchQueries = uniqueClean([
    `${params.name} 직캠`,
    `${params.name} 팬캠`,
    `${params.en} fancam`,
    `${params.en} focus`,
    `${params.en} focus cam`,
    ...(params.groupName ? [`${params.groupName} ${params.name} 직캠`] : []),
    ...(params.groupName ? [`${params.groupName} ${params.name} 팬캠`] : []),
    ...(params.groupName ? [`${params.groupName} ${params.en} fancam`] : []),
    ...(params.groupName ? [`${params.groupName} ${params.en} focus`] : []),
    ...(params.extraQueries || []),
  ]);

  return {
    youtubeSearchQueries,
    youtubeSearchMatchKeywords: uniqueClean([
      ...artistTerms,
      ...(params.aliases || []),
    ]),
    youtubeSearchExcludeKeywords: Array.from(new Set(params.excludeKeywords || [])),
  };
}

export const ARTISTS: Artist[] = [
  {
    id: "taemin",
    category: "idol",
    name: "태민",
    en: "TAEMIN",
    groupName: "SHINee",
    fandomName: "SHINee WORLD",
    emoji: "🐣",
    color: "#0fcde7",
    profileImageQuery: "태민 가수",
    colors: {
      primary: "#A8DAFF",
      secondary: "#FFFFFF",
      accent: "#8B5CF6",
      background: "#0d0d1a",
    },
    // comeback: { title: "앨범명", date: "2026-06-01" },
    // 다가오는 일정 — 공식 발표 시 실제 값으로 교체. 빈 배열로 두면 위젯 자동 숨김.
    // 아래 2건은 데모용 예상치 (Codex 사본에서 1차 cherry-pick).
    upcomingEvents: [
      {
        id: "shinee-fanmeet-2026",
        title: "SHINee 팬미팅 (예상)",
        date: "2026-07-15",
        kind: "fanmeeting",
        note: "공식 발표 대기 — 실제 일정 발표 시 교체",
      },
      {
        id: "taemin-album-2026",
        title: "태민 정규 4집 컴백 (예상)",
        date: "2026-09-01",
        kind: "comeback",
        note: "공식 채널 모니터링 중",
      },
    ],
    aliases: ["머민", "태밍", "탬인", "테민"],
    officialLinks: [
      {
        id: "shinee-official",
        label: "SHINee",
        url: "https://www.youtube.com/@SHINee",
        type: "youtube",
        note: "그룹 샤이니 공식 채널",
      },
      {
        id: "taemin-official",
        label: "태민 (TAEMIN)",
        url: "https://www.youtube.com/@taemin_xoalsox",
        type: "youtube",
        note: "태민 공식 유튜브 채널",
      },
    ],
    sources: {
      twitterHandles: [],
      communityBoards: [
        "https://gall.dcinside.com/mgallery/board/lists/?id=taemin",
      ],
      // 그룹 갤러리 — 멤버 전체 글이 올라오므로 제목에 본인 키워드가 있는 글만 통과
      communitySharedBoards: [
        "https://gall.dcinside.com/mgallery/board/lists/?id=shinee",
      ],
      sharedBoardFilterTerms: [
        "태민", "샤이니",
        "Taemin", "Shinee",
        "테민", "탬",
      ],
      communitySearchTerms: [
        "태민",
        "TAEMIN",
        "SHINee 태민",
      ],
      communityNaver: buildCommunityNaverConfig({
        name: "태민",
        en: "TAEMIN",
        groupKo: "샤이니",
        groupEn: "SHINee",
        extraContextTerms: ["move", "guilty", "괴도", "길티"],
        excludeTerms: ["유태민", "태민98", "담임", "담임목사", "목사", "교회", "목양"],
      }),
      boardNames: {
        taemin: "디씨 태민갤",
        shinee: "디씨 샤이니갤",
      },
      youtubeChannelIds: [
        "UCa2YkG6KvkGXJd5UmvZbXGw",
      ],
      // 그룹 공식 채널 — 본인 영상만 통과 (제목/요약에 matchKeywords 필요)
      youtubeSharedChannelIds: [
        "UCyPwRgc3gQGqhk6RoGS50Ug",
      ],
      youtubeChannelNames: {
        UCa2YkG6KvkGXJd5UmvZbXGw: "태민 (TAEMIN)",
        UCyPwRgc3gQGqhk6RoGS50Ug: "SHINee",
      },
      ...buildYoutubeSearchConfig({
        name: "태민",
        en: "TAEMIN",
        groupName: "SHINee",
        aliases: ["머민", "태밍", "탬인", "테민"],
        extraQueries: ["샤이니 태민", "テミン", "泰民"],
        excludeKeywords: [
          "유태민",
          "태민98",
          "담임목사",
          "목양교회",
          "cover",
          "dance cover",
          "reaction",
          "lyrics",
          "karaoke",
          "tutorial",
          "challenge",
          "아프리카tv",
          "bj",
          "league of legends",
          "lol",
          "발로란트",
          "브롤스타즈",
          "free fire",
          "pubg",
        ],
      }),
      newsKeywords: [
        "가수 태민",
        "SHINee 태민",
        "샤이니 태민",
      ],
      newsContextKeywords: [
        "샤이니",
        "shinee",
        "가수",
        "솔로",
        "아이돌",
        "무대",
        "콘서트",
        "앨범",
        "코첼라",
        "coachella",
        "k팝",
        "k-pop",
        "케이팝",
        "taemin",
      ],
      newsExcludeKeywords: [
        "이채민",
        "유태민",
        "태민98",
        "담임",
        "담임목사",
        "목사",
        "교회",
        "bj",
        "아프리카tv",
        "리그오브레전드",
        "league of legends",
        "lol",
        "발로란트",
        "브롤스타즈",
      ],
    },
  },
];

export const DEFAULT_ARTIST_ID = "taemin";
export const DEFAULT_ARTISTS = ARTISTS;

export function getArtistConfig(artistId = DEFAULT_ARTIST_ID): Artist | undefined {
  return ARTISTS.find(artist => artist.id === artistId);
}
