// ─────────────────────────────────────────────────────
// 공용 유틸 — hashId / HTML 정리 / 시간 표시
// rssParser · news · community에 3벌로 흩어져 있던 구현 통합 (PR-1)
// ─────────────────────────────────────────────────────

/** 문자열 해시 → 카드 고유 ID. prefix로 소스 간 ID 충돌 방지 ("n"=news, "c"=community) */
export function hashId(str: string, prefix = ""): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return `${prefix}${Math.abs(hash).toString(36)}`;
}

export function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

/** CDATA·HTML 태그 제거 + 엔티티 디코드 + 공백 정리 */
export function stripTags(html: string): string {
  if (!html) return "";
  return decodeHtmlEntities(
    html.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<[^>]+>/g, " ")
  ).replace(/\s+/g, " ").trim();
}

/** 날짜 미상 마커 — 더쿠 등 날짜를 제공하지 않는 소스 */
export const UNKNOWN_DATE_ISO = "1970-01-01T00:00:00.000Z";

export function isUnknownDate(iso: string): boolean {
  return iso === UNKNOWN_DATE_ISO;
}

/** 상대 시간 표시 — 방금 전 / N분 전 / N시간 전 / N일 전 / 날짜 */
export function formatTimeAgo(iso: string): string {
  if (isUnknownDate(iso)) return "날짜 미상";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "날짜 미상";
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "방금 전";
  if (mins < 60) return `${mins}분 전`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}시간 전`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}일 전`;
  return d.toLocaleDateString("ko-KR");
}
