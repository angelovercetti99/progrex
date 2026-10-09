import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, View } from 'react-native';

import { loadSavedLanguage } from '@/i18n';
import { Button } from '@/ui/Button';
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

/** On the web, the local database can only be open in one tab at a time. */
function isOpenElsewhere(error: Error): boolean {
  return /NoModificationAllowed|Access Handle/i.test(`${error.name} ${error.message}`);
}

/** Renders the app only after the database is migrated and seeded. */
export function DatabaseGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [state, setState] = useState<'loading' | 'ready' | Error>('loading');

  const open = useCallback(() => {
    prepareDatabase()
      .then(() => setState('ready'))
      .catch((error: unknown) => setState(error instanceof Error ? error : new Error(String(error))))
      .finally(() => SplashScreen.hideAsync());
  }, []);

  useEffect(open, [open]);

  function retry() {
    // On the web, a failed SQLite start can't be retried in the same page: reload it.
    if (Platform.OS === 'web') {
      window.location.reload();
      return;
    }
    setState('loading');
    open();
  }

  if (state === 'loading') {
    return null;
  }

  if (state instanceof Error) {
    const elsewhere = isOpenElsewhere(state);
    return (
      <View style={[styles.error, { backgroundColor: theme.background }]}>
        <Text variant="heading">{elsewhere ? t('startup.otherTabTitle') : t('startup.errorTitle')}</Text>
        <Text color="textMuted">{elsewhere ? t('startup.otherTabBody') : t('startup.errorBody')}</Text>
        {!elsewhere && (
          <Text variant="caption" color="textMuted">
            {state.message}
          </Text>
        )}
        <View style={styles.action}>
          <Button label={t('startup.retry')} onPress={retry} />
        </View>
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
  action: {
    marginTop: space.xl,
  },
});
