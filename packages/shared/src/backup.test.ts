import { describe, expect, it } from 'vitest';

import { BACKUP_VERSION, extraActiveMesocycles, parseBackup, rowsToRestore, type Backup } from './backup';
import { generateMesocycle } from './plan/generate';

const T1 = '2026-10-01T10:00:00.000Z';
const T2 = '2026-10-02T10:00:00.000Z';
const stamps = { createdAt: T1, updatedAt: T1 };

function sampleBackup(): Record<string, unknown> {
  return {
    app: 'progrex',
    version: BACKUP_VERSION,
    exportedAt: T2,
    tables: {
      exercises: [],
      locations: [{ id: 'loc1', name: 'Casa', equipment: [{ type: 'dumbbells', maxKg: 20 }], ...stamps }],
      mesocycles: [
        {
          id: 'm1',
          startDate: '2026-09-28',
          status: 'active',
          plan: generateMesocycle({
            goal: 'hypertrophy',
            daysPerWeek: 3,
            sessionMinutes: 45,
            experience: 'intermediate',
          }),
          ...stamps,
        },
      ],
      workouts: [
        { id: 'w1', date: '2026-10-01', locationId: 'loc1', startedAt: T1, finishedAt: T1, ...stamps },
      ],
      workoutExercises: [
        { id: 'we1', workoutId: 'w1', exerciseId: 'builtin:push_up', position: 1, target: null, ...stamps },
      ],
      sets: [
        { id: 's1', workoutExerciseId: 'we1', position: 1, reps: 10, weightKg: null, rir: 2, ...stamps },
      ],
    },
    preferences: { goal: 'strength' },
  };
}

describe('parseBackup', () => {
  it('reads a backup and fills missing optional fields with null', () => {
    const backup = parseBackup(JSON.stringify(sampleBackup()));
    expect(backup).not.toBeNull();
    const workout = backup!.tables.workouts[0];
    expect(workout.mesocycleId).toBeNull();
    expect(workout.deletedAt).toBeNull();
    expect(backup!.tables.sets[0].completedAt).toBeNull();
    expect(backup!.preferences).toEqual({ goal: 'strength' });
  });

  it('round-trips: what we write we can read back the same', () => {
    const backup = parseBackup(JSON.stringify(sampleBackup()))!;
    expect(parseBackup(JSON.stringify(backup))).toEqual(backup);
  });

  it('drops fields it does not know (e.g. the local dirty flag)', () => {
    const file = sampleBackup();
    (file.tables as Backup['tables']).sets[0] = {
      ...(file.tables as Backup['tables']).sets[0],
      dirty: true,
    } as never;
    const backup = parseBackup(JSON.stringify(file))!;
    expect('dirty' in backup.tables.sets[0]).toBe(false);
  });

  it('refuses files that are not a Progrex backup', () => {
    expect(parseBackup('not json')).toBeNull();
    expect(parseBackup('{}')).toBeNull();
    expect(parseBackup(JSON.stringify({ ...sampleBackup(), app: 'other' }))).toBeNull();
  });

  it('refuses a file made by a newer version of the app', () => {
    expect(parseBackup(JSON.stringify({ ...sampleBackup(), version: BACKUP_VERSION + 1 }))).toBeNull();
  });

  it('refuses invalid values (a broken plan, an impossible RIR)', () => {
    const brokenPlan = sampleBackup();
    (brokenPlan.tables as { mesocycles: { plan: unknown }[] }).mesocycles[0].plan = { weeks: 'x' };
    expect(parseBackup(JSON.stringify(brokenPlan))).toBeNull();

    const badRir = sampleBackup();
    (badRir.tables as { sets: { rir: number }[] }).sets[0].rir = 9;
    expect(parseBackup(JSON.stringify(badRir))).toBeNull();
  });
});

describe('rowsToRestore', () => {
  it('adds new rows and newer versions, keeps newer local work', () => {
    const local = [
      { id: 'a', updatedAt: T1 },
      { id: 'b', updatedAt: T2 },
    ];
    const incoming = [
      { id: 'a', updatedAt: T2 }, // newer in the file → restore
      { id: 'b', updatedAt: T1 }, // older in the file → keep local
      { id: 'c', updatedAt: T1 }, // missing here → restore
    ];
    expect(rowsToRestore(local, incoming).map((row) => row.id)).toEqual(['a', 'c']);
  });

  it('restoring the same file twice changes nothing the second time', () => {
    const incoming = [{ id: 'a', updatedAt: T1 }];
    expect(rowsToRestore(incoming, incoming)).toEqual([]);
  });
});

describe('extraActiveMesocycles', () => {
  it('keeps the plan started last and returns the other active ones', () => {
    const rows = [
      { id: 'old', startDate: '2026-08-01', updatedAt: T1, status: 'active' },
      { id: 'new', startDate: '2026-09-28', updatedAt: T1, status: 'active' },
      { id: 'done', startDate: '2026-07-01', updatedAt: T1, status: 'completed' },
    ];
    expect(extraActiveMesocycles(rows)).toEqual(['old']);
  });

  it('returns nothing when there is at most one active plan', () => {
    expect(
      extraActiveMesocycles([{ id: 'a', startDate: '2026-09-28', updatedAt: T1, status: 'active' }])
    ).toEqual([]);
  });
});
