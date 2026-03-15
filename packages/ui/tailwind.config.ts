import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#137fec",
        "background-light": "#f6f7f8",
        "background-dark": "#101922",
        "surface-dark": "#18232e",
        "surface-dark-hover": "#233648",
        "border-dark": "#233648",
        "text-secondary": "#92adc9",
      },
      fontFamily: {
        display: ["Inter", "Noto Sans KR", "sans-serif"],
      },
      boxShadow: {
        shell: "0 22px 48px rgba(15, 23, 42, 0.12)",
      },
      borderRadius: {
        xl2: "1rem",
      },
    },
  },
  plugins: [],
};

export default config;
