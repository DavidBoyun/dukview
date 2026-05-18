"use client";
// ─────────────────────────────────────────────────────
// 차단된 소스 관리 UI
// ─────────────────────────────────────────────────────

import { useFilterContext } from "@/contexts/FilterContext";
import { DEFAULT_BLACKLIST } from "@/lib/sourceFilter";

export default function SourceFilterPanel() {
  const { filter, unblockSource } = useFilterContext();

  const userBlockedTwitter = filter.blockedTwitterIds.filter(
    id => !DEFAULT_BLACKLIST.blockedTwitterIds.includes(id)
  );
  const userBlockedYoutube = filter.blockedYoutubeIds.filter(
    id => !DEFAULT_BLACKLIST.blockedYoutubeIds.includes(id)
  );
  const userBlockedNews = filter.blockedDomains.filter(
    d => !DEFAULT_BLACKLIST.blockedDomains.includes(d)
  );

  const totalUser = userBlockedTwitter.length + userBlockedYoutube.length + userBlockedNews.length;
  const totalDefault =
    DEFAULT_BLACKLIST.blockedTwitterIds.length +
    DEFAULT_BLACKLIST.blockedYoutubeIds.length +
    DEFAULT_BLACKLIST.blockedDomains.length;

  return (
    <div className="space-y-3">
      {/* 시스템 기본 */}
      <div className="bg-slate-900/50 border border-slate-700/40 rounded-xl p-3">
        <div className="text-xs font-bold text-slate-300 mb-1">🛡️ 시스템 기본 차단</div>
        <div className="text-[10px] text-slate-500">
          덕뷰에서 렉카·찌라시·악성 계정 {totalDefault}개를 기본 차단하고 있어요
        </div>
      </div>

      {/* 내가 차단한 것 */}
      <div className="bg-slate-900/50 border border-slate-700/40 rounded-xl p-3">
        <div className="text-xs font-bold text-slate-300 mb-2">
          🚫 내가 차단한 계정 ({totalUser})
        </div>

        {totalUser === 0 && (
          <div className="text-[11px] text-slate-500 py-2">
            아직 차단한 계정이 없어요.<br />
            피드에서 "이 계정 차단"을 눌러 추가할 수 있어요.
          </div>
        )}

        {userBlockedTwitter.length > 0 && (
          <div className="mb-2">
            <div className="text-[10px] text-slate-500 mb-1.5">🐦 트위터</div>
            <div className="flex flex-wrap gap-1.5">
              {userBlockedTwitter.map(id => (
                <span key={id} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-400 text-[11px] font-semibold">
                  @{id}
                  <button onClick={() => unblockSource("twitter", id)} className="text-sky-400 hover:text-red-400">×</button>
                </span>
              ))}
            </div>
          </div>
        )}

        {userBlockedYoutube.length > 0 && (
          <div className="mb-2">
            <div className="text-[10px] text-slate-500 mb-1.5">▶️ 유튜브 채널</div>
            <div className="flex flex-wrap gap-1.5">
              {userBlockedYoutube.map(id => (
                <span key={id} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-[11px] font-semibold">
                  {id.slice(0, 12)}...
                  <button onClick={() => unblockSource("youtube", id)} className="hover:text-red-300">×</button>
                </span>
              ))}
            </div>
          </div>
        )}

        {userBlockedNews.length > 0 && (
          <div>
            <div className="text-[10px] text-slate-500 mb-1.5">📰 뉴스 도메인</div>
            <div className="flex flex-wrap gap-1.5">
              {userBlockedNews.map(d => (
                <span key={d} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-green-500/15 border border-green-500/30 text-green-400 text-[11px] font-semibold">
                  {d}
                  <button onClick={() => unblockSource("news", d)} className="hover:text-red-400">×</button>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
