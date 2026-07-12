// ─────────────────────────────────────────────────────
// 프론트 읽기 전용 Supabase 클라이언트 — 공개(publishable) 키 사용
// 쓰기는 collector/db.ts (secret key, Actions 러너 전용)만 수행
// ─────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";

export function getPublicDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase 공개 키 환경변수 누락");
  return createClient(url, key, { auth: { persistSession: false } });
}
