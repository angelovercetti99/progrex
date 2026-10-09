import { MAIN_PATTERNS, type MovementPattern } from '../training';
import type { BodyArea, SessionFocus } from './schema';

/**
 * Weekly splits by training days. Classic, proven structures:
 * 2–3 days: full body · 4 days: upper/lower · 5 days: upper/lower + push/pull/legs
 * 6 days: push/pull/legs twice.
 * Within a session, main patterns come first; isolation work goes last.
 */
export type SessionTemplate = { focus: SessionFocus; patterns: MovementPattern[] };

const upperA: SessionTemplate = {
  focus: 'upper',
  patterns: ['horizontal_push', 'horizontal_pull', 'vertical_push', 'vertical_pull', 'biceps', 'triceps'],
};
const lowerA: SessionTemplate = { focus: 'lower', patterns: ['squat', 'hinge', 'lunge', 'core', 'calves'] };
const upperB: SessionTemplate = {
  focus: 'upper',
  patterns: [
    'vertical_push',
    'vertical_pull',
    'horizontal_push',
    'horizontal_pull',
    'lateral_delts',
    'triceps',
  ],
};
const lowerB: SessionTemplate = { focus: 'lower', patterns: ['hinge', 'squat', 'lunge', 'core', 'glutes'] };
const push: SessionTemplate = {
  focus: 'push',
  patterns: ['horizontal_push', 'vertical_push', 'triceps', 'lateral_delts'],
};
const pull: SessionTemplate = {
  focus: 'pull',
  patterns: ['vertical_pull', 'horizontal_pull', 'core', 'biceps'],
};
const legs: SessionTemplate = { focus: 'legs', patterns: ['squat', 'hinge', 'lunge', 'calves', 'glutes'] };

export const SPLITS: Record<number, SessionTemplate[]> = {
  2: [
    { focus: 'full_body', patterns: ['squat', 'horizontal_push', 'vertical_pull', 'core', 'biceps'] },
    { focus: 'full_body', patterns: ['hinge', 'vertical_push', 'horizontal_pull', 'lunge', 'triceps'] },
  ],
  3: [
    { focus: 'full_body', patterns: ['squat', 'horizontal_push', 'horizontal_pull', 'core', 'calves'] },
    { focus: 'full_body', patterns: ['hinge', 'vertical_push', 'vertical_pull', 'lateral_delts', 'biceps'] },
    { focus: 'full_body', patterns: ['lunge', 'horizontal_push', 'vertical_pull', 'glutes', 'triceps'] },
  ],
  4: [upperA, lowerA, upperB, lowerB],
  5: [upperA, lowerA, push, pull, legs],
  6: [
    push,
    pull,
    legs,
    { ...push, patterns: ['vertical_push', 'horizontal_push', 'lateral_delts', 'triceps'] },
    { ...pull, patterns: ['horizontal_pull', 'vertical_pull', 'biceps', 'core'] },
    { ...legs, patterns: ['hinge', 'squat', 'lunge', 'glutes', 'calves'] },
  ],
};

export function isMainPattern(pattern: MovementPattern): boolean {
  return (MAIN_PATTERNS as readonly MovementPattern[]).includes(pattern);
}

/** Which movement patterns train each body area. */
export const AREA_PATTERNS: Record<BodyArea, MovementPattern[]> = {
  chest: ['horizontal_push'],
  back: ['horizontal_pull', 'vertical_pull'],
  shoulders: ['vertical_push', 'lateral_delts'],
  arms: ['biceps', 'triceps'],
  core: ['core'],
  glutes: ['glutes', 'hinge'],
  legs: ['squat', 'lunge', 'hinge'],
  calves: ['calves'],
};

/** Isolation patterns that can be ADDED to a session when an area is prioritised. */
export const AREA_EXTRA_SLOTS: Partial<Record<BodyArea, MovementPattern[]>> = {
  shoulders: ['lateral_delts'],
  arms: ['biceps', 'triceps'],
  core: ['core'],
  glutes: ['glutes'],
  calves: ['calves'],
};

/** Session types where an added isolation pattern makes sense. */
export const EXTRA_SLOT_SESSIONS: Partial<Record<MovementPattern, SessionFocus[]>> = {
  lateral_delts: ['upper', 'push', 'full_body'],
  biceps: ['upper', 'pull', 'full_body'],
  triceps: ['upper', 'push', 'full_body'],
  core: ['upper', 'lower', 'push', 'pull', 'legs', 'full_body'],
  glutes: ['lower', 'legs', 'full_body'],
  calves: ['lower', 'legs', 'full_body'],
};
