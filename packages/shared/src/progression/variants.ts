import { hasEquipmentFor } from '../equipment';
import type { EquipmentType, LoadType, LocationEquipment, MovementPattern } from '../training';

/**
 * Picks which exercise to do for a movement pattern, given the equipment
 * where you are. Pure function: works the same with the built-in catalog or
 * the exercises table.
 */

export type VariantCandidate = {
  id: string;
  pattern: MovementPattern;
  equipment: EquipmentType[];
  loadType: LoadType;
  difficulty: number;
};

/**
 * If a pattern is impossible here, train the closest one instead.
 * Vertical pulls need a bar, a band or a machine. With none of those, rowing
 * under a table still trains the back.
 */
export const PATTERN_FALLBACK: Partial<Record<MovementPattern, MovementPattern>> = {
  vertical_pull: 'horizontal_pull',
};

export type SelectVariantInput<T extends VariantCandidate> = {
  pattern: MovementPattern;
  available: LocationEquipment;
  candidates: T[];
  /** Used last time at this place: keep it, so progress can be compared. */
  preferredId?: string | null;
  /** Only exercises at least this hard. */
  minDifficulty?: number;
  /** When there's no preference, aim for this difficulty. */
  targetDifficulty?: number;
  /** Allow switching to the fallback pattern (default: true). */
  allowFallback?: boolean;
};

export function selectVariant<T extends VariantCandidate>({
  pattern,
  available,
  candidates,
  preferredId = null,
  minDifficulty = 1,
  targetDifficulty = 3,
  allowFallback = true,
}: SelectVariantInput<T>): T | null {
  const possible = candidates.filter(
    (candidate) =>
      candidate.pattern === pattern &&
      candidate.difficulty >= minDifficulty &&
      hasEquipmentFor(candidate.equipment, available)
  );

  if (possible.length === 0) {
    const fallback = PATTERN_FALLBACK[pattern];
    return allowFallback && fallback
      ? selectVariant({
          pattern: fallback,
          available,
          candidates,
          minDifficulty,
          targetDifficulty,
          allowFallback: false,
        })
      : null;
  }

  const preferred = possible.find((candidate) => candidate.id === preferredId);
  if (preferred) {
    return preferred;
  }

  // Loadable exercises first when the place has the gear (weight is the lever
  // that keeps progress going longest; a gym shouldn't pick assisted pistols),
  // then the closest to the target difficulty, then the easier one.
  return [...possible].sort(
    (a, b) =>
      loadRank(a.loadType) - loadRank(b.loadType) ||
      Math.abs(a.difficulty - targetDifficulty) - Math.abs(b.difficulty - targetDifficulty) ||
      a.difficulty - b.difficulty
  )[0];
}

/** The next step up from `current` in the same pattern, if this place allows one. */
export function harderVariant<T extends VariantCandidate>(
  current: VariantCandidate,
  available: LocationEquipment,
  candidates: T[]
): T | null {
  return selectVariant({
    pattern: current.pattern,
    available,
    candidates: candidates.filter((candidate) => candidate.id !== current.id),
    minDifficulty: current.difficulty + 1,
    targetDifficulty: current.difficulty + 1,
    allowFallback: false,
  });
}

function loadRank(loadType: LoadType): number {
  return loadType === 'external' ? 0 : loadType === 'bodyweight' ? 1 : 2;
}
