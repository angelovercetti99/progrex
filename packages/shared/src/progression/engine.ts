import type { LoadType } from '../training';
import { REST_STEP_SECONDS, TEMPO_ECCENTRIC_SECONDS, type GoalConfig, type Lever } from './config';

/**
 * The progression engine: given what you did last time, what should you do
 * today to make progress? A pure function — same input, same output, no
 * database, no screen — which is what makes it easy to test.
 *
 * Method: double progression with RIR (docs/decisoes.md §19).
 * 1. Work inside a rep range (e.g. 8–12), adding reps session to session.
 * 2. When every set reaches the top, make it harder with ONE lever, tried in
 *    the goal's order: more load → reps past the range → less rest → slower
 *    tempo → one more set → a harder variant.
 */

export type PerformedSet = {
  reps: number;
  weightKg: number | null;
  rir: number | null;
};

export type SetTarget = {
  reps: number;
  weightKg: number | null;
  rir: number;
};

export type TargetLever =
  | Lever
  /** First time with this exercise (here): find the right weight. */
  | 'calibrate'
  /** Last time was too heavy: go down a step. */
  | 'load_down'
  /** Not all sets were done last time: complete them first. */
  | 'complete_sets'
  /** Recovery week: same weight, fewer sets, easy effort. */
  | 'deload'
  /** Today isn't the day to push (low energy, coming back from a break): repeat. */
  | 'hold'
  /** No improvement for several sessions: change the stimulus (another variant). */
  | 'plateau';

export type Target = {
  lever: TargetLever;
  sets: SetTarget[];
  restSeconds: number;
  /** Seconds for the lowering phase, when the tempo lever is active. */
  tempoEccentricSeconds: number | null;
  /** For the `reps` lever: which set (0-based) gets the extra rep. */
  focusSet: number | null;
};

export type ProgressionInput = {
  config: GoalConfig;
  exercise: { loadType: LoadType; loadIncrementKg: number };
  /** Sets from the last session of THIS exercise. Empty = never done. */
  lastSets: PerformedSet[];
  /** What was prescribed last time: rest, tempo and set count carry over. */
  lastTarget: Target | null;
  /** Heaviest load available where you are. Undefined = no limit. */
  maxLoadKg?: number;
  /** Following a plan: the plan sets the number of sets (no "sets" lever). */
  planned?: boolean;
  /** Deload week of the plan. */
  deload?: boolean;
  /** Don't progress today: repeat last time (low energy, coming back from a break). */
  hold?: boolean;
  /** Sessions in a row without beating the best (see `stalledSessions`). */
  stalled?: number;
};

/** After this many sessions without improvement, insisting stops working: change something. */
export const PLATEAU_SESSIONS = 3;

export function nextTarget({
  config,
  exercise,
  lastSets,
  lastTarget,
  maxLoadKg,
  planned = false,
  deload = false,
  hold = false,
  stalled = 0,
}: ProgressionInput): Target {
  // A deload resets rest and tempo; otherwise they carry over from last time.
  const carried = lastTarget?.lever === 'deload' ? null : lastTarget;
  const restSeconds = carried?.restSeconds ?? config.restSeconds;
  const tempoEccentricSeconds = carried?.tempoEccentricSeconds ?? null;
  const setCount = planned ? config.sets : Math.max(carried?.sets.length ?? 0, config.sets);

  // Never done: no numbers to build on. Work in the range at the target effort.
  if (lastSets.length === 0) {
    return {
      lever: 'calibrate',
      sets: repeat(config.sets, { reps: config.repMin, weightKg: null, rir: config.targetRir }),
      restSeconds: config.restSeconds,
      tempoEccentricSeconds: null,
      focusSet: null,
    };
  }

  const usesLoad = exercise.loadType === 'external';
  const increment = exercise.loadIncrementKg;
  const weight = usesLoad ? lastSets[0].weightKg : null;

  // Recovery week: keep the weight, do fewer and easier sets. No progression.
  if (deload) {
    return {
      lever: 'deload',
      sets: repeat(config.sets, { reps: config.repMin, weightKg: weight, rir: config.targetRir }),
      restSeconds: config.restSeconds,
      tempoEccentricSeconds: null,
      focusSet: null,
    };
  }

  // Starting point: repeat last time (missing sets copy the last one done).
  const repeated: SetTarget[] = Array.from({ length: setCount }, (_, index) => ({
    reps: (lastSets[index] ?? lastSets[lastSets.length - 1]).reps,
    weightKg: weight,
    rir: config.targetRir,
  }));
  const target = (lever: TargetLever, patch: Partial<Target> = {}): Target => ({
    lever,
    sets: repeated,
    restSeconds,
    tempoEccentricSeconds,
    focusSet: null,
    ...patch,
  });
  const withAll = (patch: Partial<SetTarget>) => repeated.map((set) => ({ ...set, ...patch }));

  // Too heavy: the first set didn't even reach the bottom of the range.
  if (
    usesLoad &&
    weight !== null &&
    increment > 0 &&
    lastSets[0].reps < config.repMin &&
    weight - increment > 0
  ) {
    return target('load_down', {
      sets: withAll({ weightKg: round(weight - increment), reps: config.repMin }),
    });
  }

  // Not today: same as last time. Progress resumes next session.
  if (hold) {
    return target('hold');
  }

  // Not every set was done: finish the prescription before pushing further.
  if (lastSets.length < setCount) {
    return target('complete_sets');
  }

  // Stuck for several sessions: another +1 rep won't help. Change the stimulus.
  if (stalled >= PLATEAU_SESSIONS) {
    return target('plateau');
  }

  // Inside the range: one more rep on the first set that hasn't hit the top.
  const belowTop = lastSets.findIndex((set) => set.reps < config.repMax);
  if (belowTop !== -1) {
    return addRep(target('reps'), belowTop);
  }

  // Every set at the top: pull the first lever that still has room.
  for (const lever of config.levers) {
    switch (lever) {
      case 'load': {
        const canAddLoad =
          usesLoad &&
          weight !== null &&
          increment > 0 &&
          (maxLoadKg === undefined || weight + increment <= maxLoadKg);
        if (canAddLoad) {
          return target('load', {
            sets: withAll({ weightKg: round(weight + increment), reps: config.repMin }),
          });
        }
        break;
      }
      case 'reps': {
        const belowCeiling = lastSets.findIndex((set) => set.reps < config.repCeiling);
        if (belowCeiling !== -1) {
          return addRep(target('reps'), belowCeiling);
        }
        break;
      }
      case 'rest': {
        if (restSeconds - REST_STEP_SECONDS >= config.minRestSeconds) {
          return target('rest', { restSeconds: restSeconds - REST_STEP_SECONDS });
        }
        break;
      }
      case 'tempo': {
        if (tempoEccentricSeconds === null) {
          // Slower reps are harder, so the rep count starts again from the bottom.
          return target('tempo', {
            tempoEccentricSeconds: TEMPO_ECCENTRIC_SECONDS,
            sets: withAll({ reps: config.repMin }),
          });
        }
        break;
      }
      case 'sets': {
        if (!planned && setCount < config.maxSets) {
          return target('sets', { sets: [...repeated, repeated[repeated.length - 1]] });
        }
        break;
      }
      case 'variant':
        return target('variant');
    }
  }

  // Every lever is exhausted: the exercise has become too easy.
  return target('variant');
}

function addRep(base: Target, index: number): Target {
  return {
    ...base,
    focusSet: index,
    sets: base.sets.map((set, i) => (i === index ? { ...set, reps: set.reps + 1 } : set)),
  };
}

function repeat(count: number, set: SetTarget): SetTarget[] {
  return Array.from({ length: count }, () => ({ ...set }));
}

/** Avoids float noise like 22.499999999. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * How many sessions in a row (most recent last) failed to beat the best score
 * before them. 0 = the last session was a new best (or there's too little data).
 */
export function stalledSessions(scores: number[]): number {
  let count = 0;
  for (let i = scores.length - 1; i > 0; i--) {
    const bestBefore = Math.max(...scores.slice(0, i));
    if (scores[i] > bestBefore) break;
    count++;
  }
  return count;
}
