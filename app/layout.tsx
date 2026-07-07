import type { Metadata } from "next";
import "./globals.css";
import { FilterProvider } from "@/contexts/FilterContext";

export const metadata: Metadata = {
  title: "덕뷰 · Dukview",
  description: "파편화된 덕질 정보 통합 · 정병/렉카 원천 차단",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </head>
      <body className="light-theme bg-[#0d0d1a] text-slate-100 font-['Noto_Sans_KR']">
        <FilterProvider>
          {children}
        </FilterProvider>
      </body>
    </html>
  );
}
