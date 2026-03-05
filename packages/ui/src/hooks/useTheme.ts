import { useState, useEffect, useCallback } from 'react';

type ThemeMode = 'system' | 'light' | 'dark';

const THEME_KEY = 'ui.appearance.theme';

function applyTheme(theme: ThemeMode) {
  if (typeof document === 'undefined') {
    return;
  }
  const root = document.documentElement;
  let actualTheme = theme;
  if (theme === 'system') {
    actualTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  if (actualTheme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  root.dataset.theme = theme;
}

export function useTheme() {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const initialTheme = loadThemePreference();
    applyTheme(initialTheme);
    return initialTheme;
  });

  useEffect(() => {
    applyTheme(theme);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(THEME_KEY, theme);
    }
  }, [theme]);

  const toggleTheme = useCallback((mode?: ThemeMode) => {
    setTheme(prevTheme => {
      if (mode) {
        return mode;
      }
      if (prevTheme === 'dark') {
        return 'light';
      } else {
        return 'dark';
      }
    });
  }, []);

  return { theme, toggleTheme };
}

function loadThemePreference(): ThemeMode {
  if (typeof window === 'undefined') {
    return 'dark'; // Default to dark on server
  }
  const value = window.localStorage.getItem(THEME_KEY);
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'dark';
}
