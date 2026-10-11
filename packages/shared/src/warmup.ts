import type { EquipmentType, LoadType, MovementPattern } from './training';

/**
 * Two helpers for heavy lifts that the app can work out on its own, so nobody
 * has to do sums between sets (docs/decisoes.md §49):
 * - warm-up sets, calculated from today's working weight;
 * - which plates go on each side of the bar.
 */

export type WarmupSet = { weightKg: number; reps: number };

/** An Olympic bar weighs 20 kg. */
export const BAR_KG = 20;

/** Plates of a normal gym, heaviest first. */
export const STANDARD_PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25] as const;

/** Below this, the working sets are their own warm-up. */
const MIN_WARMUP_KG = 15;
/** From here, one more (lighter) warm-up step. */
const HEAVY_KG = 60;

/**
 * Warm-up steps before the working sets: lighter and fewer reps as the weight
 * rises, so the warm-up prepares without tiring.
 * - 15–59 kg: 50% × 8, 75% × 3
 * - 60 kg or more: 40% × 8, 60% × 5, 80% × 2
 * Weights are rounded down to the exercise's step (and never below the bar).
 */
export function warmupSets({
  workKg,
  incrementKg,
  barbell = false,
}: {
  workKg: number;
  incrementKg: number;
  barbell?: boolean;
}): WarmupSet[] {
  if (workKg < MIN_WARMUP_KG) return [];
  const steps: [number, number][] =
    workKg >= HEAVY_KG
      ? [
          [0.4, 8],
          [0.6, 5],
          [0.8, 2],
        ]
      : [
          [0.5, 8],
          [0.75, 3],
        ];
  const step = incrementKg > 0 ? incrementKg : 1;
  const result: WarmupSet[] = [];
  for (const [share, reps] of steps) {
    let weightKg = Math.floor((workKg * share) / step) * step;
    if (barbell) weightKg = Math.max(BAR_KG, weightKg);
    weightKg = Math.round(weightKg * 100) / 100;
    // Skip steps that would be as heavy as the work itself, or repeat the previous one.
    if (weightKg <= 0 || weightKg >= workKg || weightKg === result.at(-1)?.weightKg) continue;
    result.push({ weightKg, reps });
  }
  return result;
}

/**
 * Which patterns share a warm-up: once the legs (or the pushing, or the
 * pulling muscles) are warm, the next exercise for them doesn't need one.
 */
export function warmupRegion(pattern: MovementPattern): 'legs' | 'push' | 'pull' | null {
  switch (pattern) {
    case 'squat':
    case 'hinge':
    case 'lunge':
      return 'legs';
    case 'horizontal_push':
    case 'vertical_push':
      return 'push';
    case 'horizontal_pull':
    case 'vertical_pull':
      return 'pull';
    default:
      return null; // core and isolation: light enough, no warm-up.
  }
}

/** A warm-up makes sense for heavy compound lifts with external load. */
export function needsWarmup(exercise: { pattern: MovementPattern; loadType: LoadType }): boolean {
  return exercise.loadType === 'external' && warmupRegion(exercise.pattern) !== null;
}

export function usesBarbell(equipment: readonly EquipmentType[]): boolean {
  return equipment.includes('barbell');
}

export type PlateLoad = {
  /** Plates for ONE side of the bar, heaviest first. */
  perSide: number[];
  /** True when these plates make exactly the weight asked for. */
  exact: boolean;
};

/**
 * Plates for each side of a barbell: (total − bar) / 2, heaviest plates first.
 * With the standard plates this is always the fewest plates possible.
 * Null when the weight is the bar alone or less.
 */
export function platesPerSide(
  totalKg: number,
  barKg: number = BAR_KG,
  plates: readonly number[] = STANDARD_PLATES_KG
): PlateLoad | null {
  let remaining = Math.round(((totalKg - barKg) / 2) * 100) / 100;
  if (remaining <= 0) return null;
  const perSide: number[] = [];
  for (const plate of plates) {
    while (remaining + 1e-9 >= plate) {
      perSide.push(plate);
      remaining = Math.round((remaining - plate) * 100) / 100;
    }
  }
  return { perSide, exact: remaining === 0 };
}
