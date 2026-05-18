"use client";

interface Props {
  memo: string;
  url: string;
  error?: string;
  onMemoChange: (value: string) => void;
  onUrlChange: (value: string) => void;
  onSubmit: () => void;
  compact?: boolean;
}

export default function XSignalComposer({
  memo,
  url,
  error,
  onMemoChange,
  onUrlChange,
  onSubmit,
  compact = false,
}: Props) {
  return (
    <div className={`rounded-xl border border-sky-500/20 bg-sky-500/8 ${compact ? "p-3" : "p-4"}`}>
      <div className="mb-3 flex items-start gap-3">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-sky-300/15 text-sm font-black text-sky-200">
          X
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-black text-slate-100">실시간 신호 추가</div>
          <div className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
            계정 주소가 아니라, 중요한 X 게시물 링크와 한 줄 메모를 넣어두면 대시보드가 먼저 보여줘요.
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <input
          value={memo}
          onChange={e => onMemoChange(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && url.trim()) { e.preventDefault(); onSubmit(); } }}
          placeholder="왜 봐야 해? 예: 팬미팅 떡밥, 공항 목격담, 공지 반응"
          className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
        />
        <div className="flex gap-2">
          <input
            value={url}
            onChange={e => onUrlChange(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); onSubmit(); } }}
            placeholder="https://x.com/계정/status/..."
            className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
          />
          <button
            onClick={onSubmit}
            className="rounded-xl bg-sky-300 px-3 py-2 text-sm font-black text-slate-950 transition-colors hover:bg-sky-200"
          >
            추가
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-2 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-[11px] text-red-300">
          {error}
        </div>
      )}

      <div className="mt-2 text-[10px] text-slate-600">
        자동 X 수집 전까지는 중요한 게시물만 골라 넣는 큐레이션 모드예요.
      </div>
    </div>
  );
}
