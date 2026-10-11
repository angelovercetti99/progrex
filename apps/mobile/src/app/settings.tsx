import { GOALS } from '@progrex/shared';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Fragment, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { getConnection } from '@/db/client';
import { useLiveQuery } from '@/db/live';
import { pickBackupFile, saveBackupFile } from '@/features/backup/backupFile';
import { exportBackup, restoreBackup } from '@/features/backup/queries';
import { resetAllData } from '@/features/reset/queries';
import { SyncSettings } from '@/features/sync/SyncSettings';
import { WearableSettings } from '@/features/wearables/WearableSettings';
import { resolveLanguage } from '@/i18n';
import { confirm } from '@/lib/confirm';
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
import { IconBadge } from '@/ui/IconBadge';
import { ListRow } from '@/ui/ListRow';
import { Logo } from '@/ui/Logo';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { Text } from '@/ui/Text';
import { maxContentWidth, radius, space } from '@/ui/theme';
import { useSingleFlight } from '@/ui/useSingleFlight';
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
  const [backupMessage, setBackupMessage] = useState<string | null>(null);

  const exportData = useSingleFlight(async () => {
    try {
      await saveBackupFile(await exportBackup(), t('settings.backup'));
      setBackupMessage(t('settings.backupExported'));
    } catch {
      setBackupMessage(t('settings.backupFailed'));
    }
  });

  const importData = useSingleFlight(async () => {
    try {
      const text = await pickBackupFile();
      if (text === null) return;
      const result = await restoreBackup(text);
      setBackupMessage(
        result.ok ? t('settings.backupImported', { count: result.workouts }) : t('settings.backupInvalid')
      );
    } catch {
      setBackupMessage(t('settings.backupFailed'));
    }
  });

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

  async function startOver() {
    if (await confirm(t('settings.resetConfirm'), t('settings.resetAction'), t('common.cancel'))) {
      await resetAllData();
      router.replace('/');
    }
  }

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.scroll}>
      <View style={styles.column}>
        <View style={styles.section}>
          <Text variant="eyebrow" color="textMuted">
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
          <Text variant="eyebrow" color="textMuted">
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
          <Text variant="eyebrow" color="textMuted">
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
          <ListRow
            leading={
              <IconBadge name={{ ios: 'mappin.and.ellipse', android: 'location_on', web: 'location_on' }} />
            }
            title={t('settings.locations')}
            onPress={() => router.push('/locations')}
          />
          <Divider />
          <ListRow
            leading={<IconBadge name={{ ios: 'heart', android: 'favorite', web: 'favorite' }} />}
            title={t('settings.health')}
            subtitle={t('settings.healthHint')}
            onPress={() => router.push('/health')}
          />
        </Card>

        <View style={styles.section}>
          <Card>
            <CheckRow label={t('settings.showRir')} checked={showRir} onToggle={() => setShowRir(!showRir)} />
          </Card>
          <Text variant="caption" color="textMuted">
            {t('settings.showRirHint')}
          </Text>
        </View>

        <WearableSettings />

        <SyncSettings />

        <View style={styles.section}>
          <Text variant="eyebrow" color="textMuted">
            {t('settings.backup')}
          </Text>
          <Card>
            <ListRow
              leading={<IconBadge name={{ ios: 'square.and.arrow.up', android: 'upload', web: 'upload' }} />}
              title={t('settings.backupExport')}
              onPress={exportData}
              showChevron={false}
            />
            <Divider />
            <ListRow
              leading={
                <IconBadge name={{ ios: 'square.and.arrow.down', android: 'download', web: 'download' }} />
              }
              title={t('settings.backupImport')}
              onPress={importData}
              showChevron={false}
            />
          </Card>
          <Text variant="caption" color="textMuted">
            {backupMessage ?? t('settings.backupHint')}
          </Text>
        </View>

        {/* Start over: everything goes, back to "Where do you train?". */}
        <View style={styles.section}>
          <Card>
            <ListRow
              leading={
                <IconBadge
                  name={{ ios: 'arrow.counterclockwise', android: 'restart_alt', web: 'restart_alt' }}
                />
              }
              title={t('settings.reset')}
              onPress={startOver}
              showChevron={false}
            />
          </Card>
          <Text variant="caption" color="textMuted">
            {t('settings.resetHint')}
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
