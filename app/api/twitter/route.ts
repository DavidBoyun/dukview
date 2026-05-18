import { NextRequest, NextResponse } from "next/server";
import { parseRSS, nitterUserUrl, nitterSearchUrl } from "@/lib/rssParser";

// ─────────────────────────────────────────────────────
// /api/twitter — Nitter RSS 프록시
// GET ?username=xxx&artistId=xxx          → 유저 타임라인
// GET ?hashtag=xxx&artistId=xxx           → 해시태그 검색
// ─────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const username = searchParams.get("username");
  const hashtag = searchParams.get("hashtag");
  const artistId = searchParams.get("artistId") || "unknown";

  const instance = process.env.NITTER_INSTANCE || "https://nitter.net";
  const url = username
    ? nitterUserUrl(instance, username)
    : hashtag
    ? nitterSearchUrl(instance, `#${hashtag}`)
    : null;

  if (!url) {
    return NextResponse.json({ error: "username 또는 hashtag가 필요해요" }, { status: 400 });
  }

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Dukview/1.0)" },
      next: { revalidate: 180 },
    });
    if (!res.ok) throw new Error(`Nitter 응답 실패 (${res.status})`);

    const xml = await res.text();
    const sourceId = username || `#${hashtag}`;
    const sourceName = username ? `@${username}` : `#${hashtag}`;

    const cards = parseRSS(xml, "twitter", sourceId, sourceName, artistId);
    return NextResponse.json({ cards });
  } catch (e: any) {
    return NextResponse.json(
      {
        error: `Nitter 서버 연결 실패 — 인스턴스를 변경해보세요 (${e.message})`,
        cards: [],
      },
      { status: 500 }
    );
  }
}
