import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';

import { useLiveQuery } from '@/db/live';
import { listFinishedWorkouts } from '@/features/workouts/queries';
import { formatShortDate } from '@/lib/dates';
import { Card, Divider } from '@/ui/Card';
import { EmptyState } from '@/ui/EmptyState';
import { ListRow } from '@/ui/ListRow';
import { maxContentWidth, space } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

export default function HistoryScreen() {
  const { t, i18n } = useTranslation();
  const history = useLiveQuery(
    listFinishedWorkouts,
    ['workouts', 'workout_exercises', 'sets', 'locations'],
    []
  );
  const items = history.data ?? [];
  const theme = useTheme();

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.scroll}>
      <View style={styles.column}>
        {history.status === 'ready' && items.length === 0 ? (
          <EmptyState title={t('history.emptyTitle')} description={t('history.emptyDescription')} />
        ) : (
          <Card>
            {items.map((workout, index) => (
              <Fragment key={workout.id}>
                {index > 0 && <Divider />}
                <ListRow
                  title={formatShortDate(workout.date, i18n.language)}
                  subtitle={`${workout.locationName} · ${t('today.exerciseCount', { count: workout.exerciseCount })} · ${t('history.sets', { count: workout.setCount })}`}
                  onPress={() => router.push(`/history/${workout.id}`)}
                />
              </Fragment>
            ))}
          </Card>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: space.lg,
  },
  column: {
    width: '100%',
    maxWidth: maxContentWidth,
    alignSelf: 'center',
  },
});
