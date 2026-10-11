import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Fragment, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useLiveQuery } from '@/db/live';
import { ExerciseThumb } from '@/features/exercises/ExerciseThumb';
import { useExerciseName } from '@/features/exercises/useExerciseName';
import { Button } from '@/ui/Button';
import { Card, Divider } from '@/ui/Card';
import { ProgressBar } from '@/ui/ProgressBar';
import { StatRow } from '@/ui/StatRow';
import { Text } from '@/ui/Text';
import { space, touch } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

import { getWorkoutDetail } from './queries';

/** The current time, refreshed every `ms` (rendering must not read the clock directly). */
function useNow(ms: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(timer);
  }, [ms]);
  return now;
}

/** Today, while a workout is open: how far you are, and one button to carry on. */
export function ActiveWorkout({ workoutId }: { workoutId: string }) {
  const { t } = useTranslation();
  const now = useNow(30_000);
  const theme = useTheme();
  const exerciseName = useExerciseName();
  const detail = useLiveQuery(
    () => getWorkoutDetail(workoutId),
    ['workouts', 'workout_exercises', 'sets'],
    [workoutId]
  ).data;
  if (!detail) return null;

  const items = detail.exercises;
  const setsDone = items.reduce((sum, item) => sum + item.sets.length, 0);
  // Planned sets, or what's done when there's no plan for an exercise.
  const setsPlanned = items.reduce(
    (sum, item) => sum + Math.max(item.target?.sets.length ?? 0, item.sets.length),
    0
  );
  const exercisesDone = items.filter(
    (item) => item.sets.length > 0 && item.sets.length >= (item.target?.sets.length ?? 1)
  ).length;
  const minutes = Math.max(0, Math.round((now - Date.parse(detail.startedAt)) / 60000));

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text variant="eyebrow" color="textMuted">
          {t('today.inProgress')}
          {detail.location ? ` · ${detail.location.name}` : ''}
        </Text>
        <Text variant="hero">{t('today.keepGoing')}</Text>
      </View>

      <StatRow
        items={[
          { value: `${setsDone}/${setsPlanned}`, label: t('today.statSets', { count: setsPlanned }) },
          {
            value: `${exercisesDone}/${items.length}`,
            label: t('today.statExercises', { count: items.length }),
          },
          { value: String(minutes), label: t('today.statMinutes') },
        ]}
      />
      <ProgressBar value={setsPlanned ? setsDone / setsPlanned : 0} />

      {items.length > 0 && (
        <Card>
          {items.map((item, index) => {
            const planned = item.target?.sets.length ?? 0;
            const complete = item.sets.length > 0 && item.sets.length >= planned;
            return (
              <Fragment key={item.id}>
                {index > 0 && <Divider />}
                <View style={styles.row}>
                  <ExerciseThumb exercise={item.exercise} size={44} />
                  <View style={styles.texts}>
                    <Text variant="label" color={complete ? 'textMuted' : 'text'} numberOfLines={1}>
                      {exerciseName(item.exercise)}
                    </Text>
                    <Text variant="caption" color="textMuted" numeric>
                      {planned
                        ? t('today.setsOf', { done: item.sets.length, total: planned })
                        : t('today.setsCount', { count: item.sets.length })}
                    </Text>
                  </View>
                  {complete && (
                    <SymbolView
                      name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }}
                      tintColor={theme.text}
                      size={22}
                    />
                  )}
                </View>
              </Fragment>
            );
          })}
        </Card>
      )}

      <Button label={t('today.continue')} onPress={() => router.push(`/workout/${workoutId}`)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: space.lg,
  },
  hero: {
    gap: space.xs,
    marginTop: space.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: touch.primary,
    paddingVertical: space.sm,
  },
  texts: {
    flex: 1,
    gap: 2,
  },
});
