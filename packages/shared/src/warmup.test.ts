import { describe, expect, it } from 'vitest';

import { needsWarmup, platesPerSide, warmupRegion, warmupSets } from './warmup';

describe('warmupSets', () => {
  it('skips the warm-up when the working weight is light', () => {
    expect(warmupSets({ workKg: 12, incrementKg: 2 })).toEqual([]);
  });

  it('two steps for moderate weights, rounded down to the step', () => {
    expect(warmupSets({ workKg: 30, incrementKg: 2 })).toEqual([
      { weightKg: 14, reps: 8 },
      { weightKg: 22, reps: 3 },
    ]);
  });

  it('three steps for heavy lifts', () => {
    expect(warmupSets({ workKg: 100, incrementKg: 2.5, barbell: true })).toEqual([
      { weightKg: 40, reps: 8 },
      { weightKg: 60, reps: 5 },
      { weightKg: 80, reps: 2 },
    ]);
  });

  it('never goes below the empty bar, and never repeats a step', () => {
    expect(warmupSets({ workKg: 30, incrementKg: 2.5, barbell: true })).toEqual([
      { weightKg: 20, reps: 8 },
      { weightKg: 22.5, reps: 3 },
    ]);
    // 50% and 75% of 25 kg are both below the bar: one step only.
    expect(warmupSets({ workKg: 25, incrementKg: 2.5, barbell: true })).toEqual([{ weightKg: 20, reps: 8 }]);
  });

  it('every step is lighter than the working weight and gets heavier', () => {
    for (let workKg = 15; workKg <= 200; workKg += 2.5) {
      const steps = warmupSets({ workKg, incrementKg: 2.5, barbell: true });
      steps.forEach((step, index) => {
        expect(step.weightKg).toBeLessThan(workKg);
        if (index > 0) expect(step.weightKg).toBeGreaterThan(steps[index - 1].weightKg);
      });
    }
  });
});

describe('needsWarmup', () => {
  it('only for loaded compound lifts', () => {
    expect(needsWarmup({ pattern: 'squat', loadType: 'external' })).toBe(true);
    expect(needsWarmup({ pattern: 'squat', loadType: 'bodyweight' })).toBe(false);
    expect(needsWarmup({ pattern: 'biceps', loadType: 'external' })).toBe(false);
    expect(warmupRegion('lunge')).toBe(warmupRegion('hinge'));
  });
});

describe('platesPerSide', () => {
  it('splits the weight over both sides, heaviest plates first', () => {
    expect(platesPerSide(100)).toEqual({ perSide: [25, 15], exact: true });
    expect(platesPerSide(62.5)).toEqual({ perSide: [20, 1.25], exact: true });
  });

  it('nothing to load for the bar alone', () => {
    expect(platesPerSide(20)).toBeNull();
    expect(platesPerSide(15)).toBeNull();
  });

  it('says when the plates cannot make the exact weight', () => {
    expect(platesPerSide(21)).toEqual({ perSide: [], exact: false });
    expect(platesPerSide(23)).toEqual({ perSide: [1.25], exact: false });
  });
});
