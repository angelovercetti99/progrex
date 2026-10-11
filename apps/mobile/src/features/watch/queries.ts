import {
  acceptsCommand,
  suggestSet,
  WATCH_PROTOCOL,
  type WatchCommand,
  type WatchState,
} from '@progrex/shared';
import type { TFunction } from 'i18next';

import { useExerciseName } from '@/features/exercises/useExerciseName';
import {
  completeSet,
  getActiveWorkout,
  getLastPerformance,
  getWorkoutDetail,
  type WorkoutExerciseDetail,
} from '@/features/workouts/queries';
import { formatNumber } from '@/ui/Stepper';

type ExerciseName = ReturnType<typeof useExerciseName>;

/** Every planned set of this exercise is logged. */
function isDone(item: WorkoutExerciseDetail): boolean {
  return item.target !== null && item.sets.length >= item.target.sets.length;
}

/**
 * What the watch should show now: the next set of the first exercise that isn't
 * done (the phone moves on the same way, so both always agree). Null = no workout.
 */
export async function currentWatchState(
  t: TFunction,
  exerciseName: ExerciseName
): Promise<WatchState | null> {
  const active = await getActiveWorkout();
  if (!active) return null;
  const detail = await getWorkoutDetail(active.id);
  if (!detail || detail.exercises.length === 0) return null;

  const items = detail.exercises;
  const current = items.find((item) => !isDone(item)) ?? items[items.length - 1];
  const last = await getLastPerformance(current.exerciseId);
  const usesWeight = current.exercise.loadType === 'external';
  const values = suggestSet({ target: current.target, today: current.sets, last: last.sets, usesWeight });
  const total = Math.max(current.target?.sets.length ?? 0, current.sets.length + 1);
  const restSince =
    items
      .flatMap((item) => item.sets.map((set) => set.completedAt))
      .filter((value): value is string => value !== null)
      .sort()
      .at(-1) ?? null;

  return {
    v: WATCH_PROTOCOL,
    workoutId: detail.id,
    itemId: current.id,
    setNumber: current.sets.length + 1,
    title: exerciseName(current.exercise),
    subtitle: t('watch.setOf', { n: current.sets.length + 1, total }),
    target:
      usesWeight && values.weightKg
        ? `${formatNumber(values.weightKg)} ${t('common.kg')} × ${values.reps}`
        : `× ${values.reps}`,
    action: t('workout.completeSet'),
    restLabel: t('workout.rest'),
    restSince,
    restSeconds: current.target?.restSeconds ?? null,
    done: items.every(isDone),
    doneLabel: t('watch.done'),
  };
}

/**
 * "Done" tapped on the watch: log the set with the same pre-filled values as
 * the phone's one tap. Ignored if it's not the set that's next (a repeated or
 * late tap never logs twice).
 */
export async function handleWatchCommand(command: WatchCommand): Promise<void> {
  const detail = await getWorkoutDetail(command.workoutId);
  const item = detail?.exercises.find((candidate) => candidate.id === command.itemId);
  if (!detail || detail.finishedAt || !item) return;
  if (!acceptsCommand(command, detail.id, item.sets.length)) return;
  const last = await getLastPerformance(item.exerciseId);
  const values = suggestSet({
    target: item.target,
    today: item.sets,
    last: last.sets,
    usesWeight: item.exercise.loadType === 'external',
  });
  await completeSet(detail.id, item.id, values);
}
