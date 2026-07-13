// GET /api/subscribe/confirm?token= — double opt-in 확정 (PR-10)

import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/supabaseAdmin";

function page(title: string, body: string, status = 200) {
  return new NextResponse(
    `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="font-family:sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;background:#f6f7fb">
<div style="text-align:center;padding:32px"><h2 style="margin:0 0 8px">${title}</h2><p style="color:#666">${body}</p></div>
</body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return page("잘못된 링크예요", "확인 메일의 링크를 다시 눌러 주세요.", 404);

  const db = getAdminDb();
  const { data, error } = await db
    .from("subscribers").select("id,status")
    .eq("confirm_token", token).eq("status", "pending").maybeSingle();
  if (error || !data) return page("잘못된 링크예요", "이미 처리됐거나 만료된 링크예요.", 404);

  const { error: upErr } = await db
    .from("subscribers")
    .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
    .eq("id", data.id);
  if (upErr) return page("잠시 후 다시 시도해 주세요", "처리 중 오류가 발생했어요.", 500);

  return page("구독이 확정됐어요", "내일 아침부터 덕뷰 브리핑이 도착해요.");
}
