// ─────────────────────────────────────────────────────
// 뉴스레터 sender — 매일 08:00 KST 최신 briefing 스냅샷 발송 (PR-10)
// 사용: npx tsx collector/newsletter.ts
// 가드: briefing 12h 초과 시 발송 전체 스킵 (수집 죽은 날 빈 메일 방지)
// 발송 실패는 경보 아님 — 마스킹 로그만, exit 0
// ─────────────────────────────────────────────────────

import { ARTISTS } from "../config/artists";
import { getDb } from "./db";
import { sendEmail, maskEmail } from "../lib/email";
import { mapCardRow } from "../lib/mapCardRow";
import { HeroBriefing, TldrLine } from "../lib/briefing/types";
import { Artist, FeedCard } from "../lib/types";

const STATUS_LABEL: Record<HeroBriefing["status"], string> = {
  confirmed: "🟢 확정 · 공식 확인",
  likely: "🟡 추정 · 공식 발표 전",
  reaction: "🟣 반응 · 팬커뮤니티 중심",
};
const TLDR_LABEL: Record<TldrLine["kind"], string> = {
  official: "🚨 공식", trending: "📰 화제", fandom: "💬 팬덤",
};
const MAX_BRIEFING_AGE_MS = 12 * 3600 * 1000;

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function ddayLabel(dateStr: string): string {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr); target.setHours(0, 0, 0, 0);
  const diff = Math.ceil((target.getTime() - today.getTime()) / 86400000);
  return diff === 0 ? "D-DAY" : diff > 0 ? `D-${diff}` : `D+${Math.abs(diff)}`;
}

function renderHtml(
  artist: Artist, hero: HeroBriefing, tldr: TldrLine[],
  topCards: FeedCard[], siteUrl: string, unsubToken: string,
): string {
  const diversity = [
    hero.diversity.news > 0 ? `뉴스 ${hero.diversity.news}` : "",
    hero.diversity.fandom > 0 ? `팬덤 ${hero.diversity.fandom}` : "",
    hero.diversity.official > 0 ? `공식 ${hero.diversity.official}` : "",
  ].filter(Boolean).join(" · ");

  const tldrRows = tldr.map(line =>
    `<tr><td style="padding:4px 8px 4px 0;white-space:nowrap;color:#888;font-size:12px">${TLDR_LABEL[line.kind]}</td>
     <td style="padding:4px 0;font-size:13px;color:#222">${esc(line.text)}</td></tr>`
  ).join("");

  const cardRows = topCards.map(c =>
    `<li style="margin:6px 0;font-size:13px;line-height:1.5">
       <a href="${c.link}" style="color:#5b4bd5;text-decoration:none;font-weight:600">${esc(c.title)}</a>
       <span style="color:#999"> — ${esc(c.sourceName)}</span></li>`
  ).join("");

  const events = (artist.upcomingEvents ?? []).map(ev =>
    `<li style="margin:4px 0;font-size:13px"><b>${ddayLabel(ev.date)}</b> ${esc(ev.title)} <span style="color:#999">(${ev.date})</span></li>`
  ).join("");

  return `
  <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#fff">
    <div style="font-size:11px;font-weight:bold;letter-spacing:2px;color:#999">DUKVIEW BRIEFING</div>
    <h2 style="margin:4px 0 16px">오늘의 ${esc(artist.name)}</h2>

    <div style="border:2px solid #e4e0fb;border-radius:12px;padding:16px;margin-bottom:16px">
      <div style="font-size:11px;font-weight:bold;margin-bottom:6px">${STATUS_LABEL[hero.status]}
        ${hero.cardCount > 0 ? `<span style="color:#888;font-weight:normal"> · 관련 ${hero.cardCount}건${diversity ? ` · ${diversity}` : ""}</span>` : ""}</div>
      <div style="font-size:16px;font-weight:800;line-height:1.4">${esc(hero.headline)}</div>
      <div style="margin-top:6px;font-size:12px;color:#666">${esc(hero.whyImportant)}</div>
    </div>

    <div style="font-size:13px;font-weight:bold;margin-bottom:4px">📌 오늘 3줄 요약</div>
    <table style="border-collapse:collapse;margin-bottom:16px">${tldrRows}</table>

    ${topCards.length > 0 ? `<div style="font-size:13px;font-weight:bold;margin-bottom:4px">오늘의 카드</div>
    <ul style="margin:0 0 16px;padding-left:18px">${cardRows}</ul>` : ""}

    ${events ? `<div style="font-size:13px;font-weight:bold;margin-bottom:4px">다가오는 일정</div>
    <ul style="margin:0 0 16px;padding-left:18px">${events}</ul>` : ""}

    <div style="border-top:1px solid #eee;padding-top:12px;font-size:11px;color:#999">
      덕뷰는 외부 플랫폼의 공개 정보를 집계해요. 콘텐츠 저작권은 원저작자에게 있어요.<br/>
      <a href="${siteUrl}/api/subscribe/unsubscribe?token=${unsubToken}" style="color:#999">구독 해지</a>
    </div>
  </div>`;
}

async function main() {
  const db = getDb();
  const siteUrl = process.env.SITE_URL || "http://localhost:3000";

  for (const artist of ARTISTS) {
    const { data: rows, error } = await db
      .from("briefings").select("*")
      .eq("artist_id", artist.id)
      .order("built_at", { ascending: false }).limit(1);
    if (error || !rows?.length) {
      console.error(`[${artist.id}] briefing 조회 실패/없음 — 발송 스킵`);
      continue;
    }
    const briefing = rows[0];
    const age = Date.now() - new Date(briefing.built_at).getTime();
    if (age > MAX_BRIEFING_AGE_MS) {
      console.error(`[${artist.id}] briefing이 ${Math.round(age / 3600000)}h 전 — 발송 전체 스킵 (수집 상태 확인 필요)`);
      continue;
    }

    const hero: HeroBriefing = briefing.hero;
    const tldr: TldrLine[] = briefing.tldr;

    let topCards: FeedCard[] = [];
    if (hero.topCardIds.length > 0) {
      const { data: cardRows } = await db.from("cards").select("*").in("id", hero.topCardIds.map(Number));
      const byId = new Map((cardRows ?? []).map(r => [String(r.id), mapCardRow(r)]));
      topCards = hero.topCardIds.map(id => byId.get(id)).filter(Boolean) as FeedCard[];
    }

    const { data: subs, error: subErr } = await db
      .from("subscribers").select("id,email,confirm_token")
      .eq("artist_id", artist.id).eq("status", "confirmed");
    if (subErr) { console.error(`[${artist.id}] 구독자 조회 실패: ${subErr.message}`); continue; }
    if (!subs?.length) { console.log(`[${artist.id}] confirmed 구독자 0 — 발송 없음`); continue; }

    const subject = `[덕뷰] 오늘의 ${artist.name} — ${hero.headline.slice(0, 40)}`;
    let sent = 0;
    for (const sub of subs) {
      try {
        await sendEmail(sub.email, subject, renderHtml(artist, hero, tldr, topCards, siteUrl, sub.confirm_token));
        await db.from("subscribers").update({ last_sent_at: new Date().toISOString() }).eq("id", sub.id);
        sent += 1;
      } catch (e: any) {
        console.error(`[${artist.id}] 발송 실패 (${maskEmail(sub.email)}): ${e?.message ?? e}`);
      }
    }
    console.log(`[${artist.id}] 발송 완료: ${sent}/${subs.length}`);
  }

  process.exit(0);
}

main().catch(e => {
  console.error("newsletter 치명 오류:", e?.message ?? e);
  process.exit(0); // 발송 실패는 경보 아님 (지시서 4-4)
});
