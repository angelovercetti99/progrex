import { Text as RNText, StyleSheet, type TextProps as RNTextProps } from 'react-native';

import { fontFamilyFor, type FontFace } from './fonts';
import { DISPLAY_VARIANTS, typography, type ColorName, type TypographyVariant } from './theme';
import { useTheme } from './useTheme';

type TextProps = RNTextProps & {
  variant?: TypographyVariant;
  color?: ColorName;
  /** Fixed-width digits, so numbers don't "jump" when they change (12 → 11). */
  numeric?: boolean;
  align?: 'left' | 'center' | 'right';
  /** Force a face: `display` = wide Archivo (titles, numbers), `text` = Inter. Default: by variant. */
  face?: FontFace;
};

export function Text({
  variant = 'body',
  color = 'text',
  numeric = false,
  align,
  face,
  style,
  ...props
}: TextProps) {
  const theme = useTheme();
  const flat = StyleSheet.flatten([
    typography[variant],
    { color: theme[color], textAlign: align },
    numeric && { fontVariant: ['tabular-nums' as const] },
    style,
  ]);
  // Swap the weight for the matching Inter file (see fonts.ts).
  const { fontWeight, ...rest } = flat;
  const resolvedFace = face ?? (DISPLAY_VARIANTS.includes(variant) ? 'display' : 'text');
  return <RNText style={[rest, { fontFamily: fontFamilyFor(fontWeight, resolvedFace) }]} {...props} />;
}
