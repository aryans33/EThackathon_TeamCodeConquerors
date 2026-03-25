import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        brand: {
          bg: "var(--brand-bg)",
          surface: "var(--brand-surface)",
          card: "var(--brand-card)",
          border: "var(--brand-border)",
          green: "var(--brand-green)",
          red: "var(--brand-red)",
          amber: "var(--brand-amber)",
          text: "var(--brand-text)",
          muted: "var(--brand-muted)"
        }
      },
    },
  },
  plugins: [],
};
export default config;
