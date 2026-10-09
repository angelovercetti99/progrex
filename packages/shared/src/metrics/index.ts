import type { LoadType, MovementPattern } from '../training';

/**
 * Progress metrics that survive a change of place (docs/decisoes.md §37).
 * Other apps chart progress per exercise; we chart it per MOVEMENT, so a week
 * of push-ups in a hotel and bench press at the gym feed the same line.
 * Everything here is a pure function.
 */

// ---------- Inputs ----------

export type MetricSet = { reps: number; weightKg: number | null; rir: number | null };

/** One exercise as done in one finished workout. */
export type ExerciseSession = {
  workoutId?: string;
  /** `YYYY-MM-DD` */
  date: string;
  /** Ordering within the same day. */
  startedAt: string;
  locationId: string;
  exerciseId: string;
  pattern: MovementPattern;
  loadType: LoadType;
  /** Slow-tempo prescription changes the exercise, like a new variant. */
  tempo: boolean;
  /** Deload sessions are easy on purpose: never used to measure progress. */
  deload: boolean;
  /** The lever the engine used for this session (if any). */
  lever: string | null;
  sets: MetricSet[];
};

// ---------- Performance of one session ----------

/** A set counts as "hard" when it ended close to failure (≤ 3 reps in reserve). */
export const HARD_SET_MAX_RIR = 3;
/** Unknown effort is assumed to be the usual target. */
const DEFAULT_RIR = 2;

export function isHardSet(set: MetricSet): boolean {
  return (set.rir ?? DEFAULT_RIR) <= HARD_SET_MAX_RIR;
}

/**
 * How strong a set shows you are, comparable only within the same exercise.
 * Both cases use the Epley formula (1RM ≈ load × (1 + reps/30)), counting the
 * reps you had left:
 * - with load: an estimated 1-rep max, in kg;
 * - without load: the same formula with your body as the (constant) load, so
 *   10 → 15 push-ups reads as ~+12%, in line with loaded exercises (not +50%).
 */
export function setScore(set: MetricSet, loadType: LoadType): number {
  const capacity = set.reps + (set.rir ?? DEFAULT_RIR);
  const load = loadType === 'external' && set.weightKg ? set.weightKg : 1;
  return load * (1 + capacity / 30);
}

/** The session's performance = its best set. */
export function sessionScore(session: Pick<ExerciseSession, 'sets' | 'loadType'>): number {
  return Math.max(0, ...session.sets.map((set) => setScore(set, session.loadType)));
}

// ---------- Progress per movement ----------

/** Sessions that can measure progress: finished, with sets, not a deload. */
function measurable(sessions: ExerciseSession[]): ExerciseSession[] {
  return sessions.filter(
    (session) => !session.deload && session.sets.length > 0 && sessionScore(session) > 0
  );
}

function variantKey(session: ExerciseSession): string {
  return `${session.exerciseId}|${session.tempo ? 'tempo' : 'normal'}`;
}

function inWindow(session: ExerciseSession, from: string, to: string): boolean {
  return session.date >= from && session.date <= to;
}

/**
 * How much a movement improved between two dates.
 *
 * 1. Every exercise is compared ONLY with itself: its last session vs its first
 *    in the period. A slower tempo counts as a different exercise (its reps drop
 *    on purpose).
 * 2. The movement adds up its exercises' progress and divides by the time each
 *    one was trained, then scales to the period. In practice:
 *    - gym for 7 weeks (+10%), then a hotel week (+3%): +13% — progress carries on;
 *    - home and gym alternating over the same weeks (+2% each): +2%, not +4%;
 *    - a session better than the last one never lowers it.
 *    (A plain or session-weighted average was tried first: an exercise measured
 *    over 2 days next to one measured over 8 weeks dragged the result down.)
 *
 * Null = not enough data (an exercise needs 2 sessions in the period).
 */
export function patternChange(sessions: ExerciseSession[], from: string, to: string): number | null {
  const ordered = measurable(sessions)
    .filter((item) => inWindow(item, from, to))
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const byVariant = new Map<string, ExerciseSession[]>();
  for (const session of ordered) {
    const list = byVariant.get(variantKey(session)) ?? [];
    list.push(session);
    byVariant.set(variantKey(session), list);
  }

  let totalChange = 0;
  let totalDays = 0;
  let first: string | null = null;
  let last: string | null = null;
  for (const list of byVariant.values()) {
    if (list.length < 2) continue;
    const start = list[0];
    const end = list[list.length - 1];
    totalChange += sessionScore(end) / sessionScore(start) - 1;
    totalDays += Math.max(1, daysBetween(start.date, end.date));
    if (first === null || start.date < first) first = start.date;
    if (last === null || end.date > last) last = end.date;
  }
  if (totalDays === 0 || first === null || last === null) return null;
  // Progress per day of training, over the days this movement was measured.
  return (totalChange / totalDays) * Math.max(1, daysBetween(first, last));
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export type PatternProgress = {
  pattern: MovementPattern;
  change: number;
  /** Exercises that fed this movement in the period. */
  exerciseIds: string[];
};

export function patternChanges(sessions: ExerciseSession[], from: string, to: string): PatternProgress[] {
  const patterns = [...new Set(sessions.map((session) => session.pattern))];
  const result: PatternProgress[] = [];
  for (const pattern of patterns) {
    const mine = sessions.filter((session) => session.pattern === pattern);
    const change = patternChange(mine, from, to);
    if (change === null) continue;
    const exerciseIds = [
      ...new Set(
        measurable(mine)
          .filter((s) => inWindow(s, from, to))
          .map((s) => s.exerciseId)
      ),
    ];
    result.push({ pattern, change, exerciseIds });
  }
  return result.sort((a, b) => b.change - a.change);
}

/**
 * The Progrex Index: the average change across movements in the period.
 * One number for "am I getting stronger?", wherever you trained.
 */
export function progrexIndex(sessions: ExerciseSession[], from: string, to: string): number | null {
  const changes = patternChanges(sessions, from, to);
  if (changes.length === 0) return null;
  return changes.reduce((sum, item) => sum + item.change, 0) / changes.length;
}

/** The index measured from `from` up to the end of each week: a line that shows the trend. */
export function progrexIndexSeries(
  sessions: ExerciseSession[],
  from: string,
  weekEnds: string[]
): (number | null)[] {
  return weekEnds.map((end) => progrexIndex(sessions, from, end));
}

// ---------- Stimulus (hard sets) ----------

export const PATTERN_FAMILIES = ['push', 'pull', 'legs', 'core'] as const;
export type PatternFamily = (typeof PATTERN_FAMILIES)[number];

const FAMILY: Record<MovementPattern, PatternFamily> = {
  horizontal_push: 'push',
  vertical_push: 'push',
  triceps: 'push',
  lateral_delts: 'push',
  horizontal_pull: 'pull',
  vertical_pull: 'pull',
  biceps: 'pull',
  squat: 'legs',
  hinge: 'legs',
  lunge: 'legs',
  glutes: 'legs',
  calves: 'legs',
  core: 'core',
};

export function familyOf(pattern: MovementPattern): PatternFamily {
  return FAMILY[pattern];
}

/** Hard sets per family in a set of sessions. */
export function hardSetsByFamily(sessions: ExerciseSession[]): Record<PatternFamily, number> {
  const totals: Record<PatternFamily, number> = { push: 0, pull: 0, legs: 0, core: 0 };
  for (const session of sessions) {
    if (session.deload) continue;
    totals[FAMILY[session.pattern]] += session.sets.filter(isHardSet).length;
  }
  return totals;
}

export function countHardSets(sessions: ExerciseSession[]): number {
  return Object.values(hardSetsByFamily(sessions)).reduce((sum, value) => sum + value, 0);
}

/**
 * Stimulus kept: this period's hard sets vs your usual (average of the
 * previous periods that had training). Null when there's no history yet.
 */
export function stimulusRatio(current: number, previous: number[]): number | null {
  const trained = previous.filter((value) => value > 0);
  if (trained.length === 0) return null;
  const average = trained.reduce((sum, value) => sum + value, 0) / trained.length;
  return average > 0 ? current / average : null;
}

// ---------- Levers ----------

const PROGRESS_LEVERS = ['load', 'reps', 'rest', 'tempo', 'sets', 'variant'] as const;
export type ProgressLever = (typeof PROGRESS_LEVERS)[number];

/** How often each progression lever was used. Calibration, deloads etc. don't count. */
export function leverCounts(sessions: ExerciseSession[]): Record<ProgressLever, number> {
  const counts = Object.fromEntries(PROGRESS_LEVERS.map((lever) => [lever, 0])) as Record<
    ProgressLever,
    number
  >;
  for (const session of sessions) {
    if (session.lever && (PROGRESS_LEVERS as readonly string[]).includes(session.lever)) {
      counts[session.lever as ProgressLever] += 1;
    }
  }
  return counts;
}

// ---------- Dates ----------

/** Monday of the week of a `YYYY-MM-DD` date (weeks start on Monday). */
export function weekStart(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const value = new Date(Date.UTC(year, month - 1, day));
  const weekday = (value.getUTCDay() + 6) % 7; // Monday = 0
  value.setUTCDate(value.getUTCDate() - weekday);
  return value.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const value = new Date(Date.UTC(year, month - 1, day + days));
  return value.toISOString().slice(0, 10);
}
