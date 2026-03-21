export const colors = {
  background: '#f4efe6',
  surface: '#fffaf2',
  textPrimary: '#1f1300',
  textSecondary: '#5b4c3a',
  accent: '#c96b28',
} as const;

export const spacing = {
  sm: 8,
  md: 16,
  lg: 24,
} as const;

export type AppThemeTokens = {
  colors: typeof colors;
  spacing: typeof spacing;
};
