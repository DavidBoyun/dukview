import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./contexts/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        dukview: {
          bg: "#0d0d1a",
          card: "#1a1a2e",
          border: "#2a2a4a",
          purple: "#7c3aed",
        },
      },
    },
  },
  plugins: [],
};

export default config;
