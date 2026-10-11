import {
  adaptSession,
  addDays,
  generateMesocycle,
  mergeSessions,
  nextMesocycleRequest,
  planPosition,
  progrexIndex,
  selectVariant,
  sessionScore,
  shouldDeloadEarly,
  stalledSessions,
  validateMesocycle,
  type ActiveHealth,
  type AdaptedSession,
  type Experience,
  type Mesocycle,
  type MesocycleRequest,
  type MovementPattern,
  type Slot,
  type TodayConditions,
} from '@progrex/shared';
import { and, count, desc, eq, isNotNull, isNull } from 'drizzle-orm';

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
import { getActiveHealth, getHealthProfile, isExerciseAllowed } from '@/features/health/queries';
import { loadExerciseSessions } from '@/features/progress/queries';
import { addExerciseToWorkout, startWorkout } from '@/features/workouts/queries';
import { setGoal } from '@/lib/preferences';

export type SessionRef = { week: number; session: number };

export type PlanState = {
  mesocycle: MesocycleRow;
  /** Sessions already done, as "week-session" keys. */
  done: string[];
  /** The next session to do, or null when the block is complete. */
  next: SessionRef | null;
  /**
   * The session(s) the next workout covers. Usually just `[next.session]`;
   * in a busy week (more sessions left than days), several merged into one.
   */
  group: number[];
  /** Days since the last finished workout, anywhere (null = never trained). */
  daysSinceLastWorkout: number | null;
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
    .select({ week: workouts.planWeek, session: workouts.planSession, covered: workouts.planSessionsCovered })
    .from(workouts)
    .where(
      and(eq(workouts.mesocycleId, mesocycle.id), isNotNull(workouts.finishedAt), isNull(workouts.deletedAt))
    );
  const done = new Set<string>();
  for (const row of finished) {
    if (row.week === null || row.session === null) continue;
    for (const session of row.covered ?? [row.session]) done.add(sessionKey({ week: row.week, session }));
  }

  // Next session + merging in a busy week: a pure, tested function (packages/shared/src/adapt).
  const today = todayLocalDate();
  const { next, group } = planPosition(mesocycle.plan, done, mesocycle.startDate, today);

  const last = await db
    .select({ date: workouts.date })
    .from(workouts)
    .where(and(isNotNull(workouts.finishedAt), isNull(workouts.deletedAt)))
    .orderBy(desc(workouts.date))
    .get();
  const daysSinceLastWorkout = last
    ? Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${last.date}T00:00:00Z`)) / 86_400_000)
    : null;

  return { mesocycle, done: [...done], next, group, daysSinceLastWorkout };
}

/** Generates, checks and saves a new plan. Any active plan is ended. */
export async function createMesocycle(request: MesocycleRequest): Promise<string> {
  // Health conditions carry over by themselves (§50): nobody re-enters them.
  const health = request.health ?? (await getHealthProfile());
  const plan = generateMesocycle({
    ...request,
    health: health.conditions.length ? health : undefined,
    startDate: request.startDate ?? todayLocalDate(),
  });
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

/** The block that was just completed: how many sessions, places and how much progress. */
export type BlockSummary = { workouts: number; places: number; index: number | null };

export async function getBlockSummary(mesocycle: MesocycleRow): Promise<BlockSummary> {
  const rows = await db
    .select({ locationId: workouts.locationId })
    .from(workouts)
    .where(
      and(eq(workouts.mesocycleId, mesocycle.id), isNotNull(workouts.finishedAt), isNull(workouts.deletedAt))
    );
  const sessions = await loadExerciseSessions(mesocycle.startDate);
  return {
    workouts: rows.length,
    places: new Set(rows.map((row) => row.locationId)).size,
    index: progrexIndex(sessions, mesocycle.startDate, todayLocalDate()),
  };
}

/** The most recent plan, whatever its status: its choices pre-fill the next one. */
export async function getLastPlan(): Promise<Mesocycle | undefined> {
  const row = await db
    .select({ plan: mesocycles.plan })
    .from(mesocycles)
    .where(isNull(mesocycles.deletedAt))
    .orderBy(desc(mesocycles.createdAt))
    .get();
  return row?.plan;
}

/** One tap at the end of a block: close it and start the next with the same choices. */
export async function startNextBlock(state: PlanState): Promise<string> {
  await endMesocycle(state.mesocycle.id, 'completed');
  const completed = await db
    .select({ n: count() })
    .from(mesocycles)
    .where(and(eq(mesocycles.status, 'completed'), isNull(mesocycles.deletedAt)))
    .get();
  return createMesocycle(nextMesocycleRequest(state.mesocycle.plan, completed?.n ?? 1, todayLocalDate()));
}

export type SlotChoice = { slot: Slot; exercise: Exercise | null };

/**
 * Picks an exercise for each slot, for the equipment at this place. Keeps the
 * variant last used here for the same pattern (so progress is comparable) and
 * never repeats an exercise within the session. With health conditions, only
 * safe exercises are candidates (§50).
 */
export async function chooseExercises(
  slots: Slot[],
  experience: Experience,
  location: Location,
  health?: ActiveHealth
): Promise<SlotChoice[]> {
  const all = await listExercises();
  const catalog = health ? all.filter((exercise) => isExerciseAllowed(exercise, health)) : all;
  const lastUsedHere = await lastExercisePerPattern(location.id);
  const used = new Set<string>();
  // Beginners start with easier variants, advanced lifters with harder ones.
  const targetDifficulty = { beginner: 2, intermediate: 3, advanced: 4 }[experience];

  return slots.map((slot) => {
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

/** The plan's slots for the next workout (merged when the week is busy). */
export function slotsForGroup(plan: Mesocycle, group: number[]): Slot[] {
  return group.length > 1 ? mergeSessions(plan, group) : (plan.sessions[group[0]]?.slots ?? []);
}

export type TodayPlan = {
  adapted: AdaptedSession;
  health: ActiveHealth;
  earlyDeload: boolean;
  choices: SlotChoice[];
};

/**
 * Today's session, adapted to your conditions: what you told us (time, tired,
 * pain) plus what we infer (a break, a busy week, stagnation).
 */
export async function prepareToday(
  state: PlanState,
  location: Location,
  conditions: TodayConditions
): Promise<TodayPlan> {
  const { plan } = state.mesocycle;
  const week = state.next?.week ?? 0;
  const health = await getActiveHealth();
  const adapted = adaptSession({
    slots: slotsForGroup(plan, state.group),
    plan,
    ...conditions,
    daysSinceLastWorkout: state.daysSinceLastWorkout,
    health,
  });
  if (state.group.length > 1) adapted.reasons.unshift('compressed');

  const earlyDeload = !plan.weeks[week]?.deload && (await isStagnating());
  if (earlyDeload) adapted.reasons.push('early_deload');

  return {
    adapted,
    health,
    earlyDeload,
    choices: await chooseExercises(adapted.slots, plan.experience, location, health),
  };
}

/** Starts today's session: creates the workout (with how it was adapted) and adds its exercises. */
export async function startPlannedWorkout(
  state: PlanState,
  location: Location,
  conditions: TodayConditions
): Promise<string> {
  if (!state.next) throw new Error('The plan is complete');
  const today = await prepareToday(state, location, conditions);
  const workoutId = await startWorkout(location.id, {
    mesocycleId: state.mesocycle.id,
    week: state.next.week,
    session: state.group[0],
    covered: state.group,
    conditions: {
      ...conditions,
      reasons: today.adapted.reasons,
      hold: today.adapted.hold,
      effortDelta: today.adapted.effortDelta,
      earlyDeload: today.earlyDeload,
      sets: Object.fromEntries(
        today.adapted.slots.map((slot) => [
          slot.id,
          slot.setsPerWeek[state.next!.week] ?? slot.setsPerWeek[0],
        ])
      ),
    },
  });
  for (const { slot, exercise } of today.choices) {
    if (exercise) {
      await addExerciseToWorkout(workoutId, exercise.id, slot.id);
    }
  }
  return workoutId;
}

/**
 * Most exercises stuck at once (since their last recovery) = accumulated
 * fatigue: recover early. Looks at the last 4 weeks.
 */
export async function isStagnating(): Promise<boolean> {
  const sessions = await loadExerciseSessions(addDays(todayLocalDate(), -28));
  const byExercise = new Map<string, number[]>();
  for (const session of sessions) {
    if (session.sets.length === 0) continue;
    // A deload resets the count: progress is measured again from there.
    if (session.deload) {
      byExercise.set(session.exerciseId, []);
      continue;
    }
    byExercise.set(session.exerciseId, [
      ...(byExercise.get(session.exerciseId) ?? []),
      sessionScore(session),
    ]);
  }
  const stalled = [...byExercise.values()].filter((scores) => scores.length >= 2).map(stalledSessions);
  return shouldDeloadEarly(stalled);
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
