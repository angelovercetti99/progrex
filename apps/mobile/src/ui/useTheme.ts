import { colors, type Palette } from './theme';
import { useColorMode } from './ThemeMode';

/** Returns the color palette for the current light/dark mode. */
export function useTheme(): Palette {
  return colors[useColorMode()];
}
