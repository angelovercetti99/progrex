import {
  addDays,
  countHardSets,
  hardSetsByFamily,
  leverCounts,
  patternChange,
  patternChanges,
  progrexIndex,
  sessionScore,
  stimulusRatio,
  weekStart,
  type ExerciseSession,
  type MovementPattern,
  type PatternFamily,
  type PatternProgress,
  type ProgressLever,
} from '@progrex/shared';
import { and, eq, gte, inArray, isNotNull, isNull } from 'drizzle-orm';

import { db } from '@/db/client';
import { exercises, locations, sets, workoutExercises, workouts, type Exercise } from '@/db/schema';
import { todayLocalDate } from '@/db/stamps';

/** How many weeks the Progress screen looks at. */
export const PROGRESS_WEEKS = 8;
/** Weeks used as "your usual" when comparing stimulus. */
const USUAL_WEEKS = 4;

/** Finished workouts since a date, as one entry per exercise (the metrics' input). */
export async function loadExerciseSessions(since: string): Promise<ExerciseSession[]> {
  const rows = await db
    .select({ item: workoutExercises, workout: workouts, exercise: exercises })
    .from(workoutExercises)
    .innerJoin(workouts, eq(workoutExercises.workoutId, workouts.id))
    .innerJoin(exercises, eq(workoutExercises.exerciseId, exercises.id))
    .where(
      and(
        isNotNull(workouts.finishedAt),
        isNull(workouts.deletedAt),
        isNull(workoutExercises.deletedAt),
        gte(workouts.date, since)
      )
    );
  if (rows.length === 0) return [];

  const setRows = await db
    .select()
    .from(sets)
    .where(
      and(
        inArray(
          sets.workoutExerciseId,
          rows.map((row) => row.item.id)
        ),
        isNull(sets.deletedAt),
        isNotNull(sets.completedAt)
      )
    );

  const result: ExerciseSession[] = rows.map(({ item, workout, exercise }) => ({
    workoutId: workout.id,
    date: workout.date,
    startedAt: workout.startedAt,
    locationId: workout.locationId,
    exerciseId: exercise.id,
    pattern: exercise.pattern,
    loadType: exercise.loadType,
    tempo: Boolean(item.target?.tempoEccentricSeconds),
    deload: item.target?.lever === 'deload',
    lever: item.target?.lever ?? null,
    sets: setRows
      .filter((set) => set.workoutExerciseId === item.id)
      .sort((a, b) => a.position - b.position)
      .map((set) => ({ reps: set.reps, weightKg: set.weightKg, rir: set.rir })),
  }));
  // Oldest first: the metrics read sessions in order.
  return result.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}

export type WeekSummary = {
  start: string;
  /** Progrex Index from the window start up to the end of this week. */
  index: number | null;
  hardSets: number;
  /** Where most of this week's training happened. */
  locationId: string | null;
};

export type PatternRow = PatternProgress & { series: (number | null)[] };

export type ProgressOverview = {
  hasData: boolean;
  index: number | null;
  weeks: WeekSummary[];
  stimulus: {
    ratio: number | null;
    thisWeek: Record<PatternFamily, number>;
    usual: Record<PatternFamily, number> | null;
    locationId: string | null;
  };
  patterns: PatternRow[];
  levers: Record<ProgressLever, number>;
  exerciseNames: Map<string, Pick<Exercise, 'name' | 'nameKey'>>;
  locationNames: Map<string, string>;
};

/** Everything the Progress screen shows, for the last 8 weeks. */
export async function getProgressOverview(): Promise<ProgressOverview> {
  const today = todayLocalDate();
  const thisWeek = weekStart(today);
  const from = addDays(thisWeek, -7 * (PROGRESS_WEEKS - 1));
  const sessions = await loadExerciseSessions(addDays(from, -7 * USUAL_WEEKS));
  const windowSessions = sessions.filter((session) => session.date >= from);

  const weekStarts = Array.from({ length: PROGRESS_WEEKS }, (_, i) => addDays(from, 7 * i));
  const weekEnd = (start: string) => addDays(start, 6);
  const inWeek = (start: string) => (session: ExerciseSession) =>
    session.date >= start && session.date <= weekEnd(start);

  const weeks: WeekSummary[] = weekStarts.map((start) => {
    const mine = sessions.filter(inWeek(start));
    return {
      start,
      index: progrexIndex(windowSessions, from, weekEnd(start)),
      hardSets: countHardSets(mine),
      locationId: mostFrequent(mine.map((session) => session.locationId)),
    };
  });

  // Stimulus: this week vs the average of the previous weeks that had training.
  const current = sessions.filter(inWeek(thisWeek));
  const previousWeeks = Array.from({ length: USUAL_WEEKS }, (_, i) => addDays(thisWeek, -7 * (i + 1)));
  const previousTotals = previousWeeks.map((start) => countHardSets(sessions.filter(inWeek(start))));
  const trainedWeeks = previousWeeks.filter((_, i) => previousTotals[i] > 0);
  const usual = trainedWeeks.length
    ? averageFamilies(trainedWeeks.map((start) => hardSetsByFamily(sessions.filter(inWeek(start)))))
    : null;

  const patterns: PatternRow[] = patternChanges(windowSessions, from, today).map((progress) => {
    const mine = windowSessions.filter((session) => session.pattern === progress.pattern);
    return { ...progress, series: weekStarts.map((start) => patternChange(mine, from, weekEnd(start))) };
  });

  const [exerciseRows, locationRows] = await Promise.all([
    db.select({ id: exercises.id, name: exercises.name, nameKey: exercises.nameKey }).from(exercises),
    db.select({ id: locations.id, name: locations.name }).from(locations),
  ]);

  return {
    hasData: windowSessions.length > 0,
    index: progrexIndex(windowSessions, from, today),
    weeks,
    stimulus: {
      ratio: stimulusRatio(countHardSets(current), previousTotals),
      thisWeek: hardSetsByFamily(current),
      usual,
      locationId: mostFrequent(current.map((session) => session.locationId)),
    },
    patterns,
    levers: leverCounts(windowSessions),
    exerciseNames: new Map(exerciseRows.map((row) => [row.id, row])),
    locationNames: new Map(locationRows.map((row) => [row.id, row.name])),
  };
}

// ---------- Workout summary ----------

export type ExerciseResult = {
  exerciseId: string;
  reps: number[];
  /** vs the last time this exercise was done; null = first time. */
  change: number | null;
  /** Extra reps vs last time, when the weight was the same (easier to read than %). */
  repsDelta: number | null;
  personalBest: boolean;
};

export type WorkoutSummaryData = {
  hardSets: number;
  /** This workout's hard sets vs your recent workouts. */
  stimulus: number | null;
  /** How much this workout moved the Progrex Index. */
  indexDelta: number | null;
  personalBests: number;
  /** True when trained somewhere other than where you usually train. */
  away: boolean;
  results: ExerciseResult[];
  /** Movements that improved today, best first. */
  improved: { pattern: MovementPattern; change: number }[];
};

export async function getWorkoutSummary(workoutId: string): Promise<WorkoutSummaryData | undefined> {
  const today = todayLocalDate();
  const from = addDays(weekStart(today), -7 * (PROGRESS_WEEKS - 1));
  const sessions = await loadExerciseSessions(addDays(from, -7 * USUAL_WEEKS));
  const mine = sessions.filter((session) => session.workoutId === workoutId);
  if (mine.length === 0) return undefined;
  const before = sessions.filter(
    (session) => session.workoutId !== workoutId && session.startedAt < mine[0].startedAt
  );

  // Hard sets vs the average of the last 8 workouts.
  const recentWorkouts = [...new Set(before.map((session) => session.workoutId))].slice(-8);
  const recentTotals = recentWorkouts.map((id) => countHardSets(before.filter((s) => s.workoutId === id)));

  const results: ExerciseResult[] = mine
    .filter((session) => session.sets.length > 0)
    .map((session) => {
      const history = before.filter((item) => item.exerciseId === session.exerciseId && item.sets.length > 0);
      const score = sessionScore(session);
      const last = history.at(-1);
      const best = Math.max(0, ...history.map(sessionScore));
      const total = (list: typeof session.sets) => list.reduce((sum, set) => sum + set.reps, 0);
      const sameWeight = last !== undefined && last.sets[0]?.weightKg === session.sets[0]?.weightKg;
      return {
        exerciseId: session.exerciseId,
        reps: session.sets.map((set) => set.reps),
        change: last ? score / sessionScore(last) - 1 : null,
        repsDelta: last && sameWeight ? total(session.sets) - total(last.sets) : null,
        personalBest: history.length > 0 && score > best,
      };
    });

  const indexBefore = progrexIndex(before, from, today);
  const indexAfter = progrexIndex([...before, ...mine], from, today);
  const usualLocation = mostFrequent(before.map((session) => session.locationId));

  // Movements that improved today, judged like the rows below: each exercise vs its last time.
  const improved = results
    .filter((result) => result.change !== null && result.change > 0)
    .map((result) => ({
      pattern: mine.find((session) => session.exerciseId === result.exerciseId)!.pattern,
      change: result.change as number,
    }))
    .sort((a, b) => b.change - a.change);

  return {
    hardSets: countHardSets(mine),
    stimulus: stimulusRatio(countHardSets(mine), recentTotals),
    indexDelta: indexBefore !== null && indexAfter !== null ? indexAfter - indexBefore : null,
    personalBests: results.filter((result) => result.personalBest).length,
    away: usualLocation !== null && usualLocation !== mine[0].locationId,
    results,
    improved,
  };
}

function mostFrequent(values: string[]): string | null {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  let best: string | null = null;
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

function averageFamilies(list: Record<PatternFamily, number>[]): Record<PatternFamily, number> {
  const total: Record<PatternFamily, number> = { push: 0, pull: 0, legs: 0, core: 0 };
  for (const item of list) {
    for (const key of Object.keys(total) as PatternFamily[]) total[key] += item[key];
  }
  for (const key of Object.keys(total) as PatternFamily[]) total[key] = Math.round(total[key] / list.length);
  return total;
}
