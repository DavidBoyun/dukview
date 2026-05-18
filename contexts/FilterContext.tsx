"use client";
// ─────────────────────────────────────────────────────
// FilterContext — 차단(블랙리스트) 전역 상태
// TagContext와 분리 (검색 태그와 차단이 꼬이지 않게)
// ─────────────────────────────────────────────────────

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { SourceFilter, FeedCard } from "@/lib/types";
import { DEFAULT_BLACKLIST, addToBlacklist, removeFromBlacklist } from "@/lib/sourceFilter";

interface FilterContextValue {
  filter: SourceFilter;
  blockSource: (card: FeedCard) => void;
  unblockSource: (source: "twitter" | "youtube" | "news", id: string) => void;
  resetFilter: () => void;
}

const FilterContext = createContext<FilterContextValue | null>(null);

const STORAGE_KEY = "dukview_filter";

export function FilterProvider({ children }: { children: ReactNode }) {
  const [filter, setFilter] = useState<SourceFilter>(DEFAULT_BLACKLIST);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const userFilter: SourceFilter = JSON.parse(saved);
        // 하드코딩 블랙리스트 + 유저 추가 블랙리스트 병합
        setFilter({
          blockedTwitterIds: [
            ...new Set([...DEFAULT_BLACKLIST.blockedTwitterIds, ...userFilter.blockedTwitterIds]),
          ],
          blockedYoutubeIds: [
            ...new Set([...DEFAULT_BLACKLIST.blockedYoutubeIds, ...userFilter.blockedYoutubeIds]),
          ],
          blockedDomains: [
            ...new Set([...DEFAULT_BLACKLIST.blockedDomains, ...userFilter.blockedDomains]),
          ],
        });
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      // 유저가 추가한 것만 저장 (기본 블랙리스트 제외)
      const userFilter: SourceFilter = {
        blockedTwitterIds: filter.blockedTwitterIds.filter(
          id => !DEFAULT_BLACKLIST.blockedTwitterIds.includes(id)
        ),
        blockedYoutubeIds: filter.blockedYoutubeIds.filter(
          id => !DEFAULT_BLACKLIST.blockedYoutubeIds.includes(id)
        ),
        blockedDomains: filter.blockedDomains.filter(
          d => !DEFAULT_BLACKLIST.blockedDomains.includes(d)
        ),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userFilter));
    } catch {}
  }, [filter]);

  function blockSource(card: FeedCard) {
    setFilter(prev => addToBlacklist(prev, card));
  }

  function unblockSource(source: "twitter" | "youtube" | "news", id: string) {
    setFilter(prev => removeFromBlacklist(prev, source, id));
  }

  function resetFilter() {
    setFilter(DEFAULT_BLACKLIST);
  }

  return (
    <FilterContext.Provider value={{ filter, blockSource, unblockSource, resetFilter }}>
      {children}
    </FilterContext.Provider>
  );
}

export function useFilterContext() {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error("useFilterContext must be used within FilterProvider");
  return ctx;
}
