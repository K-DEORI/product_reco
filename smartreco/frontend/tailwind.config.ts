import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "warm-beige": { DEFAULT: "#FDFBFA", deep: "#F9F5F2", card: "#FFFFFF" },
        "accent-terracotta": { DEFAULT: "#FFB7B2", dark: "#FF9AA2", soft: "#FFF0F0" },
        ink: { DEFAULT: "#3D3A38", muted: "#8C8884" },
        sage: "#B2C4B2",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        script: ["var(--font-script)", "cursive"],
      },
      borderRadius: { "4xl": "2rem" },
      boxShadow: {
        soft: "0 1px 2px rgba(61,58,55,0.04), 0 8px 24px -12px rgba(61,58,55,0.12)",
        lift: "0 2px 4px rgba(61,58,55,0.05), 0 18px 36px -16px rgba(61,58,55,0.22)",
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
