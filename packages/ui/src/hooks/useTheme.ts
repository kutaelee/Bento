import { useState, useEffect, useCallback } from "react";

export type ThemeMode = "system" | "light" | "dark";

const THEME_KEY = "ui.appearance.theme";
export const THEME_CHANGE_EVENT = "bento:theme-change";

export function applyTheme(theme: ThemeMode) {
  if (typeof document === "undefined") {
    return;
  }
  const root = document.documentElement;
  let actualTheme = theme;
  if (theme === "system") {
    actualTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  if (actualTheme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
  root.dataset.theme = theme;
}

const persistTheme = (theme: ThemeMode) => {
  applyTheme(theme);
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(THEME_KEY, theme);
  window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: theme }));
};

export function useTheme() {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const initialTheme = loadThemePreference();
    applyTheme(initialTheme);
    return initialTheme;
  });

  useEffect(() => {
    persistTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const handleSync = () => {
      setTheme(loadThemePreference());
    };
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleMediaChange = () => {
      if (loadThemePreference() === "system") {
        applyTheme("system");
      }
    };

    window.addEventListener(THEME_CHANGE_EVENT, handleSync);
    window.addEventListener("storage", handleSync);
    media.addEventListener("change", handleMediaChange);

    return () => {
      window.removeEventListener(THEME_CHANGE_EVENT, handleSync);
      window.removeEventListener("storage", handleSync);
      media.removeEventListener("change", handleMediaChange);
    };
  }, []);

  const toggleTheme = useCallback((mode?: ThemeMode) => {
    setTheme((prevTheme) => {
      if (mode) {
        return mode;
      }
      return prevTheme === "dark" ? "light" : "dark";
    });
  }, []);

  return { theme, toggleTheme };
}

function loadThemePreference(): ThemeMode {
  if (typeof window === "undefined") {
    return "dark";
  }
  const value = window.localStorage.getItem(THEME_KEY);
  return value === "light" || value === "dark" || value === "system" ? value : "dark";
}
