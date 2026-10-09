import { harderVariant, selectVariant } from '@progrex/shared';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useLiveQuery } from '@/db/live';
import { listExercises } from '@/features/exercises/queries';
import { ExerciseCard } from '@/features/workouts/ExerciseCard';
import { finishWorkout, getWorkoutDetail } from '@/features/workouts/queries';
import { RestTimer } from '@/features/workouts/RestTimer';
import { DEFAULT_GOAL, getGoal } from '@/lib/preferences';
import { Button } from '@/ui/Button';
import { Text } from '@/ui/Text';
import { maxContentWidth, space } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

/** The workout in progress: one card per exercise, sets logged inline. */
export default function WorkoutScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const detail = useLiveQuery(() => getWorkoutDetail(id), ['workouts', 'workout_exercises', 'sets'], [id]);
  const items = detail.data?.exercises ?? [];
  const goal = useLiveQuery(getGoal, ['preferences'], []).data ?? DEFAULT_GOAL;
  const catalog = useLiveQuery(listExercises, ['exercises'], []).data ?? [];
  const equipment = detail.data?.location?.equipment ?? [];

  // An exercise is "done" when every planned set is logged.
  const isDone = (item: (typeof items)[number]) =>
    item.target !== null && item.sets.length >= item.target.sets.length;
  const firstOpen = items.find((item) => !isDone(item))?.id ?? null;
  const allDone = items.length > 0 && items.every(isDone);

  // The card with the set logger open:
  // - on opening (or a plan starting), the first exercise not done yet;
  // - when you add one, the new one;
  // - when you finish the last set of an exercise, the next one (no tap needed).
  const [activeId, setActiveId] = useState<string | null>(null);
  const previousCount = useRef(0);
  const count = items.length;
  const lastId = items.at(-1)?.id ?? null;
  useEffect(() => {
    if (count > previousCount.current) {
      setActiveId(previousCount.current === 0 ? (firstOpen ?? lastId) : lastId);
    }
    previousCount.current = count;
  }, [count, lastId, firstOpen]);

  const active = items.find((item) => item.id === activeId);
  const activeSets = active?.sets.length ?? 0;
  const activeDone = active ? isDone(active) : false;
  const previousActive = useRef({ id: activeId, sets: activeSets });
  useEffect(() => {
    const before = previousActive.current;
    const justFinished = before.id === activeId && activeSets > before.sets && activeDone;
    if (justFinished && firstOpen) setActiveId(firstOpen);
    previousActive.current = { id: activeId, sets: activeSets };
  }, [activeId, activeSets, activeDone, firstOpen]);

  const lastCompletedAt =
    items
      .flatMap((item) => item.sets.map((set) => set.completedAt))
      .filter((value): value is string => value !== null)
      .sort()
      .at(-1) ?? null;

  // Planned workouts show where they are in the plan; free ones show the place.
  const workout = detail.data;
  const title =
    workout && workout.planWeek !== null && workout.planSession !== null
      ? t('plan.nextSession', {
          week: workout.planWeek + 1,
          key: (workout.planSessionsCovered ?? [workout.planSession])
            .map((index) => String.fromCharCode(65 + index))
            .join(' + '),
        })
      : (workout?.location?.name ?? '');

  async function finish() {
    const result = await finishWorkout(id);
    if (result === 'finished') {
      // Swap the workout screen for its summary (back then returns to Today).
      router.replace(`/summary/${id}`);
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  }

  return (
    <>
      <Stack.Screen options={{ title }} />
      <ScrollView
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={styles.scroll}
        // iPhone: scroll the typed field above the keyboard.
        automaticallyAdjustKeyboardInsets>
        <View style={styles.column}>
          <View style={styles.topBar}>
            <Text color="textMuted" style={styles.place}>
              {workout?.planWeek !== null ? (workout?.location?.name ?? '') : ''}
            </Text>
            <RestTimer
              since={lastCompletedAt}
              targetSeconds={items.find((item) => item.id === activeId)?.target?.restSeconds ?? null}
            />
          </View>

          {detail.status === 'ready' && items.length === 0 && (
            <Text color="textMuted" align="center" style={styles.empty}>
              {t('workout.empty')}
            </Text>
          )}

          {items.map((item) => (
            <ExerciseCard
              key={item.id}
              workoutId={id}
              item={item}
              goal={goal}
              harder={
                item.target?.lever === 'variant'
                  ? harderVariant(item.exercise, equipment, catalog)
                  : item.target?.lever === 'plateau'
                    ? // A different stimulus at the same level (not necessarily harder).
                      selectVariant({
                        pattern: item.exercise.pattern,
                        available: equipment,
                        candidates: catalog.filter((candidate) => candidate.id !== item.exerciseId),
                        targetDifficulty: item.exercise.difficulty,
                        allowFallback: false,
                      })
                    : null
              }
              active={item.id === activeId}
              onActivate={() => setActiveId(item.id)}
            />
          ))}

          <View style={styles.footer}>
            <Button
              variant={items.length ? 'secondary' : 'primary'}
              label={t('workout.addExercise')}
              onPress={() => router.push({ pathname: '/add-exercise', params: { workoutId: id } })}
            />
            <Button
              variant={allDone ? 'primary' : 'secondary'}
              label={t('workout.finish')}
              onPress={finish}
            />
          </View>
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 28,
  },
  place: {
    flex: 1,
  },
  empty: {
    paddingVertical: space.xxl,
  },
  footer: {
    gap: space.md,
    marginTop: space.md,
  },
});
