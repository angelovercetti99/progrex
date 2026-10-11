import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useLiveQuery } from '@/db/live';
import { confirm } from '@/lib/confirm';
import { formatShortDate } from '@/lib/dates';
import { useNow } from '@/lib/useNow';
import { Button } from '@/ui/Button';
import { Card, Divider } from '@/ui/Card';
import { IconBadge } from '@/ui/IconBadge';
import { ListRow } from '@/ui/ListRow';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';
import { space } from '@/ui/theme';
import { useSingleFlight } from '@/ui/useSingleFlight';

import { connect, disconnect, getSyncStatus, normalizeServerUrl, syncNow, type SyncStatus } from './engine';

/** Settings → Sync: connect this device to your server, or see how it's going. */
export function SyncSettings() {
  const { t, i18n } = useTranslation();
  // The engine writes its status to preferences, so this re-reads on every sync.
  const status = useLiveQuery(getSyncStatus, ['preferences'], []).data;
  const now = useNow(30_000);
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const connectNow = useSingleFlight(async () => {
    const address = normalizeServerUrl(url);
    if (!address) return setMessage(t('sync.badUrl'));
    if (!token.trim()) return setMessage(t('sync.noKey'));
    setMessage(t('sync.connecting'));
    const result = await connect(address, token);
    if (result.ok) {
      setToken('');
      setMessage(null);
    } else {
      setMessage(t(`sync.errors.${result.error}`));
    }
  });

  const syncAgain = useSingleFlight(async () => {
    await syncNow();
  });

  async function disconnectDevice() {
    if (await confirm(t('sync.disconnectConfirm'), t('sync.disconnect'), t('common.cancel'))) {
      await disconnect();
    }
  }

  /** "Sincronizado há 3 min" or the last problem. */
  function statusText(current: SyncStatus): string {
    if (current.error) return t(`sync.errors.${current.error}`);
    if (!current.lastSyncAt) return t('sync.waiting');
    const minutes = Math.floor((now - Date.parse(current.lastSyncAt)) / 60000);
    if (minutes < 1) return t('sync.justNow');
    if (minutes < 60) return t('sync.minutesAgo', { count: minutes });
    if (minutes < 24 * 60) return t('sync.hoursAgo', { count: Math.floor(minutes / 60) });
    return t('sync.since', { date: formatShortDate(current.lastSyncAt.slice(0, 10), i18n.language) });
  }

  if (!status) return null;

  return (
    <View style={styles.section}>
      <Text variant="eyebrow" color="textMuted">
        {t('sync.title')}
      </Text>

      {status.connected ? (
        <>
          <Card>
            <ListRow
              leading={
                <IconBadge name={{ ios: 'arrow.triangle.2.circlepath', android: 'sync', web: 'sync' }} />
              }
              title={t('sync.now')}
              subtitle={statusText(status)}
              onPress={syncAgain}
              showChevron={false}
            />
            <Divider />
            <ListRow
              leading={<IconBadge name={{ ios: 'icloud.slash', android: 'cloud_off', web: 'cloud_off' }} />}
              title={t('sync.disconnect')}
              onPress={disconnectDevice}
              showChevron={false}
            />
          </Card>
          <Text variant="caption" color="textMuted">
            {t('sync.connectedHint', { server: status.url?.replace(/^https?:\/\//, '') })}
          </Text>
        </>
      ) : (
        <>
          <View style={styles.form}>
            <TextField
              value={url}
              onChangeText={setUrl}
              placeholder={t('sync.urlPlaceholder')}
              accessibilityLabel={t('sync.url')}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              inputMode="url"
            />
            <TextField
              value={token}
              onChangeText={setToken}
              placeholder={t('sync.keyPlaceholder')}
              accessibilityLabel={t('sync.key')}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
            />
            <Button variant="secondary" label={t('sync.connect')} onPress={connectNow} />
          </View>
          <Text variant="caption" color="textMuted">
            {message ?? t('sync.hint')}
          </Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: space.sm,
  },
  form: {
    gap: space.sm,
  },
});
