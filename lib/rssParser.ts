// ─────────────────────────────────────────────────────
// RSS 파싱 유틸리티
// fast-xml-parser 기반 — Nitter, YouTube, 뉴스 RSS 지원
// ─────────────────────────────────────────────────────

import { XMLParser } from "fast-xml-parser";
import { FeedCard, SourceType } from "./types";
import { hashId, stripTags } from "./shared";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  parseAttributeValue: true,
  removeNSPrefix: true,
});

// 첫 이미지 추출
function extractFirstImage(html: string): string | undefined {
  const match = html?.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match?.[1];
}

/**
 * RSS XML 파싱 → FeedCard 배열
 * @param xml XML 문자열
 * @param source 소스 타입 (twitter/youtube/news)
 * @param sourceId 소스 고유 ID (X ID, 채널 ID 등)
 * @param sourceName 표시 이름
 * @param artistId 아티스트 ID
 */
export function parseRSS(
  xml: string,
  source: SourceType,
  sourceId: string,
  sourceName: string,
  artistId: string,
): FeedCard[] {
  try {
    const parsed = parser.parse(xml);

    // RSS 2.0 (rss.channel.item) / Atom (feed.entry) 둘 다 대응
    let items: any[] = [];
    if (parsed?.rss?.channel?.item) {
      items = Array.isArray(parsed.rss.channel.item)
        ? parsed.rss.channel.item
        : [parsed.rss.channel.item];
    } else if (parsed?.feed?.entry) {
      items = Array.isArray(parsed.feed.entry) ? parsed.feed.entry : [parsed.feed.entry];
    }

    return items.slice(0, 20).map((item: any): FeedCard => {
      // RSS 2.0 필드
      const rssTitle = item.title?.["#text"] ?? item.title ?? "";
      const rssLink = item.link?.["#text"] ?? item.link?.["@_href"] ?? item.link ?? "";
      const rssDesc = item.description?.["#text"] ?? item.description ?? "";
      const rssPub = item.pubDate ?? item.published ?? item.updated ?? new Date().toISOString();

      // Atom 필드 (유튜브)
      const atomTitle = item.title?.["#text"] ?? item.title;
      const atomLink = Array.isArray(item.link)
        ? item.link[0]?.["@_href"]
        : item.link?.["@_href"];
      const atomContent = item.content?.["#text"] ?? item["media:group"]?.["media:description"] ?? "";

      const title = stripTags(String(atomTitle || rssTitle || ""));
      const link = String(atomLink || rssLink || "");
      const rawDesc = String(atomContent || rssDesc || "");
      const summary = stripTags(rawDesc).slice(0, 200);
      const publishedAt = new Date(rssPub).toISOString();

      // 썸네일 추출 (유튜브는 media:thumbnail, 일반은 img 태그)
      let thumbnail: string | undefined;
      if (item["media:group"]?.["media:thumbnail"]?.["@_url"]) {
        thumbnail = item["media:group"]["media:thumbnail"]["@_url"];
      } else if (item["media:thumbnail"]?.["@_url"]) {
        thumbnail = item["media:thumbnail"]["@_url"];
      } else {
        thumbnail = extractFirstImage(rawDesc);
      }

      return {
        id: hashId(link),
        source,
        sourceId,
        sourceName,
        title: title || "(제목 없음)",
        summary,
        link,
        publishedAt,
        thumbnail,
        artistId,
      };
    });
  } catch (e) {
    console.error("RSS 파싱 실패:", e);
    return [];
  }
}

/** Nitter RSS URL 생성 — X 계정 */
export function nitterUserUrl(instance: string, username: string): string {
  return `${instance.replace(/\/$/, "")}/${encodeURIComponent(username)}/rss`;
}

/** Nitter RSS URL 생성 — 해시태그/키워드 검색 */
export function nitterSearchUrl(instance: string, query: string): string {
  return `${instance.replace(/\/$/, "")}/search/rss?f=tweets&q=${encodeURIComponent(query)}`;
}

/** YouTube 채널 RSS URL */
export function youtubeChannelUrl(channelId: string): string {
  return `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
}

/** Google News RSS (한국어) */
export function googleNewsUrl(query: string): string {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ko&gl=KR&ceid=KR:ko`;
}
