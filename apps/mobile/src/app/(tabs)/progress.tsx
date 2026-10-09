import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { useLiveQuery } from '@/db/live';
import { createDemoData, deleteDemoData, hasDemoData, hasRealWorkouts } from '@/features/demo/queries';
import { getProgressOverview } from '@/features/progress/queries';
import { ProgressView } from '@/features/progress/ProgressView';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { space, touch } from '@/ui/theme';

const TABLES = ['workouts', 'workout_exercises', 'sets', 'locations', 'exercises'] as const;

export default function ProgressScreen() {
  const { t } = useTranslation();
  const overview = useLiveQuery(getProgressOverview, [...TABLES], []);
  const demo = useLiveQuery(hasDemoData, ['workouts'], []);
  const real = useLiveQuery(hasRealWorkouts, ['workouts'], []);

  if (overview.status !== 'ready') {
    return <Screen title={t('progress.title')}>{null}</Screen>;
  }

  if (!overview.data.hasData) {
    return (
      <Screen title={t('progress.title')}>
        <EmptyState
          title={t('progress.emptyTitle')}
          description={t('progress.emptyDescription')}
          action={
            real.data === false ? (
              <Button variant="secondary" label={t('progress.demo')} onPress={createDemoData} />
            ) : undefined
          }
        />
      </Screen>
    );
  }

  return (
    <Screen title={t('progress.title')}>
      {demo.data && (
        <View style={styles.demo}>
          <Text variant="caption" color="textMuted" style={styles.flex}>
            {t('progress.demoBadge')}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={deleteDemoData}
            hitSlop={8}
            style={styles.demoButton}>
            <Text variant="label">{t('progress.demoRemove')}</Text>
          </Pressable>
        </View>
      )}
      <ProgressView data={overview.data} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  demo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: -space.md,
  },
  flex: {
    flex: 1,
  },
  demoButton: {
    minHeight: touch.min - 12,
    justifyContent: 'center',
  },
});
