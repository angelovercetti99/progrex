import type { Goal } from '../training';

/**
 * How we make an exercise harder, from most to least preferred (per goal).
 * See docs/decisoes.md §19.
 */
export type Lever = 'load' | 'reps' | 'rest' | 'tempo' | 'sets' | 'variant';

export type GoalConfig = {
  /** The rep range we work in. */
  repMin: number;
  repMax: number;
  /** When load can't go up, reps may go past repMax up to here. */
  repCeiling: number;
  /** Target reps in reserve. */
  targetRir: number;
  sets: number;
  maxSets: number;
  restSeconds: number;
  minRestSeconds: number;
  /** Order in which levers are tried once the top of the range is reached. */
  levers: Lever[];
};

/** The goals change the parameters, not the engine. */
export const GOAL_CONFIG: Record<Goal, GoalConfig> = {
  hypertrophy: {
    repMin: 8,
    repMax: 12,
    repCeiling: 20,
    targetRir: 2,
    sets: 3,
    maxSets: 5,
    restSeconds: 90,
    minRestSeconds: 60,
    levers: ['load', 'reps', 'rest', 'tempo', 'sets', 'variant'],
  },
  strength: {
    repMin: 3,
    repMax: 6,
    repCeiling: 8,
    targetRir: 2,
    sets: 4,
    maxSets: 5,
    restSeconds: 180,
    minRestSeconds: 120,
    levers: ['load', 'variant', 'reps', 'sets'],
  },
  fat_loss: {
    repMin: 10,
    repMax: 15,
    repCeiling: 25,
    targetRir: 2,
    sets: 3,
    maxSets: 4,
    restSeconds: 60,
    minRestSeconds: 30,
    levers: ['rest', 'load', 'reps', 'tempo', 'sets', 'variant'],
  },
  general_health: {
    repMin: 8,
    repMax: 15,
    repCeiling: 20,
    targetRir: 3,
    sets: 2,
    maxSets: 3,
    restSeconds: 90,
    minRestSeconds: 60,
    levers: ['load', 'reps', 'sets', 'variant'],
  },
};

/** How much rest is cut each time "rest" is the lever. */
export const REST_STEP_SECONDS = 15;

/** Slow lowering phase used by the "tempo" lever (seconds). */
export const TEMPO_ECCENTRIC_SECONDS = 3;
