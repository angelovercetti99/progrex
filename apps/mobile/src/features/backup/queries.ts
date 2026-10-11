import {
  BACKUP_TABLES,
  BACKUP_VERSION,
  extraActiveMesocycles,
  parseBackup,
  type Backup,
} from '@progrex/shared';
import { eq, inArray } from 'drizzle-orm';

import { db } from '@/db/client';
import { notifyChanged } from '@/db/live';
import { upsertNewerRows } from '@/db/upsert';
import { exercises, locations, mesocycles, preferences, sets, workoutExercises, workouts } from '@/db/schema';
import { nowIso, todayLocalDate, updateStamps } from '@/db/stamps';

/**
 * Backup: every row of your training in one JSON file (docs/decisoes.md §48).
 * The file format and its checks live in `packages/shared/src/backup.ts`.
 */

/** Settings that describe you, not this device. Language and theme stay per device. */
const BACKUP_PREFERENCES = ['goal', 'currentLocationId', 'showRir', 'effortIntroSeen', 'quickStartSkipped'];

/** Sample data (`demo:*`) is never part of a backup. */
const isDemo = (id: string) => id.startsWith('demo:');

/** Removes the local-only `dirty` flag from a row. */
function withoutDirty<T extends { dirty: boolean }>({ dirty: _dirty, ...row }: T) {
  return row;
}

export type BackupFile = { name: string; contents: string };

export async function exportBackup(): Promise<BackupFile> {
  const workoutRows = (await db.select().from(workouts)).filter((row) => !isDemo(row.id));
  // A sample place you trained at for real is part of your history: keep it.
  const usedPlaces = new Set(workoutRows.map((row) => row.locationId));
  const prefs = await db.select().from(preferences).where(inArray(preferences.key, BACKUP_PREFERENCES));

  const backup: Backup = {
    app: 'progrex',
    version: BACKUP_VERSION,
    exportedAt: nowIso(),
    tables: {
      exercises: (await db.select().from(exercises).where(eq(exercises.isBuiltin, false))).map(
        ({ isBuiltin: _isBuiltin, ...row }) => withoutDirty(row)
      ),
      locations: (await db.select().from(locations))
        .filter((row) => !isDemo(row.id) || usedPlaces.has(row.id))
        .map(withoutDirty),
      mesocycles: (await db.select().from(mesocycles)).map(withoutDirty),
      workouts: workoutRows.map(withoutDirty),
      workoutExercises: (await db.select().from(workoutExercises))
        .filter((row) => !isDemo(row.id))
        .map(withoutDirty),
      sets: (await db.select().from(sets)).filter((row) => !isDemo(row.id)).map(withoutDirty),
    },
    preferences: Object.fromEntries(prefs.map((row) => [row.key, row.value])),
  };

  return { name: `progrex-backup-${todayLocalDate()}.json`, contents: JSON.stringify(backup) };
}

export type RestoreResult = { ok: true; workouts: number } | { ok: false };

/**
 * Merges a backup into this device. Never deletes anything and never
 * overwrites a newer version of a row (same rule as sync), so it is safe to
 * restore on a device that already has data, or to restore twice.
 */
export async function restoreBackup(text: string): Promise<RestoreResult> {
  const backup = parseBackup(text);
  if (!backup) return { ok: false };

  let restoredWorkouts = 0;
  for (const name of BACKUP_TABLES) {
    // Restored rows still have to reach the server: they stay dirty.
    const restored = await upsertNewerRows(name, backup.tables[name], true);
    if (name === 'workouts') restoredWorkouts = restored;
  }

  // Two devices may each have had an active plan: keep the newest.
  const extra = extraActiveMesocycles(await db.select().from(mesocycles));
  if (extra.length) {
    await db
      .update(mesocycles)
      .set({ status: 'abandoned', ...updateStamps() })
      .where(inArray(mesocycles.id, extra));
  }

  // Settings: only the ones this device doesn't have yet.
  const known = new Set((await db.select({ key: preferences.key }).from(preferences)).map((row) => row.key));
  for (const [key, value] of Object.entries(backup.preferences)) {
    if (BACKUP_PREFERENCES.includes(key) && !known.has(key)) {
      await db.insert(preferences).values({ key, value });
    }
  }

  notifyChanged(
    'exercises',
    'locations',
    'mesocycles',
    'workouts',
    'workout_exercises',
    'sets',
    'preferences'
  );
  return { ok: true, workouts: restoredWorkouts };
}
