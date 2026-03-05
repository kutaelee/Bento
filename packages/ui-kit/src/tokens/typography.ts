export const typography = {
  fontFamily: {
    display: ["Inter", "Noto Sans KR", "sans-serif"],
  },
  size: {
    display: "36px",
    h1: "24px",
    h2: "20px",
    h3: "18px",
    base: "16px",
    sm: "14px",
    xs: "12px",
  },
  lineHeight: {
    normal: "1.5",
    tight: "1.2",
  },
  fontWeight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    black: 900,
  },
};

export type TypographyTokens = typeof typography;
