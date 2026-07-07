// ─────────────────────────────────────────────────────
// 덕뷰 수집기 엔트리 — GitHub Actions에서 주기 실행
// 사용: npx tsx collector/index.ts [--sources=news,community,youtube]
//
// 종료 코드: 0 = 정상, 1 = 경보 (직전 24h ok였던 소스가 empty/error)
//   → Actions 실패로 표면화되어 GitHub 알림 메일 발송 (조용한 실패 방지)
// ─────────────────────────────────────────────────────

import { ARTISTS } from "../config/artists";
import { getDb, syncArtists, upsertCards, recordRun, hadRecentSuccess } from "./db";
import { collectNews } from "./sources/news";
import { collectCommunity } from "./sources/community";
import { collectYoutube } from "./sources/youtube";
import { FeedCard, Artist } from "../lib/types";

type SourceName = "news" | "community" | "youtube";

const COLLECTORS: Partial<Record<SourceName, (artist: Artist) => Promise<FeedCard[]>>> = {
  news: collectNews,
  community: collectCommunity,
  youtube: collectYoutube,
};

async function main() {
  const arg = process.argv.find(a => a.startsWith("--sources="));
  const requested = (arg ? arg.split("=")[1].split(",") : Object.keys(COLLECTORS)) as SourceName[];
  const sources = requested.filter(s => COLLECTORS[s]);

  const db = getDb();
  await syncArtists(db, ARTISTS);

  let alert = false;

  for (const artist of ARTISTS) {
    for (const source of sources) {
      const startedAt = new Date().toISOString();
      try {
        const cards = await COLLECTORS[source]!(artist);
        const newCount = await upsertCards(db, cards);
        const status = cards.length === 0 ? "empty" : "ok";
        await recordRun(db, {
          artistId: artist.id, source, status,
          itemCount: cards.length, newCount, startedAt,
        });
        console.log(`[${artist.id}/${source}] ${status}: ${cards.length}건 (신규 ${newCount})`);

        if (status === "empty" && (await hadRecentSuccess(db, artist.id, source))) {
          console.error(`[경보] ${artist.id}/${source}: 24h 내 정상이었으나 이번 수집 0건`);
          alert = true;
        }
      } catch (e: any) {
        await recordRun(db, {
          artistId: artist.id, source, status: "error",
          itemCount: 0, newCount: 0, error: String(e?.message ?? e), startedAt,
        });
        console.error(`[${artist.id}/${source}] error: ${e?.message ?? e}`);
        if (await hadRecentSuccess(db, artist.id, source)) alert = true;
      }
    }
  }

  process.exit(alert ? 1 : 0);
}

main().catch(e => {
  console.error("collector 치명 오류:", e);
  process.exit(1);
});
