import {
  generateMesocycle,
  selectVariant,
  validateMesocycle,
  type Mesocycle,
  type MesocycleRequest,
  type MovementPattern,
  type Slot,
} from '@progrex/shared';
import { and, desc, eq, isNotNull, isNull } from 'drizzle-orm';

import { db } from '@/db/client';
import { notifyChanged } from '@/db/live';
import {
  exercises,
  mesocycles,
  workoutExercises,
  workouts,
  type Exercise,
  type Location,
  type MesocycleRow,
} from '@/db/schema';
import { insertStamps, newId, todayLocalDate, updateStamps } from '@/db/stamps';
import { listExercises } from '@/features/exercises/queries';
import { addExerciseToWorkout, startWorkout } from '@/features/workouts/queries';
import { setGoal } from '@/lib/preferences';

export type SessionRef = { week: number; session: number };

export type PlanState = {
  mesocycle: MesocycleRow;
  /** Sessions already done, as "week-session" keys. */
  done: string[];
  /** The next session to do, or null when the block is complete. */
  next: SessionRef | null;
};

export function sessionKey({ week, session }: SessionRef): string {
  return `${week}-${session}`;
}

/** The active plan and where you are in it. Undefined = no plan. */
export async function getPlanState(): Promise<PlanState | undefined> {
  const mesocycle = await db
    .select()
    .from(mesocycles)
    .where(and(eq(mesocycles.status, 'active'), isNull(mesocycles.deletedAt)))
    .orderBy(desc(mesocycles.createdAt))
    .get();
  if (!mesocycle) return undefined;

  const finished = await db
    .select({ week: workouts.planWeek, session: workouts.planSession })
    .from(workouts)
    .where(
      and(eq(workouts.mesocycleId, mesocycle.id), isNotNull(workouts.finishedAt), isNull(workouts.deletedAt))
    );
  const done = new Set(
    finished.filter((row): row is SessionRef => row.week !== null && row.session !== null).map(sessionKey)
  );

  // Sessions are done in order: week by week, A, B, C…
  let next: SessionRef | null = null;
  outer: for (let week = 0; week < mesocycle.plan.weeks.length; week++) {
    for (let session = 0; session < mesocycle.plan.sessions.length; session++) {
      if (!done.has(sessionKey({ week, session }))) {
        next = { week, session };
        break outer;
      }
    }
  }
  return { mesocycle, done: [...done], next };
}

/** Generates, checks and saves a new plan. Any active plan is ended. */
export async function createMesocycle(request: MesocycleRequest): Promise<string> {
  const plan = generateMesocycle(request);
  const problems = validateMesocycle(plan);
  if (problems.length > 0) {
    throw new Error(`Invalid plan: ${problems.join('; ')}`);
  }

  await db
    .update(mesocycles)
    .set({ status: 'abandoned', ...updateStamps() })
    .where(eq(mesocycles.status, 'active'));

  const id = newId();
  await db.insert(mesocycles).values({
    id,
    startDate: todayLocalDate(),
    status: 'active',
    plan,
    ...insertStamps(),
  });
  await setGoal(request.goal);
  notifyChanged('mesocycles');
  return id;
}

export async function endMesocycle(id: string, status: 'completed' | 'abandoned'): Promise<void> {
  await db
    .update(mesocycles)
    .set({ status, ...updateStamps() })
    .where(eq(mesocycles.id, id));
  notifyChanged('mesocycles');
}

export type SlotChoice = { slot: Slot; exercise: Exercise | null };

/**
 * Picks an exercise for each slot of a session, for the equipment at this
 * place. Keeps the variant last used here for the same pattern (so progress
 * is comparable) and never repeats an exercise within the session.
 */
export async function chooseExercises(
  plan: Mesocycle,
  sessionIndex: number,
  location: Location
): Promise<SlotChoice[]> {
  const catalog = await listExercises();
  const lastUsedHere = await lastExercisePerPattern(location.id);
  const used = new Set<string>();
  // Beginners start with easier variants, advanced lifters with harder ones.
  const targetDifficulty = { beginner: 2, intermediate: 3, advanced: 4 }[plan.experience];

  return plan.sessions[sessionIndex].slots.map((slot) => {
    const exercise = selectVariant({
      pattern: slot.pattern,
      available: location.equipment,
      candidates: catalog.filter((candidate) => !used.has(candidate.id)),
      preferredId: lastUsedHere.get(slot.pattern) ?? null,
      targetDifficulty,
    });
    if (exercise) used.add(exercise.id);
    return { slot, exercise };
  });
}

/** Starts the plan's session: creates the workout and adds its exercises. */
export async function startPlannedWorkout(
  state: PlanState,
  ref: SessionRef,
  location: Location
): Promise<string> {
  const choices = await chooseExercises(state.mesocycle.plan, ref.session, location);
  const workoutId = await startWorkout(location.id, {
    mesocycleId: state.mesocycle.id,
    week: ref.week,
    session: ref.session,
  });
  for (const { slot, exercise } of choices) {
    if (exercise) {
      await addExerciseToWorkout(workoutId, exercise.id, slot.id);
    }
  }
  return workoutId;
}

/** For each pattern, the exercise most recently done at this place. */
async function lastExercisePerPattern(locationId: string): Promise<Map<MovementPattern, string>> {
  const rows = await db
    .select({ exerciseId: workoutExercises.exerciseId, pattern: exercises.pattern })
    .from(workoutExercises)
    .innerJoin(workouts, eq(workoutExercises.workoutId, workouts.id))
    .innerJoin(exercises, eq(workoutExercises.exerciseId, exercises.id))
    .where(
      and(
        eq(workouts.locationId, locationId),
        isNotNull(workouts.finishedAt),
        isNull(workouts.deletedAt),
        isNull(workoutExercises.deletedAt)
      )
    )
    .orderBy(desc(workouts.startedAt))
    .limit(200);

  const result = new Map<MovementPattern, string>();
  for (const row of rows) {
    if (!result.has(row.pattern)) result.set(row.pattern, row.exerciseId);
  }
  return result;
}
