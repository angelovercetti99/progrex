import type { PerformedSet, Target } from './engine';

/**
 * The values a new set starts with, so a set that goes as planned is ONE tap
 * (docs/decisoes.md §27). Used by the phone and by the watch (§52).
 */

export type SetValues = { reps: number; weightKg: number | null; rir: number | null };

/** With no target and no history: a reasonable first guess. */
export const DEFAULT_SET = { reps: 10, rir: 2 } as const;

/** Today's last set fell 2+ reps short of its target: not your day for this one. */
export function fellShort(target: Target | null, today: readonly PerformedSet[]): boolean {
  const index = today.length - 1;
  const planned = index >= 0 ? target?.sets[index] : undefined;
  return planned !== undefined && today[index].reps <= planned.reps - 2;
}

/**
 * - Weight: the weight you chose today wins; else the target; else last time.
 * - Reps: the target for this set (that's where "+1 rep" lives), except when
 *   calibrating, or when the last set today fell 2+ reps short: then follow
 *   what you actually did (auto-regulation, no question asked).
 * - Effort: the target's.
 */
export function suggestSet({
  target,
  today,
  last,
  usesWeight,
}: {
  target: Target | null;
  /** Sets already done today, in order. */
  today: readonly PerformedSet[];
  /** Sets of the last session of this exercise. */
  last: readonly PerformedSet[];
  usesWeight: boolean;
}): SetValues {
  const index = today.length;
  const previousToday = today.at(-1);
  const previous = previousToday ?? last[index] ?? last.at(-1);
  const planned = target?.sets[index];
  if (planned) {
    const followToday = (target?.lever === 'calibrate' || fellShort(target, today)) && previousToday;
    return {
      reps: followToday ? previousToday.reps : planned.reps,
      weightKg: previousToday?.weightKg ?? planned.weightKg ?? previous?.weightKg ?? (usesWeight ? 0 : null),
      rir: planned.rir,
    };
  }
  if (previous) {
    return { reps: previous.reps, weightKg: previous.weightKg, rir: previous.rir ?? DEFAULT_SET.rir };
  }
  return { ...DEFAULT_SET, weightKg: usesWeight ? 0 : null };
}
