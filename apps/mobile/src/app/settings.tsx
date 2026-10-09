import { GOALS } from '@progrex/shared';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Fragment, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { getConnection } from '@/db/client';
import { useLiveQuery } from '@/db/live';
import { resolveLanguage } from '@/i18n';
import {
  DEFAULT_GOAL,
  getGoal,
  getLanguagePreference,
  getShowRir,
  getThemePreference,
  setGoal,
  setShowRir,
  setLanguagePreference,
  setThemePreference,
  type LanguagePreference,
  type ThemePreference,
} from '@/lib/preferences';
import { Card, Divider } from '@/ui/Card';
import { CheckRow } from '@/ui/CheckRow';
import { ListRow } from '@/ui/ListRow';
import { Logo } from '@/ui/Logo';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { Text } from '@/ui/Text';
import { maxContentWidth, radius, space } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

type StorageStatus =
  { state: 'checking' } | { state: 'ok'; version: string } | { state: 'error'; message: string };

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const [language, setLanguage] = useState<LanguagePreference>('system');
  const [storage, setStorage] = useState<StorageStatus>({ state: 'checking' });
  const goal = useLiveQuery(getGoal, ['preferences'], []).data ?? DEFAULT_GOAL;
  const showRir = useLiveQuery(getShowRir, ['preferences'], []).data ?? false;
  const themePreference = useLiveQuery(getThemePreference, ['preferences'], []).data ?? 'system';

  useEffect(() => {
    getLanguagePreference().then(setLanguage);
  }, []);

  // Proves the local database works on this platform (especially on web).
  useEffect(() => {
    async function checkStorage() {
      try {
        const db = await getConnection();
        const row = await db.getFirstAsync<{ version: string }>('SELECT sqlite_version() AS version');
        setStorage({ state: 'ok', version: row?.version ?? '?' });
      } catch (error) {
        setStorage({ state: 'error', message: String(error) });
      }
    }
    checkStorage();
  }, []);

  async function changeLanguage(preference: LanguagePreference) {
    setLanguage(preference);
    await setLanguagePreference(preference);
    await i18n.changeLanguage(resolveLanguage(preference));
  }

  const storageText =
    storage.state === 'checking'
      ? t('settings.storageChecking')
      : storage.state === 'ok'
        ? t('settings.storageOk', { version: storage.version })
        : t('settings.storageError', { message: storage.message });

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.scroll}>
      <View style={styles.column}>
        <View style={styles.section}>
          <Text variant="label" color="textMuted">
            {t('settings.language')}
          </Text>
          <SegmentedControl
            value={language}
            onChange={changeLanguage}
            options={[
              { value: 'system', label: t('settings.languageSystem') },
              { value: 'pt', label: 'Português' },
              { value: 'en', label: 'English' },
            ]}
          />
        </View>

        <View style={styles.section}>
          <Text variant="label" color="textMuted">
            {t('settings.appearance')}
          </Text>
          <SegmentedControl<ThemePreference>
            value={themePreference}
            onChange={setThemePreference}
            options={[
              { value: 'system', label: t('settings.languageSystem') },
              { value: 'light', label: t('settings.appearanceLight') },
              { value: 'dark', label: t('settings.appearanceDark') },
            ]}
          />
        </View>

        <View style={styles.section}>
          <Text variant="label" color="textMuted">
            {t('settings.goal')}
          </Text>
          <Card>
            {GOALS.map((option, index) => (
              <Fragment key={option}>
                {index > 0 && <Divider />}
                <ListRow
                  title={t(`goals.${option}`)}
                  onPress={() => setGoal(option)}
                  showChevron={false}
                  right={
                    option === goal ? (
                      <SymbolView
                        name={{ ios: 'checkmark', android: 'check', web: 'check' }}
                        tintColor={theme.accentText}
                        size={20}
                      />
                    ) : null
                  }
                />
              </Fragment>
            ))}
          </Card>
        </View>

        <Card>
          <ListRow title={t('settings.locations')} onPress={() => router.push('/locations')} />
        </Card>

        <View style={styles.section}>
          <Card>
            <CheckRow label={t('settings.showRir')} checked={showRir} onToggle={() => setShowRir(!showRir)} />
          </Card>
          <Text variant="caption" color="textMuted">
            {t('settings.showRirHint')}
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: theme.surface }]}>
          <Row label={t('settings.storage')} value={storageText} />
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <Row label={t('settings.version')} value={Constants.expoConfig?.version ?? '–'} />
        </View>
        <View style={styles.footer}>
          <Logo size={22} />
        </View>
      </View>
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text>{label}</Text>
      <Text color="textMuted" style={styles.rowValue}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    alignItems: 'center',
    paddingVertical: space.xl,
    opacity: 0.5,
  },
  scroll: {
    padding: space.lg,
  },
  column: {
    width: '100%',
    maxWidth: maxContentWidth,
    alignSelf: 'center',
    gap: space.xl,
  },
  section: {
    gap: space.sm,
  },
  card: {
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space.lg,
    paddingVertical: space.lg,
  },
  rowValue: {
    flexShrink: 1,
    textAlign: 'right',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
});
