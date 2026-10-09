import { describe, expect, it } from 'vitest';

import { GOAL_CONFIG } from './config';
import { nextTarget, type PerformedSet, type ProgressionInput, type Target } from './engine';

const hypertrophy = GOAL_CONFIG.hypertrophy; // 8–12 reps, ceiling 20, 3 sets (max 5), rest 90 s (min 60)
const dumbbells = { loadType: 'external' as const, loadIncrementKg: 2 };
const bodyweight = { loadType: 'bodyweight' as const, loadIncrementKg: 0 };

function sets(weightKg: number | null, ...reps: number[]): PerformedSet[] {
  return reps.map((r) => ({ reps: r, weightKg, rir: 2 }));
}

function run(input: Partial<ProgressionInput> & Pick<ProgressionInput, 'lastSets'>): Target {
  return nextTarget({ config: hypertrophy, exercise: dumbbells, lastTarget: null, ...input });
}

describe('nextTarget', () => {
  it('calibrates the first time an exercise is done', () => {
    const target = run({ lastSets: [] });
    expect(target.lever).toBe('calibrate');
    expect(target.sets).toHaveLength(3);
    expect(target.sets[0]).toEqual({ reps: 8, weightKg: null, rir: 2 });
  });

  it('adds one rep to the first set below the top of the range', () => {
    const target = run({ lastSets: sets(20, 12, 10, 9) });
    expect(target.lever).toBe('reps');
    expect(target.focusSet).toBe(1);
    expect(target.sets.map((s) => s.reps)).toEqual([12, 11, 9]);
    expect(target.sets.every((s) => s.weightKg === 20)).toBe(true);
  });

  it('adds load and resets reps when every set reaches the top', () => {
    const target = run({ lastSets: sets(20, 12, 12, 12) });
    expect(target.lever).toBe('load');
    expect(target.sets).toEqual([
      { reps: 8, weightKg: 22, rir: 2 },
      { reps: 8, weightKg: 22, rir: 2 },
      { reps: 8, weightKg: 22, rir: 2 },
    ]);
  });

  it('goes past the range when the dumbbells are already at their heaviest', () => {
    const target = run({ lastSets: sets(20, 12, 12, 12), maxLoadKg: 20 });
    expect(target.lever).toBe('reps');
    expect(target.sets.map((s) => s.reps)).toEqual([13, 12, 12]);
  });

  it('cuts rest once reps reach the ceiling and load cannot go up', () => {
    const target = run({ lastSets: sets(20, 20, 20, 20), maxLoadKg: 20 });
    expect(target.lever).toBe('rest');
    expect(target.restSeconds).toBe(75);
  });

  it('slows the tempo (and restarts the reps) when rest is already at its minimum', () => {
    const lastTarget = { ...run({ lastSets: [] }), restSeconds: 60 };
    const target = run({ lastSets: sets(20, 20, 20, 20), maxLoadKg: 20, lastTarget });
    expect(target.lever).toBe('tempo');
    expect(target.tempoEccentricSeconds).toBe(3);
    expect(target.sets.every((s) => s.reps === 8)).toBe(true);
  });

  it('adds a set when rest and tempo are used up', () => {
    const lastTarget: Target = { ...run({ lastSets: [] }), restSeconds: 60, tempoEccentricSeconds: 3 };
    const target = run({ lastSets: sets(20, 20, 20, 20), maxLoadKg: 20, lastTarget });
    expect(target.lever).toBe('sets');
    expect(target.sets).toHaveLength(4);
  });

  it('suggests a harder variant when every lever is exhausted', () => {
    const lastTarget: Target = {
      ...run({ lastSets: [] }),
      sets: Array(5).fill({ reps: 20, weightKg: 20, rir: 2 }),
      restSeconds: 60,
      tempoEccentricSeconds: 3,
    };
    const target = run({ lastSets: sets(20, 20, 20, 20, 20, 20), maxLoadKg: 20, lastTarget });
    expect(target.lever).toBe('variant');
  });

  it('never adds load to bodyweight exercises', () => {
    const target = run({ exercise: bodyweight, lastSets: sets(null, 12, 12, 12) });
    expect(target.lever).toBe('reps');
    expect(target.sets[0]).toEqual({ reps: 13, weightKg: null, rir: 2 });
  });

  it('lowers the load when the first set fell below the range', () => {
    const target = run({ lastSets: sets(24, 6, 5, 5) });
    expect(target.lever).toBe('load_down');
    expect(target.sets.every((s) => s.weightKg === 22 && s.reps === 8)).toBe(true);
  });

  it('asks to complete the sets when fewer were done than prescribed', () => {
    const target = run({ lastSets: sets(20, 12, 12) });
    expect(target.lever).toBe('complete_sets');
    expect(target.sets).toHaveLength(3);
  });

  it('keeps rest, tempo and extra sets from the last prescription', () => {
    const lastTarget: Target = {
      ...run({ lastSets: [] }),
      sets: Array(4).fill({ reps: 10, weightKg: 20, rir: 2 }),
      restSeconds: 75,
      tempoEccentricSeconds: 3,
    };
    const target = run({ lastSets: sets(20, 10, 10, 10, 9), lastTarget });
    expect(target.restSeconds).toBe(75);
    expect(target.tempoEccentricSeconds).toBe(3);
    expect(target.sets).toHaveLength(4);
  });

  it('prefers cutting rest over adding load for fat loss', () => {
    const target = nextTarget({
      config: GOAL_CONFIG.fat_loss,
      exercise: dumbbells,
      lastSets: sets(10, 15, 15, 15),
      lastTarget: null,
    });
    expect(target.lever).toBe('rest');
    expect(target.restSeconds).toBe(45);
  });

  it('avoids float noise in weights', () => {
    const target = run({
      exercise: { loadType: 'external', loadIncrementKg: 2.5 },
      lastSets: sets(42.5, 12, 12, 12),
    });
    expect(target.sets[0].weightKg).toBe(45);
  });
});

describe('nextTarget inside a plan', () => {
  it('lets the plan decide the number of sets (no "sets" lever)', () => {
    const lastTarget: Target = { ...run({ lastSets: [] }), restSeconds: 60, tempoEccentricSeconds: 3 };
    const target = run({ lastSets: sets(20, 20, 20, 20), maxLoadKg: 20, lastTarget, planned: true });
    expect(target.lever).toBe('variant');
    expect(target.sets).toHaveLength(3);
  });

  it("follows this week's set count even if last time had more", () => {
    const config = { ...hypertrophy, sets: 2 };
    const target = nextTarget({
      config,
      exercise: dumbbells,
      lastSets: sets(20, 10, 10, 10),
      lastTarget: null,
      planned: true,
    });
    expect(target.sets).toHaveLength(2);
  });

  it("deloads: same weight, the week's sets and effort, no progression", () => {
    const config = { ...hypertrophy, sets: 2, targetRir: 4 };
    const target = nextTarget({
      config,
      exercise: dumbbells,
      lastSets: sets(22, 12, 12, 12),
      lastTarget: null,
      planned: true,
      deload: true,
    });
    expect(target.lever).toBe('deload');
    expect(target.sets).toEqual([
      { reps: 8, weightKg: 22, rir: 4 },
      { reps: 8, weightKg: 22, rir: 4 },
    ]);
  });

  it('does not carry rest or tempo out of a deload', () => {
    const deloadTarget: Target = {
      lever: 'deload',
      sets: [],
      restSeconds: 120,
      tempoEccentricSeconds: 3,
      focusSet: null,
    };
    const target = run({ lastSets: sets(20, 10, 10, 10), lastTarget: deloadTarget });
    expect(target.restSeconds).toBe(90);
    expect(target.tempoEccentricSeconds).toBeNull();
  });
});
