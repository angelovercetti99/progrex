import { describe, expect, it } from 'vitest';

import { EFFORT_LEVELS, effortForRir, intensityForRir, rirForEffort } from './effort';

describe('effort in plain words', () => {
  it('describes every RIR value with one answer', () => {
    expect([5, 4, 3, 2, 1, 0].map(effortForRir)).toEqual(['easy', 'easy', 'good', 'good', 'hard', 'max']);
  });

  it('keeps the target when the answer covers it', () => {
    expect(rirForEffort('good', 3)).toBe(3);
    expect(rirForEffort('good', 2)).toBe(2);
  });

  it("uses the answer's own value when the target is outside it", () => {
    expect(rirForEffort('good', 1)).toBe(2);
    expect(rirForEffort('hard', 3)).toBe(1);
    expect(rirForEffort('max', 2)).toBe(0);
    expect(rirForEffort('easy', 2)).toBe(4);
  });

  it('round-trips: the stored value is described by the same answer', () => {
    for (const level of EFFORT_LEVELS)
      for (const target of [0, 1, 2, 3, 4]) expect(effortForRir(rirForEffort(level, target))).toBe(level);
  });

  it('names how hard a week is', () => {
    expect([4, 3, 2, 1, 0].map(intensityForRir)).toEqual(['light', 'moderate', 'high', 'very_high', 'max']);
  });
});
