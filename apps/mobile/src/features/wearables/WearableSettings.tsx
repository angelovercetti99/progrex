import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useLiveQuery } from '@/db/live';
import { Card } from '@/ui/Card';
import { CheckRow } from '@/ui/CheckRow';
import { Text } from '@/ui/Text';
import { space } from '@/ui/theme';
import { useSingleFlight } from '@/ui/useSingleFlight';

import { healthPlatform } from './platform';
import { getHealthSyncEnabled, setHealthSyncEnabled } from './queries';

/** Settings → Watch and health: one switch. Hidden where there's no health platform (web). */
export function WearableSettings() {
  const { t } = useTranslation();
  const enabled = useLiveQuery(getHealthSyncEnabled, ['preferences'], []).data ?? false;
  const [available, setAvailable] = useState<boolean | null>(null);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    healthPlatform
      ?.isAvailable()
      .then(setAvailable)
      .catch(() => setAvailable(false));
  }, []);

  const toggle = useSingleFlight(async () => {
    const ok = await setHealthSyncEnabled(!enabled);
    setDenied(!enabled && !ok);
  });

  if (!healthPlatform) return null;
  const name = t(`wearables.${healthPlatform.name}`);

  return (
    <View style={styles.section}>
      <Text variant="eyebrow" color="textMuted">
        {t('wearables.title')}
      </Text>
      {available ? (
        <Card>
          <CheckRow label={t('wearables.connect', { name })} checked={enabled} onToggle={toggle} />
        </Card>
      ) : null}
      <Text variant="caption" color="textMuted">
        {available === false
          ? t('wearables.unavailable', { name })
          : denied
            ? t('wearables.denied', { name })
            : t('wearables.hint', { name })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: space.sm,
  },
});
