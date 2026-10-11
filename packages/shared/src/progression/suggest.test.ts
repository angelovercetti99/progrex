import { describe, expect, it } from 'vitest';

import type { Target } from './engine';
import { fellShort, suggestSet } from './suggest';

const target = (sets: [number, number | null][], lever: Target['lever'] = 'reps'): Target => ({
  lever,
  sets: sets.map(([reps, weightKg]) => ({ reps, weightKg, rir: 2 })),
  restSeconds: 90,
  tempoEccentricSeconds: null,
  focusSet: null,
});
const set = (reps: number, weightKg: number | null = 20) => ({ reps, weightKg, rir: 2 });

describe('suggestSet', () => {
  it('follows the target, set by set', () => {
    const plan = target([
      [10, 20],
      [9, 20],
    ]);
    expect(suggestSet({ target: plan, today: [], last: [], usesWeight: true })).toEqual({
      reps: 10,
      weightKg: 20,
      rir: 2,
    });
    expect(suggestSet({ target: plan, today: [set(10)], last: [], usesWeight: true }).reps).toBe(9);
  });

  it('keeps the weight you chose today', () => {
    const plan = target([
      [10, 20],
      [10, 20],
    ]);
    expect(suggestSet({ target: plan, today: [set(10, 17.5)], last: [], usesWeight: true }).weightKg).toBe(
      17.5
    );
  });

  it('follows what you did when the last set fell 2+ reps short', () => {
    const plan = target([
      [10, 20],
      [10, 20],
    ]);
    expect(fellShort(plan, [set(7)])).toBe(true);
    expect(suggestSet({ target: plan, today: [set(7)], last: [], usesWeight: true }).reps).toBe(7);
  });

  it('calibrating: reps follow today', () => {
    const plan = target(
      [
        [8, null],
        [8, null],
      ],
      'calibrate'
    );
    expect(suggestSet({ target: plan, today: [set(11)], last: [], usesWeight: true }).reps).toBe(11);
  });

  it('without a target: last time, then a sensible default', () => {
    expect(suggestSet({ target: null, today: [], last: [set(12, 30)], usesWeight: true })).toEqual({
      reps: 12,
      weightKg: 30,
      rir: 2,
    });
    expect(suggestSet({ target: null, today: [], last: [], usesWeight: false })).toEqual({
      reps: 10,
      weightKg: null,
      rir: 2,
    });
  });
});
