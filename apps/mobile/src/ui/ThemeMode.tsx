import { createContext, useContext, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { useLiveQuery } from '@/db/live';
import { getThemePreference } from '@/lib/preferences';

type ColorMode = 'light' | 'dark';

/**
 * A React Context shares one value with every component below it, without
 * passing it down by hand. Here: is the app light or dark right now?
 */
const ColorModeContext = createContext<ColorMode>('light');

/** Light / dark: the user's choice in Settings, or the phone's setting. */
export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  // Before the database is ready this read fails quietly and we follow the system.
  const preference = useLiveQuery(getThemePreference, ['preferences'], []);
  const chosen = preference.data && preference.data !== 'system' ? preference.data : null;
  const mode: ColorMode = chosen ?? (system === 'dark' ? 'dark' : 'light');
  return <ColorModeContext.Provider value={mode}>{children}</ColorModeContext.Provider>;
}

export function useColorMode(): ColorMode {
  return useContext(ColorModeContext);
}
