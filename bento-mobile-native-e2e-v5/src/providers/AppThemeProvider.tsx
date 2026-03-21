import React, { createContext, useContext, type PropsWithChildren } from 'react';

import { colors, spacing, type AppThemeTokens } from '../theme/tokens';

const themeTokens: AppThemeTokens = {
  colors,
  spacing,
};

const AppThemeContext = createContext<AppThemeTokens | null>(null);

export function AppThemeProvider({ children }: PropsWithChildren) {
  return <AppThemeContext.Provider value={themeTokens}>{children}</AppThemeContext.Provider>;
}

export function useAppTheme(): AppThemeTokens {
  const theme = useContext(AppThemeContext);
  if (!theme) {
    throw new Error('useAppTheme must be used within AppThemeProvider');
  }
  return theme;
}
