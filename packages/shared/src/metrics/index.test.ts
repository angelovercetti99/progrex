import { describe, expect, it } from 'vitest';

import {
  addDays,
  countHardSets,
  hardSetsByFamily,
  isHardSet,
  leverCounts,
  patternChange,
  patternChanges,
  progrexIndex,
  sessionScore,
  setScore,
  stimulusRatio,
  weekStart,
  type ExerciseSession,
} from './index';

let clock = 0;
function session(
  partial: Partial<ExerciseSession> & Pick<ExerciseSession, 'date' | 'sets'>
): ExerciseSession {
  clock += 1;
  return {
    startedAt: `${partial.date}T10:00:${String(clock % 60).padStart(2, '0')}.${clock}Z`,
    locationId: 'gym',
    exerciseId: 'bench',
    pattern: 'horizontal_push',
    loadType: 'external',
    tempo: false,
    deload: false,
    lever: null,
    ...partial,
  };
}
const sets = (weightKg: number | null, ...reps: number[]) => reps.map((r) => ({ reps: r, weightKg, rir: 2 }));
const pushUps = (date: string, ...reps: number[]) =>
  session({
    date,
    exerciseId: 'push_up',
    loadType: 'bodyweight',
    locationId: 'hotel',
    sets: sets(null, ...reps),
  });

describe('scores', () => {
  it('estimates strength with load (Epley, counting reps in reserve)', () => {
    expect(setScore({ reps: 8, weightKg: 60, rir: 2 }, 'external')).toBeCloseTo(80);
  });

  it('uses the same formula with the body as load', () => {
    expect(setScore({ reps: 12, weightKg: null, rir: 3 }, 'bodyweight')).toBeCloseTo(1.5);
  });

  it('keeps bodyweight progress in proportion with loaded progress', () => {
    const before = setScore({ reps: 10, weightKg: null, rir: 0 }, 'bodyweight');
    const after = setScore({ reps: 15, weightKg: null, rir: 0 }, 'bodyweight');
    expect(after / before - 1).toBeCloseTo(0.125);
  });

  it('takes the best set of the session', () => {
    expect(sessionScore({ loadType: 'bodyweight', sets: sets(null, 12, 10, 9) })).toBeCloseTo(1 + 14 / 30);
  });

  it('counts sets ending within 3 reps of failure as hard', () => {
    expect(isHardSet({ reps: 10, weightKg: 20, rir: 3 })).toBe(true);
    expect(isHardSet({ reps: 10, weightKg: 20, rir: 4 })).toBe(false);
    expect(isHardSet({ reps: 10, weightKg: 20, rir: null })).toBe(true);
  });
});

describe('progress per movement', () => {
  it('measures one exercise against itself', () => {
    const list = [
      session({ date: '2026-10-01', sets: sets(60, 8) }),
      session({ date: '2026-10-08', sets: sets(66, 8) }),
    ];
    expect(patternChange(list, '2026-10-01', '2026-10-31')).toBeCloseTo(0.1);
  });

  it('counts hotel push-ups without a false drop when you go back to the gym', () => {
    const list = [
      session({ date: '2026-10-01', sets: sets(60, 8) }),
      session({ date: '2026-10-03', sets: sets(60, 8) }),
      pushUps('2026-10-06', 20),
      pushUps('2026-10-08', 22), // +10% at the hotel
      session({ date: '2026-10-13', sets: sets(60, 8) }), // back at the gym, same as before
    ];
    const change = patternChange(list, '2026-10-01', '2026-10-31')!;
    expect(change).toBeGreaterThan(0); // the hotel progress counts…
    expect(change).toBeLessThan(0.1); // …averaged with a flat bench, not on top of it
  });

  it('does not double-count when alternating home and gym', () => {
    const list = [
      session({ date: '2026-10-01', sets: sets(60, 8) }),
      pushUps('2026-10-02', 20),
      session({ date: '2026-10-08', sets: sets(61.2, 8) }), // +2%
      pushUps('2026-10-09', 20.88), // +2% (Epley: 1 + 22.88/30 = 1.02 × (1 + 22/30))
    ];
    expect(patternChange(list, '2026-10-01', '2026-10-31')).toBeCloseTo(0.02);
  });

  it('never lowers the index when you beat your last session', () => {
    const base = [
      session({ date: '2026-10-01', sets: sets(60, 8) }),
      session({ date: '2026-10-08', sets: sets(70, 8) }), // bench +16%
      pushUps('2026-10-02', 20),
      pushUps('2026-10-09', 21), // push-ups +~2%
    ];
    const before = progrexIndex(base, '2026-10-01', '2026-10-31')!;
    const after = progrexIndex([...base, pushUps('2026-10-10', 22)], '2026-10-01', '2026-10-31')!;
    expect(after).toBeGreaterThanOrEqual(before);
  });

  it('carries progress on across places that follow each other', () => {
    const list = [
      session({ date: '2026-08-01', sets: sets(60, 8) }),
      session({ date: '2026-09-19', sets: sets(66, 8) }), // 7 weeks at the gym: +10%
      pushUps('2026-09-20', 20),
      pushUps('2026-09-27', 21.04), // then a hotel week: +~3%
    ];
    expect(patternChange(list, '2026-08-01', '2026-10-31')).toBeCloseTo(0.13, 1);
  });

  it('treats a slower tempo as a new exercise (fewer reps are not a regression)', () => {
    const list = [
      pushUps('2026-10-01', 20),
      pushUps('2026-10-03', 21),
      { ...pushUps('2026-10-06', 12), tempo: true },
      { ...pushUps('2026-10-08', 13), tempo: true },
    ];
    expect(patternChange(list, '2026-10-01', '2026-10-31')).toBeGreaterThan(0);
  });

  it('ignores deload sessions', () => {
    const list = [
      session({ date: '2026-10-01', sets: sets(60, 10) }),
      session({ date: '2026-10-08', sets: sets(60, 6), deload: true }),
    ];
    expect(patternChange(list, '2026-10-01', '2026-10-31')).toBeNull();
  });

  it('needs two sessions of an exercise in the period', () => {
    expect(
      patternChange([session({ date: '2026-10-01', sets: sets(60, 8) })], '2026-10-01', '2026-10-31')
    ).toBeNull();
  });

  it('averages movements into the Progrex Index', () => {
    const list = [
      session({ date: '2026-10-01', sets: sets(60, 8) }),
      session({ date: '2026-10-08', sets: sets(66, 8) }), // push +10%
      session({ date: '2026-10-01', exerciseId: 'row', pattern: 'horizontal_pull', sets: sets(50, 10) }),
      session({ date: '2026-10-08', exerciseId: 'row', pattern: 'horizontal_pull', sets: sets(50, 10) }), // pull 0%
    ];
    expect(progrexIndex(list, '2026-10-01', '2026-10-31')).toBeCloseTo(0.05);
    expect(patternChanges(list, '2026-10-01', '2026-10-31').map((p) => p.pattern)).toEqual([
      'horizontal_push',
      'horizontal_pull',
    ]);
  });
});

describe('stimulus', () => {
  it('counts hard sets per family', () => {
    const list = [
      session({ date: '2026-10-01', sets: sets(60, 8, 8, 8) }),
      session({ date: '2026-10-01', exerciseId: 'squat', pattern: 'squat', sets: sets(80, 5, 5) }),
    ];
    expect(hardSetsByFamily(list)).toEqual({ push: 3, pull: 0, legs: 2, core: 0 });
    expect(countHardSets(list)).toBe(5);
  });

  it('compares a week with your usual, ignoring weeks without training', () => {
    expect(stimulusRatio(12, [10, 0, 14])).toBeCloseTo(1);
    expect(stimulusRatio(12, [])).toBeNull();
  });

  it('counts the levers that drove progress', () => {
    const list = [
      session({ date: '2026-10-01', sets: [], lever: 'load' }),
      session({ date: '2026-10-02', sets: [], lever: 'reps' }),
      session({ date: '2026-10-03', sets: [], lever: 'calibrate' }),
    ];
    expect(leverCounts(list)).toMatchObject({ load: 1, reps: 1, rest: 0 });
  });
});

describe('dates', () => {
  it('finds the Monday of the week', () => {
    expect(weekStart('2026-10-09')).toBe('2026-10-05'); // Friday → Monday
    expect(weekStart('2026-10-05')).toBe('2026-10-05');
    expect(weekStart('2026-10-11')).toBe('2026-10-05'); // Sunday
  });

  it('adds days across months', () => {
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02');
  });
});
