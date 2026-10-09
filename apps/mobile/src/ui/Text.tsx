import { Text as RNText, StyleSheet, type TextProps as RNTextProps } from 'react-native';

import { fontFamilyFor } from './fonts';
import { typography, type ColorName, type TypographyVariant } from './theme';
import { useTheme } from './useTheme';

type TextProps = RNTextProps & {
  variant?: TypographyVariant;
  color?: ColorName;
  /** Fixed-width digits, so numbers don't "jump" when they change (12 → 11). */
  numeric?: boolean;
  align?: 'left' | 'center' | 'right';
};

export function Text({
  variant = 'body',
  color = 'text',
  numeric = false,
  align,
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
  return <RNText style={[rest, { fontFamily: fontFamilyFor(fontWeight) }]} {...props} />;
}
