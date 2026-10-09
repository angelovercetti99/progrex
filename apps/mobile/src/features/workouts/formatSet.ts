import type { WorkoutSet } from '@/db/schema';
import { formatNumber } from '@/ui/Stepper';

/** "22.5 kg × 10" or, without weight, "× 10". */
export function formatSet(set: Pick<WorkoutSet, 'reps' | 'weightKg'>, kg: string): string {
  return set.weightKg ? `${formatNumber(set.weightKg)} ${kg} × ${set.reps}` : `× ${set.reps}`;
}

/** Compact summary of a whole exercise: "22 kg × 10, 10, 9" or "10, 10, 9 reps". */
export function summarizeSets(
  sets: Pick<WorkoutSet, 'reps' | 'weightKg'>[],
  kg: string,
  repsWord: string
): string {
  if (sets.length === 0) return '';
  const sameWeight = sets.every((set) => set.weightKg === sets[0].weightKg);
  if (sameWeight) {
    const reps = sets.map((set) => set.reps).join(', ');
    return sets[0].weightKg ? `${formatNumber(sets[0].weightKg)} ${kg} × ${reps}` : `${reps} ${repsWord}`;
  }
  return sets.map((set) => formatSet(set, kg)).join(', ');
}
