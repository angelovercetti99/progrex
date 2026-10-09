import { describe, expect, it } from 'vitest';

import { generateMesocycle } from '../plan/generate';
import { GOAL_CONFIG } from '../progression/config';
import { nextTarget, stalledSessions } from '../progression/engine';
import {
  adaptSession,
  daysLeftInPlanWeek,
  groupSessions,
  mergeSessions,
  PAIN_PATTERNS,
  shouldDeloadEarly,
} from './index';

const plan = generateMesocycle({
  goal: 'hypertrophy',
  daysPerWeek: 4,
  sessionMinutes: 60,
  experience: 'intermediate',
});
const upper = plan.sessions[0].slots;

describe('adaptSession', () => {
  it('changes nothing on a normal day', () => {
    const today = adaptSession({ slots: upper, plan });
    expect(today.slots).toEqual(upper);
    expect(today.reasons).toEqual([]);
    expect(today.hold).toBe(false);
  });

  it('leaves out what loads a sore shoulder and keeps the rest', () => {
    const today = adaptSession({ slots: upper, plan, painAreas: ['shoulders'] });
    expect(today.slots.some((slot) => PAIN_PATTERNS.shoulders.includes(slot.pattern))).toBe(false);
    expect(today.slots.length).toBeGreaterThan(0);
    expect(today.removed.every((item) => item.reason === 'pain')).toBe(true);
    expect(today.reasons).toContain('pain');
  });

  it('fits a 20-minute day, keeping main movements first', () => {
    const today = adaptSession({ slots: upper, plan, minutes: 20 });
    expect(today.slots.length).toBeLessThan(upper.length);
    expect(today.slots.every((slot) => slot.main)).toBe(true);
    expect(today.reasons).toContain('short_time');
  });

  it('holds progress and eases effort when tired', () => {
    const today = adaptSession({ slots: upper, plan, tired: true });
    expect(today.hold).toBe(true);
    expect(today.effortDelta).toBe(1);
    expect(today.slots).toEqual(upper);
  });

  it('holds progress after a week away, and eases in after two', () => {
    expect(adaptSession({ slots: upper, plan, daysSinceLastWorkout: 9 })).toMatchObject({
      hold: true,
      effortDelta: 0,
      reasons: ['comeback'],
    });
    const back = adaptSession({ slots: upper, plan, daysSinceLastWorkout: 20 });
    expect(back.reasons).toEqual(['long_break']);
    expect(back.effortDelta).toBe(1);
    expect(back.slots[0].setsPerWeek[0]).toBe(upper[0].setsPerWeek[0] - 1);
  });

  it('combines conditions', () => {
    const today = adaptSession({ slots: upper, plan, tired: true, painAreas: ['arms'], minutes: 30 });
    expect(today.reasons).toEqual(['pain', 'tired', 'short_time']);
  });
});

describe('busy week', () => {
  it('splits the remaining sessions over the days left, in order', () => {
    expect(groupSessions([1, 2, 3], 2)).toEqual([[1, 2], [3]]);
    expect(groupSessions([1, 2, 3], 5)).toEqual([[1], [2], [3]]);
    expect(groupSessions([2, 3], 0)).toEqual([[2, 3]]);
  });

  it('merges sessions into one, each movement once, within the usual time', () => {
    const merged = mergeSessions(plan, [0, 1]);
    const patterns = merged.map((slot) => slot.pattern);
    expect(new Set(patterns).size).toBe(patterns.length);
    expect(patterns).toContain('squat'); // from the lower session
    expect(patterns).toContain('horizontal_push'); // from the upper session
  });

  it('counts the days left in a plan week', () => {
    expect(daysLeftInPlanWeek('2026-10-05', 0, '2026-10-09')).toBe(3); // Fri, Sat, Sun
    expect(daysLeftInPlanWeek('2026-10-05', 0, '2026-10-13')).toBeLessThanOrEqual(0); // week over
  });
});

describe('stagnation', () => {
  it('counts sessions without a new best', () => {
    expect(stalledSessions([10, 11, 12])).toBe(0);
    expect(stalledSessions([10, 12, 11, 12, 11.5])).toBe(3);
    expect(stalledSessions([10])).toBe(0);
  });

  it('changes the stimulus after 3 stuck sessions', () => {
    const target = nextTarget({
      config: GOAL_CONFIG.hypertrophy,
      exercise: { loadType: 'external', loadIncrementKg: 2 },
      lastSets: [10, 10, 10].map((reps) => ({ reps, weightKg: 20, rir: 2 })),
      lastTarget: null,
      stalled: 3,
    });
    expect(target.lever).toBe('plateau');
  });

  it('holds instead of progressing on a hold day', () => {
    const target = nextTarget({
      config: GOAL_CONFIG.hypertrophy,
      exercise: { loadType: 'external', loadIncrementKg: 2 },
      lastSets: [12, 12, 12].map((reps) => ({ reps, weightKg: 20, rir: 2 })),
      lastTarget: null,
      hold: true,
    });
    expect(target.lever).toBe('hold');
    expect(target.sets.every((set) => set.weightKg === 20 && set.reps === 12)).toBe(true);
  });

  it('recovers early when most exercises are stuck', () => {
    expect(shouldDeloadEarly([3, 4, 0, 3])).toBe(true);
    expect(shouldDeloadEarly([3, 0, 0, 1])).toBe(false);
    expect(shouldDeloadEarly([3, 3])).toBe(false); // too little evidence
  });
});
