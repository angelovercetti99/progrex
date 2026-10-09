import { effortForRir } from '@progrex/shared';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useLiveQuery } from '@/db/live';
import { useExerciseName } from '@/features/exercises/useExerciseName';
import { formatSet } from '@/features/workouts/formatSet';
import { discardWorkout, getWorkoutDetail } from '@/features/workouts/queries';
import { confirm } from '@/lib/confirm';
import { formatShortDate } from '@/lib/dates';
import { getShowRir } from '@/lib/preferences';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Text } from '@/ui/Text';
import { maxContentWidth, space } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

/** A finished workout, read-only. */
export default function HistoryDetailScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const exerciseName = useExerciseName();
  const { id } = useLocalSearchParams<{ id: string }>();
  const detail = useLiveQuery(() => getWorkoutDetail(id), ['workouts', 'workout_exercises', 'sets'], [id]);
  const workout = detail.data;
  const kg = t('common.kg');
  const showRir = useLiveQuery(getShowRir, ['preferences'], []).data ?? false;

  async function remove() {
    if (await confirm(t('history.deleteConfirm'), t('common.delete'), t('common.cancel'))) {
      await discardWorkout(id);
      router.back();
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: workout ? formatShortDate(workout.date, i18n.language) : '' }} />
      <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.scroll}>
        <View style={styles.column}>
          {workout?.location && <Text color="textMuted">{workout.location.name}</Text>}
          {workout?.exercises
            .filter((item) => item.sets.length > 0)
            .map((item) => (
              <Card key={item.id} style={styles.card}>
                <Text variant="heading">{exerciseName(item.exercise)}</Text>
                {item.sets.map((set, index) => (
                  <View key={set.id} style={styles.setRow}>
                    <Text color="textMuted" numeric style={styles.setIndex}>
                      {index + 1}
                    </Text>
                    <Text numeric style={styles.setMain}>
                      {set.weightKg ? formatSet(set, kg) : `${set.reps} ${t('workout.reps')}`}
                    </Text>
                    {set.rir !== null && (
                      <Text variant="caption" color="textMuted" numeric>
                        {showRir ? `${t('workout.rir')} ${set.rir}` : t(`effort.${effortForRir(set.rir)}`)}
                      </Text>
                    )}
                  </View>
                ))}
              </Card>
            ))}
          {workout && <Button variant="secondary" label={t('history.delete')} onPress={remove} />}
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: space.lg,
    paddingBottom: space.xxxl,
  },
  column: {
    width: '100%',
    maxWidth: maxContentWidth,
    alignSelf: 'center',
    gap: space.lg,
  },
  card: {
    paddingVertical: space.lg,
    gap: space.sm,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  setIndex: {
    width: 20,
  },
  setMain: {
    flex: 1,
  },
});
