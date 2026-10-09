import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { loadSavedLanguage } from '@/i18n';
import { Text } from '@/ui/Text';
import { space } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

import { notifyChanged } from './live';
import { runMigrations } from './migrate';
import { seedBuiltinExercises } from './seed';

// Keep the splash screen up until the database is ready.
SplashScreen.preventAutoHideAsync();

async function prepareDatabase() {
  await runMigrations();
  await seedBuiltinExercises();
  await loadSavedLanguage();
  // Anything that read preferences before the tables existed (e.g. the theme) reads again.
  notifyChanged('preferences');
}

/** Renders the app only after the database is migrated and seeded. */
export function DatabaseGate({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const [state, setState] = useState<'loading' | 'ready' | Error>('loading');

  useEffect(() => {
    prepareDatabase()
      .then(() => setState('ready'))
      .catch((error: unknown) => setState(error instanceof Error ? error : new Error(String(error))))
      .finally(() => SplashScreen.hideAsync());
  }, []);

  if (state === 'loading') {
    return null;
  }

  if (state instanceof Error) {
    // Not translated on purpose: translations may be what failed to load.
    return (
      <View style={[styles.error, { backgroundColor: theme.background }]}>
        <Text variant="heading">Database error</Text>
        <Text color="textMuted">{state.message}</Text>
      </View>
    );
  }

  return children;
}

const styles = StyleSheet.create({
  error: {
    flex: 1,
    justifyContent: 'center',
    padding: space.xl,
    gap: space.sm,
  },
});
