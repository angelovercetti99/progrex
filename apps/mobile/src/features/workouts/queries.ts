import {
  GOAL_CONFIG,
  maxLoadFor,
  nextTarget,
  sessionScore,
  slotProgressionConfig,
  stalledSessions,
  type Target,
} from '@progrex/shared';
import { and, asc, desc, eq, inArray, isNotNull, isNull, max } from 'drizzle-orm';

import { db } from '@/db/client';
import { notifyChanged } from '@/db/live';
import {
  exercises,
  locations,
  mesocycles,
  sets,
  workoutExercises,
  workouts,
  type Exercise,
  type Location,
  type Workout,
  type WorkoutExercise,
  type WorkoutSet,
} from '@/db/schema';
import { deleteStamps, insertStamps, newId, nowIso, todayLocalDate, updateStamps } from '@/db/stamps';
import { getGoal } from '@/lib/preferences';

/** Rest longer than this isn't "rest between sets" anymore (e.g. a break). */
const MAX_REST_SECONDS = 15 * 60;

export type SetValues = {
  reps: number;
  weightKg: number | null;
  rir: number | null;
};

export type WorkoutExerciseDetail = WorkoutExercise & {
  exercise: Exercise;
  sets: WorkoutSet[];
};

export type WorkoutDetail = Workout & {
  location: Location | undefined;
  exercises: WorkoutExerciseDetail[];
};

// ---------- Reads ----------

/** The workout still in progress, if any. */
export async function getActiveWorkout(): Promise<(Workout & { exerciseCount: number }) | undefined> {
  const workout = await db
    .select()
    .from(workouts)
    .where(and(isNull(workouts.finishedAt), isNull(workouts.deletedAt)))
    .orderBy(desc(workouts.startedAt))
    .get();
  if (!workout) return undefined;

  const items = await db
    .select({ id: workoutExercises.id })
    .from(workoutExercises)
    .where(and(eq(workoutExercises.workoutId, workout.id), isNull(workoutExercises.deletedAt)));
  return { ...workout, exerciseCount: items.length };
}

export async function getWorkoutDetail(id: string): Promise<WorkoutDetail | undefined> {
  const workout = await db.select().from(workouts).where(eq(workouts.id, id)).get();
  if (!workout) return undefined;

  const location = await db.select().from(locations).where(eq(locations.id, workout.locationId)).get();

  const items = await db
    .select({ item: workoutExercises, exercise: exercises })
    .from(workoutExercises)
    .innerJoin(exercises, eq(workoutExercises.exerciseId, exercises.id))
    .where(and(eq(workoutExercises.workoutId, id), isNull(workoutExercises.deletedAt)))
    .orderBy(asc(workoutExercises.position));

  const setRows = items.length
    ? await db
        .select()
        .from(sets)
        .where(
          and(
            inArray(
              sets.workoutExerciseId,
              items.map(({ item }) => item.id)
            ),
            isNull(sets.deletedAt)
          )
        )
        .orderBy(asc(sets.position))
    : [];

  return {
    ...workout,
    location,
    exercises: items.map(({ item, exercise }) => ({
      ...item,
      exercise,
      sets: setRows.filter((set) => set.workoutExerciseId === item.id),
    })),
  };
}

export type LastPerformance = {
  sets: WorkoutSet[];
  /** What was prescribed that time (null for workouts before targets existed). */
  target: Target | null;
};

/**
 * This exercise in the most recent *finished* workout that wasn't a deload
 * (deload sets are easy on purpose, so they're not a baseline to progress from).
 * Used to pre-fill today's sets, show "Last time: …" and compute the target.
 */
export async function getLastPerformance(exerciseId: string): Promise<LastPerformance> {
  const recent = await db
    .select({ itemId: workoutExercises.id, target: workoutExercises.target })
    .from(workoutExercises)
    .innerJoin(workouts, eq(workoutExercises.workoutId, workouts.id))
    .where(
      and(
        eq(workoutExercises.exerciseId, exerciseId),
        isNull(workoutExercises.deletedAt),
        isNull(workouts.deletedAt),
        isNotNull(workouts.finishedAt)
      )
    )
    .orderBy(desc(workouts.startedAt))
    .limit(5);

  for (const candidate of recent) {
    if (candidate.target?.lever === 'deload') continue;
    const lastSets = await db
      .select()
      .from(sets)
      .where(and(eq(sets.workoutExerciseId, candidate.itemId), isNull(sets.deletedAt)))
      .orderBy(asc(sets.position));
    if (lastSets.length > 0) {
      return { sets: lastSets, target: candidate.target };
    }
  }
  return { sets: [], target: null };
}

/**
 * Today's target for an exercise. Inside a plan, the slot and week set the
 * reps, sets, effort and rest; otherwise the goal's defaults apply. Today's
 * conditions (tired, a break, stagnation…) adjust it: see docs/decisoes.md §41.
 */
async function computeTarget(exercise: Exercise, workout: Workout, slotId: string | null): Promise<Target> {
  const [goal, last, recent, location, plan] = await Promise.all([
    getGoal(),
    getLastPerformance(exercise.id),
    recentScores(exercise.id),
    db.select().from(locations).where(eq(locations.id, workout.locationId)).get(),
    workout.mesocycleId
      ? db.select().from(mesocycles).where(eq(mesocycles.id, workout.mesocycleId)).get()
      : Promise.resolve(undefined),
  ]);

  const slot = plan?.plan.sessions.flatMap((session) => session.slots).find((item) => item.id === slotId);
  const weekIndex = workout.planWeek ?? 0;
  const inPlan = plan !== undefined && slot !== undefined;
  const conditions = workout.conditions;

  const base = inPlan ? slotProgressionConfig(plan.plan, slot, weekIndex) : GOAL_CONFIG[goal];
  const config = {
    ...base,
    sets: (slotId && conditions?.sets[slotId]) || base.sets,
    targetRir: Math.min(5, base.targetRir + (conditions?.effortDelta ?? 0)),
  };

  return nextTarget({
    config,
    exercise,
    lastSets: last.sets,
    lastTarget: last.target,
    maxLoadKg: maxLoadFor(exercise.equipment, location?.equipment ?? []),
    planned: inPlan,
    deload: (inPlan && plan.plan.weeks[weekIndex]?.deload === true) || Boolean(conditions?.earlyDeload),
    hold: Boolean(conditions?.hold),
    stalled: stalledSessions(recent),
  });
}

/** Scores of this exercise's recent sessions since its last deload (oldest first). */
async function recentScores(exerciseId: string): Promise<number[]> {
  const rows = await db
    .select({ itemId: workoutExercises.id, target: workoutExercises.target, startedAt: workouts.startedAt })
    .from(workoutExercises)
    .innerJoin(workouts, eq(workoutExercises.workoutId, workouts.id))
    .innerJoin(exercises, eq(workoutExercises.exerciseId, exercises.id))
    .where(
      and(
        eq(workoutExercises.exerciseId, exerciseId),
        isNull(workoutExercises.deletedAt),
        isNull(workouts.deletedAt),
        isNotNull(workouts.finishedAt)
      )
    )
    .orderBy(desc(workouts.startedAt))
    .limit(6);
  const exercise = await db.select().from(exercises).where(eq(exercises.id, exerciseId)).get();
  if (!exercise) return [];

  const scores: number[] = [];
  for (const row of rows) {
    if (row.target?.lever === 'deload') break; // count only since the last recovery
    const rowSets = await db
      .select()
      .from(sets)
      .where(and(eq(sets.workoutExerciseId, row.itemId), isNull(sets.deletedAt)));
    if (rowSets.length) scores.unshift(sessionScore({ loadType: exercise.loadType, sets: rowSets }));
  }
  return scores;
}

// ---------- Writes ----------

export type PlanLink = {
  mesocycleId: string;
  week: number;
  session: number;
  /** Every session this workout covers (more than one in a busy week). */
  covered?: number[];
  conditions?: Workout['conditions'];
};

export async function startWorkout(locationId: string, planLink?: PlanLink): Promise<string> {
  const id = newId();
  await db.insert(workouts).values({
    id,
    date: todayLocalDate(),
    locationId,
    startedAt: nowIso(),
    mesocycleId: planLink?.mesocycleId ?? null,
    planWeek: planLink?.week ?? null,
    planSession: planLink?.session ?? null,
    planSessionsCovered: planLink?.covered && planLink.covered.length > 1 ? planLink.covered : null,
    conditions: planLink?.conditions ?? null,
    ...insertStamps(),
  });
  notifyChanged('workouts');
  return id;
}

/** Adds an exercise (optionally filling a plan slot) with today's target. */
export async function addExerciseToWorkout(
  workoutId: string,
  exerciseId: string,
  slotId: string | null = null
): Promise<string> {
  const exercise = await db.select().from(exercises).where(eq(exercises.id, exerciseId)).get();
  const workout = await db.select().from(workouts).where(eq(workouts.id, workoutId)).get();
  if (!exercise || !workout) throw new Error('Exercise or workout not found');
  const target = await computeTarget(exercise, workout, slotId);

  const result = await db
    .select({ last: max(workoutExercises.position) })
    .from(workoutExercises)
    .where(eq(workoutExercises.workoutId, workoutId))
    .get();
  const id = newId();
  await db.insert(workoutExercises).values({
    id,
    workoutId,
    exerciseId,
    position: (result?.last ?? 0) + 1,
    slotId,
    target,
    ...insertStamps(),
  });
  notifyChanged('workout_exercises');
  return id;
}

/**
 * Replaces an exercise that hasn't been started (e.g. with a harder variant),
 * keeping its place and plan slot. Its target is recomputed.
 */
export async function swapExercise(workoutExerciseId: string, newExerciseId: string): Promise<void> {
  const item = await db
    .select()
    .from(workoutExercises)
    .where(eq(workoutExercises.id, workoutExerciseId))
    .get();
  const exercise = await db.select().from(exercises).where(eq(exercises.id, newExerciseId)).get();
  const workout = item
    ? await db.select().from(workouts).where(eq(workouts.id, item.workoutId)).get()
    : undefined;
  if (!item || !exercise || !workout) throw new Error('Exercise not found');
  const target = await computeTarget(exercise, workout, item.slotId);
  await db
    .update(workoutExercises)
    .set({ exerciseId: newExerciseId, target, ...updateStamps() })
    .where(eq(workoutExercises.id, workoutExerciseId));
  notifyChanged('workout_exercises');
}

export async function removeExerciseFromWorkout(workoutExerciseId: string): Promise<void> {
  await db.update(workoutExercises).set(deleteStamps()).where(eq(workoutExercises.id, workoutExerciseId));
  await db.update(sets).set(deleteStamps()).where(eq(sets.workoutExerciseId, workoutExerciseId));
  notifyChanged('workout_exercises', 'sets');
}

/** Records a finished set. Rest is measured from the previous set of the workout. */
export async function completeSet(
  workoutId: string,
  workoutExerciseId: string,
  values: SetValues
): Promise<void> {
  const now = nowIso();

  const previous = await db
    .select({ completedAt: sets.completedAt })
    .from(sets)
    .innerJoin(workoutExercises, eq(sets.workoutExerciseId, workoutExercises.id))
    .where(
      and(eq(workoutExercises.workoutId, workoutId), isNull(sets.deletedAt), isNotNull(sets.completedAt))
    )
    .orderBy(desc(sets.completedAt))
    .get();
  const restSeconds = previous?.completedAt ? secondsBetween(previous.completedAt, now) : null;

  const result = await db
    .select({ last: max(sets.position) })
    .from(sets)
    .where(eq(sets.workoutExerciseId, workoutExerciseId))
    .get();

  await db.insert(sets).values({
    id: newId(),
    workoutExerciseId,
    position: (result?.last ?? 0) + 1,
    reps: values.reps,
    weightKg: values.weightKg,
    rir: values.rir,
    restSeconds: restSeconds !== null && restSeconds <= MAX_REST_SECONDS ? restSeconds : null,
    completedAt: now,
    ...insertStamps(),
  });
  notifyChanged('sets');
}

export async function updateSet(setId: string, values: SetValues): Promise<void> {
  await db
    .update(sets)
    .set({ ...values, ...updateStamps() })
    .where(eq(sets.id, setId));
  notifyChanged('sets');
}

export async function deleteSet(setId: string): Promise<void> {
  await db.update(sets).set(deleteStamps()).where(eq(sets.id, setId));
  notifyChanged('sets');
}

/** Ends the workout. With no sets logged there's nothing to keep, so it's discarded. */
export async function finishWorkout(workoutId: string): Promise<'finished' | 'discarded'> {
  const detail = await getWorkoutDetail(workoutId);
  const hasSets = detail?.exercises.some((item) => item.sets.length > 0) ?? false;
  if (!hasSets) {
    await discardWorkout(workoutId);
    return 'discarded';
  }
  await db
    .update(workouts)
    .set({ finishedAt: nowIso(), ...updateStamps() })
    .where(eq(workouts.id, workoutId));
  notifyChanged('workouts');
  return 'finished';
}

export async function discardWorkout(workoutId: string): Promise<void> {
  const items = await db
    .select({ id: workoutExercises.id })
    .from(workoutExercises)
    .where(eq(workoutExercises.workoutId, workoutId));
  const itemIds = items.map((item) => item.id);
  if (itemIds.length) {
    await db.update(sets).set(deleteStamps()).where(inArray(sets.workoutExerciseId, itemIds));
    await db.update(workoutExercises).set(deleteStamps()).where(inArray(workoutExercises.id, itemIds));
  }
  await db.update(workouts).set(deleteStamps()).where(eq(workouts.id, workoutId));
  notifyChanged('workouts', 'workout_exercises', 'sets');
}

function secondsBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 1000);
}

// ---------- History ----------

export type WorkoutSummary = Workout & {
  locationName: string;
  exerciseCount: number;
  setCount: number;
};

/** Finished workouts, newest first, with counts for the list. */
export async function listFinishedWorkouts(): Promise<WorkoutSummary[]> {
  const rows = await db
    .select({ workout: workouts, locationName: locations.name })
    .from(workouts)
    .innerJoin(locations, eq(workouts.locationId, locations.id))
    .where(and(isNotNull(workouts.finishedAt), isNull(workouts.deletedAt)))
    .orderBy(desc(workouts.startedAt));
  if (rows.length === 0) return [];

  const ids = rows.map((row) => row.workout.id);
  const items = await db
    .select({ id: workoutExercises.id, workoutId: workoutExercises.workoutId })
    .from(workoutExercises)
    .where(and(inArray(workoutExercises.workoutId, ids), isNull(workoutExercises.deletedAt)));
  const itemIds = items.map((item) => item.id);
  const doneSets = itemIds.length
    ? await db
        .select({ workoutExerciseId: sets.workoutExerciseId })
        .from(sets)
        .where(and(inArray(sets.workoutExerciseId, itemIds), isNull(sets.deletedAt)))
    : [];

  return rows.map(({ workout, locationName }) => {
    const mine = new Set(items.filter((item) => item.workoutId === workout.id).map((item) => item.id));
    const mySets = doneSets.filter((set) => mine.has(set.workoutExerciseId));
    return {
      ...workout,
      locationName,
      // Only exercises actually done (added-but-skipped ones don't count).
      exerciseCount: new Set(mySets.map((set) => set.workoutExerciseId)).size,
      setCount: mySets.length,
    };
  });
}
