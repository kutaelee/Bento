export const colors = {
  primitive: {
    blue: {
      400: "#60a5fa",
      500: "#137fec",
      600: "#2563eb",
    },
    gray: {
      50: "#f8f9fb",
      100: "#f3f4f6",
      200: "#e5e7eb",
      300: "#d1d5db",
      400: "#9ca3af",
      500: "#6b7280",
      600: "#4b5563",
      700: "#374151",
      800: "#1f2937",
      900: "#111827",
    },
    slate: {
      800: "#1e2936",
      900: "#101922"
    },
    white: "#ffffff",
    black: "#000000",
    green: { 500: "#10b981" },
    amber: { 500: "#f59e0b" },
    rose: { 500: "#f43f5e" }
  },
  semantic: {
    surface: {
      primary: { light: "#ffffff", dark: "#1e2936" },
      secondary: { light: "#f8f9fb", dark: "#101922" },
      tertiary: { light: "#f3f4f6", dark: "#1f2937" }
    },
    text: {
      primary: { light: "#111827", dark: "#f9fafb" },
      secondary: { light: "#6b7280", dark: "#9ca3af" },
      disabled: { light: "#9ca3af", dark: "#4b5563" }
    },
    border: {
      default: { light: "#e5e7eb", dark: "#374151" },
      subtle: { light: "#f3f4f6", dark: "#1f2937" },
      strong: { light: "#d1d5db", dark: "#4b5563" }
    },
    accent: {
      default: { light: "#137fec", dark: "#137fec" },
      hover: { light: "#2563eb", dark: "#60a5fa" },
      pressed: { light: "#1d4ed8", dark: "#3b82f6" }
    },
    status: {
      success: { light: "#10b981", dark: "#10b981" },
      warning: { light: "#f59e0b", dark: "#f59e0b" },
      danger: { light: "#f43f5e", dark: "#f43f5e" },
      info: { light: "#137fec", dark: "#137fec" }
    }
  }
};

export type ColorTokens = typeof colors;
