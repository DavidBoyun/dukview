"use client";
// ─────────────────────────────────────────────────────
// PremiumContext — isPremium 변수 (3단계 광고 제어)
// 1단계엔 기본 false, 나중에 결제 연동 가능
// ─────────────────────────────────────────────────────

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface PremiumContextValue {
  isPremium: boolean;
  setPremium: (val: boolean) => void;
}

const PremiumContext = createContext<PremiumContextValue | null>(null);

const STORAGE_KEY = "dukview_premium";

export function PremiumProvider({ children }: { children: ReactNode }) {
  const [isPremium, setIsPremium] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "true") setIsPremium(true);
    } catch {}
  }, []);

  function setPremium(val: boolean) {
    setIsPremium(val);
    try {
      localStorage.setItem(STORAGE_KEY, String(val));
    } catch {}
  }

  return (
    <PremiumContext.Provider value={{ isPremium, setPremium }}>
      {children}
    </PremiumContext.Provider>
  );
}

export function usePremium() {
  const ctx = useContext(PremiumContext);
  if (!ctx) throw new Error("usePremium must be used within PremiumProvider");
  return ctx;
}
