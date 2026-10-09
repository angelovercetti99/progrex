import { PLATEAU_SESSIONS } from '../progression/engine';
import { fitToTime } from '../plan/generate';
import type { BodyArea, Mesocycle, Slot } from '../plan/schema';
import type { MovementPattern } from '../training';

/**
 * The plan adapts to your conditions TODAY, whatever they are
 * (docs/decisoes.md §41). Convenience first: most conditions are inferred
 * (breaks, stagnation, a busy week); the user only taps for what the app
 * can't know (little time, tired, pain). Pure functions, like the engine.
 */

/** What the user may tell us today. Everything is optional: a normal day is nothing. */
export type TodayConditions = {
  /** "I only have N minutes". Null = the plan's usual length. */
  minutes?: number | null;
  /** "I'm tired / slept badly". */
  tired?: boolean;
  /** Areas that hurt today. */
  painAreas?: BodyArea[];
};

export type AdaptReason =
  'pain' | 'short_time' | 'tired' | 'comeback' | 'long_break' | 'compressed' | 'early_deload';

export type AdaptedSession = {
  slots: Slot[];
  /** Slots left out today, and why. */
  removed: { slot: Slot; reason: 'pain' | 'time' }[];
  /** Repeat last time instead of progressing. */
  hold: boolean;
  /** Extra reps in reserve on today's targets (easier day). */
  effortDelta: number;
  /** Everything that changed, to explain it in one line each. */
  reasons: AdaptReason[];
};

/**
 * Movements that load each area. Wider than the training map on purpose:
 * with pain, be conservative (a sore shoulder also dislikes bench press).
 */
export const PAIN_PATTERNS: Record<BodyArea, MovementPattern[]> = {
  chest: ['horizontal_push'],
  back: ['hinge', 'squat', 'horizontal_pull'],
  shoulders: ['vertical_push', 'horizontal_push', 'lateral_delts', 'vertical_pull'],
  arms: ['biceps', 'triceps'],
  core: ['core'],
  glutes: ['glutes', 'hinge', 'lunge'],
  legs: ['squat', 'lunge', 'hinge', 'calves'],
  calves: ['calves'],
};

/** A week or more without training: hold progress. Two weeks or more: an easier re-entry. */
export const COMEBACK_DAYS = 7;
export const LONG_BREAK_DAYS = 14;

export type AdaptInput = TodayConditions & {
  slots: Slot[];
  plan: Pick<Mesocycle, 'sessionMinutes' | 'restSeconds'>;
  /** Days since the last finished workout (null = first workout ever). */
  daysSinceLastWorkout?: number | null;
};

export function adaptSession({
  slots,
  plan,
  minutes = null,
  tired = false,
  painAreas = [],
  daysSinceLastWorkout = null,
}: AdaptInput): AdaptedSession {
  const reasons: AdaptReason[] = [];
  const removed: AdaptedSession['removed'] = [];
  let hold = false;
  let effortDelta = 0;

  // 1. Pain: leave out what loads the sore area; keep training the rest.
  const avoid = new Set(painAreas.flatMap((area) => PAIN_PATTERNS[area]));
  let kept = slots.filter((slot) => {
    if (!avoid.has(slot.pattern)) return true;
    removed.push({ slot, reason: 'pain' });
    return false;
  });
  if (removed.length) reasons.push('pain');

  // 2. A break: no progression today; after a long one, also fewer and easier sets.
  if (daysSinceLastWorkout !== null && daysSinceLastWorkout >= LONG_BREAK_DAYS) {
    hold = true;
    effortDelta = Math.max(effortDelta, 1);
    kept = kept.map((slot) => ({
      ...slot,
      setsPerWeek: slot.setsPerWeek.map((sets) => Math.max(slot.main ? 2 : 1, sets - 1)),
    }));
    reasons.push('long_break');
  } else if (daysSinceLastWorkout !== null && daysSinceLastWorkout >= COMEBACK_DAYS) {
    hold = true;
    reasons.push('comeback');
  }

  // 3. Tired: same work as last time, a bit further from failure.
  if (tired) {
    hold = true;
    effortDelta = Math.max(effortDelta, 1);
    reasons.push('tired');
  }

  // 4. Little time: the usual trimming rules, with today's minutes.
  if (minutes !== null && minutes < plan.sessionMinutes) {
    const trimmed = fitToTime(kept, minutes, plan.restSeconds);
    const ids = new Set(trimmed.map((slot) => slot.id));
    kept.filter((slot) => !ids.has(slot.id)).forEach((slot) => removed.push({ slot, reason: 'time' }));
    kept = trimmed;
    reasons.push('short_time');
  }

  return { slots: kept, removed, hold, effortDelta, reasons };
}

// ---------- A busy week: merge sessions (automatic) ----------

/**
 * Split the sessions still to do this week into the days left, in order.
 * 3 sessions, 2 days → [[a, b], [c]]. Enough days → one each (no change).
 */
export function groupSessions(remaining: number[], daysLeft: number): number[][] {
  const days = Math.max(1, Math.min(daysLeft, remaining.length));
  const groups: number[][] = [];
  let start = 0;
  for (let day = 0; day < days; day++) {
    const size = Math.ceil((remaining.length - start) / (days - day));
    groups.push(remaining.slice(start, start + size));
    start += size;
  }
  return groups;
}

/**
 * One session from several: main movements first (each pattern once), then
 * prioritised isolation, then the rest, trimmed to the usual length.
 */
export function mergeSessions(
  plan: Pick<Mesocycle, 'sessions' | 'sessionMinutes' | 'restSeconds'>,
  indices: number[]
): Slot[] {
  const all = indices.flatMap((index) => plan.sessions[index].slots);
  const ordered = [
    ...all.filter((slot) => slot.main),
    ...all.filter((slot) => !slot.main && slot.priority),
    ...all.filter((slot) => !slot.main && !slot.priority),
  ];
  const seen = new Set<MovementPattern>();
  const unique = ordered.filter((slot) => {
    if (seen.has(slot.pattern)) return false;
    seen.add(slot.pattern);
    return true;
  });
  return fitToTime(unique, plan.sessionMinutes, plan.restSeconds);
}

/** Days left in a plan week (today included). 0 or less = the week is already over. */
export function daysLeftInPlanWeek(startDate: string, week: number, today: string): number {
  const end = Date.parse(`${startDate}T00:00:00Z`) + (week + 1) * 7 * 86_400_000;
  return Math.round((end - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}

// ---------- Stagnation across the plan (automatic) ----------

/**
 * Most exercises stuck at once is a sign of accumulated fatigue, not of each
 * exercise: recover early instead of waiting for the planned deload.
 */
export function shouldDeloadEarly(stalledByExercise: number[]): boolean {
  if (stalledByExercise.length < 4) return false;
  const stuck = stalledByExercise.filter((stalled) => stalled >= PLATEAU_SESSIONS).length;
  return stuck / stalledByExercise.length >= 0.5;
}

// ---------- Where you are in the plan ----------

export type PlanPosition = {
  /** The next session to do (week + session index), or null when the block is complete. */
  next: { week: number; session: number } | null;
  /** The session(s) the next workout covers (several in a busy week). */
  group: number[];
};

/**
 * The next workout of a plan. Sessions are done in order; a week with more
 * sessions left than days left merges them, so you never fall behind.
 * `done` holds "week-session" keys.
 */
export function planPosition(
  plan: Pick<Mesocycle, 'weeks' | 'sessions'>,
  done: ReadonlySet<string>,
  startDate: string,
  today: string
): PlanPosition {
  const key = (week: number, session: number) => `${week}-${session}`;
  for (let week = 0; week < plan.weeks.length; week++) {
    const remaining = plan.sessions.map((_, index) => index).filter((index) => !done.has(key(week, index)));
    if (remaining.length === 0) continue;
    const daysLeft = daysLeftInPlanWeek(startDate, week, today);
    return { next: { week, session: remaining[0] }, group: groupSessions(remaining, daysLeft)[0] };
  }
  return { next: null, group: [] };
}
