"use client";
// ─────────────────────────────────────────────────────
// 상단 아티스트 탭 전환
// ─────────────────────────────────────────────────────

import { Artist } from "@/lib/types";

interface Props {
  artists: Artist[];
  activeId: string;
  onChange: (id: string) => void;
}

export default function ArtistTabs({ artists, activeId, onChange }: Props) {
  return (
    <div className="flex overflow-x-auto gap-2.5 px-3.5 pb-3" style={{ scrollbarWidth: "none" }}>
      {artists.map(a => {
        const active = a.id === activeId;
        return (
          <button
            key={a.id}
            onClick={() => onChange(a.id)}
            className="flex-shrink-0 flex flex-col items-center gap-1.5 bg-transparent border-none cursor-pointer py-0.5 px-1"
          >
            <div
              className="w-[50px] h-[50px] rounded-full flex items-center justify-center text-[22px] transition-all"
              style={{
                background: active ? a.color + "30" : "#1a1a2e",
                border: `2.5px solid ${active ? a.color : "#2a2a4a"}`,
                boxShadow: active ? `0 0 14px ${a.color}50` : "none",
              }}
            >
              {a.emoji}
            </div>
            <span
              className="text-[11px] whitespace-nowrap max-w-[60px] overflow-hidden text-ellipsis"
              style={{
                color: active ? a.color : "#64748b",
                fontWeight: active ? 800 : 400,
              }}
            >
              {a.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}
