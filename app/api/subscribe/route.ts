// ─────────────────────────────────────────────────────
// POST /api/subscribe — 뉴스레터 구독 신청 (PR-10)
// 페이즈 A 이후 유일한 웹 쓰기 경로. double opt-in.
// 가드: honeypot + 이메일 검증 + 10분 재발송 제한. 응답은 상태 무관 동일
// (이메일 존재 여부 비노출). 전면 rate limit은 페이즈 C.
// ─────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getAdminDb } from "@/lib/supabaseAdmin";
import { sendEmail, maskEmail } from "@/lib/email";

const OK_RESPONSE = { ok: true, message: "확인 메일을 보냈어요. 메일함을 확인해 주세요." };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_COOLDOWN_MS = 10 * 60 * 1000;

function confirmMailHtml(confirmUrl: string): string {
  return `
  <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
    <h2 style="margin:0 0 12px">덕뷰 브리핑 구독 확인</h2>
    <p style="color:#444;line-height:1.6">아래 버튼을 누르면 구독이 확정돼요.<br/>본인이 신청한 게 아니라면 이 메일은 무시하셔도 됩니다.</p>
    <a href="${confirmUrl}" style="display:inline-block;margin:16px 0;padding:12px 20px;background:#7c6cf0;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold">구독 확정하기</a>
    <p style="color:#999;font-size:12px">버튼이 안 되면 링크를 복사해 주소창에 붙여넣어 주세요:<br/>${confirmUrl}</p>
  </div>`;
}

export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "잘못된 요청이에요" }, { status: 400 }); }

  // honeypot: 사람에게 안 보이는 필드가 채워져 있으면 봇 — 조용히 성공 응답
  if (typeof body.website === "string" && body.website.length > 0) {
    return NextResponse.json(OK_RESPONSE);
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "이메일 형식을 확인해 주세요" }, { status: 400 });
  }

  const db = getAdminDb();
  const { data: existing, error: selErr } = await db
    .from("subscribers").select("id,status,confirm_token,confirm_sent_at")
    .eq("email", email).maybeSingle();
  if (selErr) {
    console.error(`subscribe 조회 실패 (${maskEmail(email)}): ${selErr.message}`);
    return NextResponse.json({ error: "잠시 후 다시 시도해 주세요" }, { status: 500 });
  }

  // confirmed는 재발송 없이 동일 응답 (존재 여부 비노출)
  if (existing?.status === "confirmed") return NextResponse.json(OK_RESPONSE);

  // pending 10분 이내 재요청 → 발송 스킵 (메일 폭탄 방지)
  if (
    existing?.status === "pending" &&
    existing.confirm_sent_at &&
    Date.now() - new Date(existing.confirm_sent_at).getTime() < RESEND_COOLDOWN_MS
  ) {
    console.log(`subscribe 재발송 스킵 — 10분 가드 (${maskEmail(email)})`);
    return NextResponse.json(OK_RESPONSE);
  }

  const token = randomUUID();
  const now = new Date().toISOString();
  const { error: upErr } = existing
    ? await db.from("subscribers")
        .update({ status: "pending", confirm_token: token, confirm_sent_at: now })
        .eq("id", existing.id)
    : await db.from("subscribers")
        .insert({ email, status: "pending", confirm_token: token, confirm_sent_at: now });
  if (upErr) {
    console.error(`subscribe 저장 실패 (${maskEmail(email)}): ${upErr.message}`);
    return NextResponse.json({ error: "잠시 후 다시 시도해 주세요" }, { status: 500 });
  }

  const siteUrl = process.env.SITE_URL || "http://localhost:3000";
  try {
    await sendEmail(email, "덕뷰 브리핑 구독 확인", confirmMailHtml(`${siteUrl}/api/subscribe/confirm?token=${token}`));
  } catch (e: any) {
    console.error(`확인 메일 발송 실패 (${maskEmail(email)}): ${e?.message ?? e}`);
    return NextResponse.json({ error: "메일 발송에 실패했어요. 잠시 후 다시 시도해 주세요" }, { status: 500 });
  }

  return NextResponse.json(OK_RESPONSE);
}
