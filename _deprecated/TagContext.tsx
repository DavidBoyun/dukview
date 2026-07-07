"use client";
// ─────────────────────────────────────────────────────
// TagContext — 검색/강조 태그 전역 상태
// FilterContext와 분리 (태그와 필터가 꼬이지 않게)
// ─────────────────────────────────────────────────────

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { TagState } from "@/lib/types";

interface TagContextValue {
  tagsByArtist: Record<string, TagState>;
  getTagState: (artistId: string) => TagState;
  updateTagState: (artistId: string, patch: Partial<TagState>) => void;
}

const TagContext = createContext<TagContextValue | null>(null);

const defaultTagState: TagState = {
  hashtags: [],
  keywords: [],
  trendingTags: [],
};

const STORAGE_KEY = "dukview_tags";

export function TagProvider({ children }: { children: ReactNode }) {
  const [tagsByArtist, setTagsByArtist] = useState<Record<string, TagState>>({});

  // LocalStorage 복구
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setTagsByArtist(JSON.parse(saved));
    } catch {}
  }, []);

  // LocalStorage 저장
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tagsByArtist));
    } catch {}
  }, [tagsByArtist]);

  function getTagState(artistId: string): TagState {
    return tagsByArtist[artistId] || defaultTagState;
  }

  function updateTagState(artistId: string, patch: Partial<TagState>) {
    setTagsByArtist(prev => ({
      ...prev,
      [artistId]: { ...defaultTagState, ...prev[artistId], ...patch },
    }));
  }

  return (
    <TagContext.Provider value={{ tagsByArtist, getTagState, updateTagState }}>
      {children}
    </TagContext.Provider>
  );
}

export function useTagContext() {
  const ctx = useContext(TagContext);
  if (!ctx) throw new Error("useTagContext must be used within TagProvider");
  return ctx;
}
