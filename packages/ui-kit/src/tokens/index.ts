import { colors, ColorTokens } from "./colors";
import { radii, RadiusTokens } from "./radius";
import { typography, TypographyTokens } from "./typography";
import { spacing, SpacingTokens } from "./spacing";
import { elevation, ElevationTokens } from "./elevation";
import { shadows, ShadowTokens } from "./shadows";

export type NimbusTokenCollection = {
  colors: ColorTokens;
  radii: RadiusTokens;
  typography: TypographyTokens;
  spacing: SpacingTokens;
  elevation: ElevationTokens;
  shadows: ShadowTokens;
};

export const tokens: NimbusTokenCollection = {
  colors,
  radii,
  typography,
  spacing,
  elevation,
  shadows,
};

export { colors, radii, typography, spacing, elevation, shadows };
export type {
  ColorTokens,
  RadiusTokens,
  TypographyTokens,
  SpacingTokens,
  ElevationTokens,
  ShadowTokens,
};
