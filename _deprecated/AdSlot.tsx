"use client";
// ─────────────────────────────────────────────────────
// 광고 슬롯 — 3단계에서 Google AdSense 등 연동
// isPremium === true 시 자동 숨김
// ─────────────────────────────────────────────────────

import { usePremium } from "@/contexts/PremiumContext";

interface Props {
  slotId?: string;
  height?: number;
}

export default function AdSlot({ slotId = "default", height = 90 }: Props) {
  const { isPremium } = usePremium();

  // 프리미엄 유저는 광고 안 보임
  if (isPremium) return null;

  return (
    <div
      className="mx-3 my-3 rounded-xl border border-dashed border-slate-700/40 bg-slate-900/30 flex items-center justify-center text-slate-600 text-xs"
      style={{ height }}
      data-ad-slot={slotId}
    >
      {/* 3단계에서 여기에 AdSense 광고 스크립트 */}
      <span>📢 광고 영역 (개발 중)</span>
    </div>
  );
}
