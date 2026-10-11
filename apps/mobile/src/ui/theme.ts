import type { TextStyle } from 'react-native';

/**
 * Design tokens: every color, size and spacing in the app comes from here.
 * Components never use loose values like `#333` or `padding: 13`.
 *
 * Palette: monochrome, in the spirit of Apple, Nike and Tesla. No brand color:
 * the "accent" is simply the strongest contrast (black on light, white on
 * dark). Hierarchy comes from contrast, weight and space — not from color.
 */
export const colors = {
  light: {
    background: '#F5F5F7',
    surface: '#FFFFFF',
    surfaceMuted: '#EBEBEF',
    /** Raised element on a muted track, e.g. the selected segment. */
    raised: '#FFFFFF',
    border: '#D9D9DE',
    text: '#1D1D1F',
    textMuted: '#6E6E73',
    accent: '#1D1D1F',
    onAccent: '#FFFFFF',
    accentText: '#1D1D1F',
    danger: '#D70015',
  },
  dark: {
    background: '#000000',
    surface: '#1C1C1E',
    surfaceMuted: '#2C2C2E',
    raised: '#48484A',
    border: '#38383A',
    text: '#F5F5F7',
    textMuted: '#98989D',
    accent: '#F5F5F7',
    onAccent: '#000000',
    accentText: '#F5F5F7',
    danger: '#FF453A',
  },
} as const;

export type ColorName = keyof typeof colors.light;
export type Palette = Record<ColorName, string>;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

/**
 * Depth for cards. In light mode a soft shadow lifts white cards off the grey
 * background; in dark mode the lighter surface already does that.
 */
export const elevation = {
  light: '0px 1px 2px rgba(0, 0, 0, 0.04), 0px 8px 24px rgba(0, 0, 0, 0.06)',
  dark: 'none',
} as const;

/** Minimum touch sizes. Used in the gym with sweaty hands, so err on big. */
export const touch = {
  min: 48,
  primary: 56,
} as const;

/** Content never gets wider than this (matters on web and tablets). */
export const maxContentWidth = 560;

export const typography = {
  // Big numbers: weight, reps, timer. Wide and heavy (Archivo).
  display: { fontSize: 60, lineHeight: 66, fontWeight: '700', letterSpacing: -2 },
  // The one thing a screen is about (today's session, this week).
  hero: { fontSize: 38, lineHeight: 42, fontWeight: '800', letterSpacing: -1.2 },
  title: { fontSize: 32, lineHeight: 38, fontWeight: '800', letterSpacing: -1 },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: '600', letterSpacing: -0.4 },
  // A number in a summary row (exercises · sets · minutes).
  stat: { fontSize: 28, lineHeight: 32, fontWeight: '800', letterSpacing: -0.8 },
  body: { fontSize: 17, lineHeight: 24, fontWeight: '400', letterSpacing: -0.2 },
  label: { fontSize: 15, lineHeight: 20, fontWeight: '600', letterSpacing: -0.1 },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  // Small label above a title or a group: "SÁBADO, 10 OUT", "ESTA SEMANA".
  eyebrow: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
} satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;

/** Variants drawn in the wide display face (Archivo); the rest use Inter. */
export const DISPLAY_VARIANTS: readonly TypographyVariant[] = ['display', 'hero', 'title', 'stat'];
