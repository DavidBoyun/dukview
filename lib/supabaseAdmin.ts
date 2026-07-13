// ─────────────────────────────────────────────────────
// 서버 전용 service role 클라이언트 (PR-10)
// /api/subscribe 계열 라우트 전용 — subscribers는 anon 정책 0이라 이 경로만 접근 가능.
// NEXT_PUBLIC_ 접두 금지: 이 키는 절대 클라이언트 번들에 실리면 안 된다.
// ─────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";

export function getAdminDb() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Supabase service role 환경변수 누락");
  return createClient(url, key, { auth: { persistSession: false } });
}
