import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "warm-beige": { DEFAULT: "#F9F6F0", deep: "#F3ECE2", card: "#FFFDF9" },
        "accent-terracotta": { DEFAULT: "#C87A61", dark: "#B4664E", soft: "#F4DDD3" },
        ink: { DEFAULT: "#2A2825", muted: "#6E6A66" },
        sage: "#7E8F6A",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        script: ["var(--font-script)", "cursive"],
      },
      borderRadius: { "4xl": "2rem" },
      boxShadow: {
        soft: "0 1px 2px rgba(42,40,37,0.04), 0 8px 24px -12px rgba(42,40,37,0.12)",
        lift: "0 2px 4px rgba(42,40,37,0.05), 0 18px 36px -16px rgba(42,40,37,0.22)",
      },
      keyframes: {
        shimmer: { "0%": { backgroundPosition: "200% 0" }, "100%": { backgroundPosition: "-200% 0" } },
        "drawer-in": { from: { transform: "translateX(-100%)" }, to: { transform: "translateX(0)" } },
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
      },
      animation: {
        shimmer: "shimmer 2.2s linear infinite",
        "drawer-in": "drawer-in 260ms cubic-bezier(0.22,1,0.36,1)",
        "fade-in": "fade-in 200ms ease-out",
      },
    },
  },
  plugins: [],
};
export default config;
