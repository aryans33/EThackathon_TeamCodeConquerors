import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: 'class',
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
        surface: {
          0: 'var(--bg-page)',
          1: 'var(--bg-card)',
          2: 'var(--bg-hover)',
        },
        border: {
          DEFAULT: 'var(--border)',
        },
        content: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
        },
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
