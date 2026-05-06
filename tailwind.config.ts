/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Semantic palette backed by CSS variables in globals.css
        tv: {
          bg: "var(--tv-bg)",
          bg2: "var(--tv-bg2)",
          surface: "var(--tv-surface)",
          surfaceSoft: "var(--tv-surface-soft)",
          border: "var(--tv-border)",
          borderStrong: "var(--tv-border-strong)",
          glow: "var(--tv-glow)",
          accent: "var(--tv-accent)",
          accentSoft: "var(--tv-accent-soft)",
          accentStrong: "var(--tv-accent-strong)",
          text: "var(--tv-text)",
          textMuted: "var(--tv-text-muted)",
          success: "var(--tv-success)",
          warning: "var(--tv-warning)",
          danger: "var(--tv-danger)",
        },
        // Direct brand hues if you ever want them
        truvern: {
          blue: "var(--truvern-blue)",
          emerald: "var(--truvern-emerald)",
          accent: "var(--truvern-accent)",
        },
      },
      fontFamily: {
        sans: [
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "Roboto",
          "sans-serif",
        ],
      },
      boxShadow: {
        // “beautiful” glass shadows
        "tv-soft": "0 18px 45px rgba(2,6,23,0.65)",
        "tv-card":
          "0 0 0 1px rgba(255,255,255,0.06), 0 18px 60px rgba(0,0,0,0.55)",
        "tv-glow":
          "0 0 0 1px rgba(255,255,255,0.08), 0 0 24px rgba(56,189,248,0.12), 0 18px 60px rgba(0,0,0,0.60)",
        "tv-ring": "0 0 0 1px rgba(148,163,184,0.35)",
      },
      borderRadius: {
        "tv-card": "1.25rem",
        "tv-card-lg": "1.75rem",
        "tv-pill": "999px",
      },
      spacing: {
        "tv-gutter": "1.25rem", // 20px – consistent horizontal padding
      },
      backdropBlur: {
        tv: "14px",
      },
      backgroundImage: {
        // app background used everywhere (matches screenshot vibe)
        "tv-app":
          "radial-gradient(1200px 700px at attaching var(--tv-spot-x, 25%) var(--tv-spot-y, 15%), rgba(56,189,248,0.12), transparent 55%), radial-gradient(900px 600px at 75% 0%, rgba(16,185,129,0.10), transparent 60%), radial-gradient(700px 500px at 10% 85%, rgba(99,102,241,0.10), transparent 60%), linear-gradient(180deg, rgba(2,6,23,1) 0%, rgba(1,10,28,1) 55%, rgba(2,6,23,1) 100%)",
        // subtle top glow line for headers/panels
        "tv-halo":
          "radial-gradient(600px 120px at 50% 0%, rgba(56,189,248,0.18), transparent 70%)",
      },
      keyframes: {
        "tv-float": {
          "0%,100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-2px)" },
        },
        "tv-pop": {
          "0%": { transform: "translateY(2px) scale(0.98)", opacity: "0" },
          "100%": { transform: "translateY(0px) scale(1)", opacity: "1" },
        },
      },
      animation: {
        "tv-float": "tv-float 6s ease-in-out infinite",
        "tv-pop": "tv-pop 140ms ease-out",
      },
    },
  },
  plugins: [],
};
