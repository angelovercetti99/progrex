import { rowsToRestore, type SyncTable } from '@progrex/shared';
import { getTableColumns, inArray, sql } from 'drizzle-orm';

import { db } from './client';
import { exercises, locations, mesocycles, sets, workoutExercises, workouts } from './schema';

/** The synced tables, by the names used in backups and sync. */
export const SYNCED_TABLES = {
  exercises,
  locations,
  mesocycles,
  workouts,
  workoutExercises,
  sets,
};

/**
 * Writes rows that came from elsewhere (a backup file or another device):
 * only the ones this device doesn't have, or has an older version of (last
 * write wins, docs/decisoes.md §8). Returns how many were written.
 *
 * `dirty`: true = still to be sent to the server (backups), false = it came
 * from the server, nothing to send back (sync).
 */
export async function upsertNewerRows(
  name: SyncTable,
  rows: { id: string; updatedAt: string }[],
  dirty: boolean
): Promise<number> {
  if (rows.length === 0) return 0;
  // Drizzle can't type a function that works on any of our tables, so we
  // use `sets` as the stand-in type: all tables share id/updatedAt/dirty.
  const table = SYNCED_TABLES[name] as unknown as typeof sets;

  const local: { id: string; updatedAt: string }[] = [];
  const ids = rows.map((row) => row.id);
  for (let i = 0; i < ids.length; i += 200) {
    local.push(
      ...(await db
        .select({ id: table.id, updatedAt: table.updatedAt })
        .from(table)
        .where(inArray(table.id, ids.slice(i, i + 200))))
    );
  }

  const changed = rowsToRestore(local, rows).map((row) => ({
    ...row,
    // Exercises that travel between devices are always the user's own.
    ...(name === 'exercises' ? { isBuiltin: false } : {}),
    dirty,
  }));

  // "Insert, or replace the old version": every column takes the new value.
  // (`excluded` is SQLite's name for the row we tried to insert.)
  const set = Object.fromEntries(
    Object.entries(getTableColumns(table))
      .filter(([key]) => key !== 'id')
      .map(([key, column]) => [key, sql.raw(`excluded."${column.name}"`)])
  ) as Partial<typeof sets.$inferInsert>;

  // Small batches keep each SQL statement short.
  for (let i = 0; i < changed.length; i += 20) {
    await db
      .insert(table)
      .values(changed.slice(i, i + 20) as unknown as (typeof sets.$inferInsert)[])
      .onConflictDoUpdate({ target: table.id, set });
  }
  return changed.length;
}
