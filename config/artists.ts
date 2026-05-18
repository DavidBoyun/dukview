import { Artist } from "@/lib/types";

function uniqueClean(values: Array<string | undefined>) {
  return Array.from(
    new Set(values.map(value => value?.trim()).filter(Boolean) as string[])
  );
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
