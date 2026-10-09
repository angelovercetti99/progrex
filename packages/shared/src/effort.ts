/**
 * Effort in plain words instead of RIR numbers (docs/decisoes.md §35).
 * Beginners answer "How was it?"; the app still stores reps in reserve (RIR),
 * so the progression engine keeps working with numbers.
 */

export const EFFORT_LEVELS = ['easy', 'good', 'hard', 'max'] as const;
export type EffortLevel = (typeof EFFORT_LEVELS)[number];

/** Which reps-in-reserve values each answer covers. */
const RIR_RANGE: Record<EffortLevel, { min: number; max: number; default: number }> = {
  easy: { min: 4, max: 5, default: 4 }, // "I could do 4 or more"
  good: { min: 2, max: 3, default: 2 }, // "2 or 3 left"
  hard: { min: 1, max: 1, default: 1 }, // "just 1 more"
  max: { min: 0, max: 0, default: 0 }, // "nothing left"
};

/** RIR number → the answer that describes it. */
export function effortForRir(rir: number): EffortLevel {
  if (rir >= 4) return 'easy';
  if (rir >= 2) return 'good';
  if (rir === 1) return 'hard';
  return 'max';
}

/**
 * Answer → RIR to store. "Good" covers 2–3: if the target was inside that
 * range, the user hit it, so store the target itself (keeps precision).
 */
export function rirForEffort(level: EffortLevel, targetRir: number): number {
  const range = RIR_RANGE[level];
  return targetRir >= range.min && targetRir <= range.max ? targetRir : range.default;
}

/** How hard a week is, in words: RIR 4+ light … 0 max. */
export type EffortIntensity = 'light' | 'moderate' | 'high' | 'very_high' | 'max';

export function intensityForRir(rir: number): EffortIntensity {
  if (rir >= 4) return 'light';
  if (rir === 3) return 'moderate';
  if (rir === 2) return 'high';
  if (rir === 1) return 'very_high';
  return 'max';
}
