import { z } from 'zod';

import { BACKUP_TABLES, BackupSchema, type BackupTable, type BackupTables } from './backup';

/**
 * The contract between the app and the Worker for `POST /sync`
 * (docs/decisoes.md §8 and §47). Both sides parse with these schemas, so a
 * malformed request is refused by the server and a malformed answer is
 * ignored by the app.
 *
 * Rows have the same shape as in a backup file: camelCase, no local-only
 * `dirty` flag. Reusing the backup schemas means one definition per table.
 */

/** Parent tables first: the order in which rows are applied. */
export const SYNC_TABLES: readonly BackupTable[] = BACKUP_TABLES;
export type SyncTable = BackupTable;
export type SyncChanges = BackupTables;

/** Most rows in one request or one answer. Bigger syncs take several rounds. */
export const SYNC_PAGE_SIZE = 500;

const tables = BackupSchema.shape.tables.shape;

/** Rows per table. A missing table means "nothing for this table". */
const ChangesSchema = z.object({
  exercises: tables.exercises.default([]),
  locations: tables.locations.default([]),
  mesocycles: tables.mesocycles.default([]),
  workouts: tables.workouts.default([]),
  workoutExercises: tables.workoutExercises.default([]),
  sets: tables.sets.default([]),
});

export function countRows(changes: Partial<Record<SyncTable, unknown[]>>): number {
  return SYNC_TABLES.reduce((total, table) => total + (changes[table]?.length ?? 0), 0);
}

export function emptyChanges(): SyncChanges {
  return { exercises: [], locations: [], mesocycles: [], workouts: [], workoutExercises: [], sets: [] };
}

/** What the app sends: what it already has (`cursor`) and what changed here. */
export const SyncRequestSchema = z.object({
  /** "I have every change up to this server number." 0 = nothing yet. */
  cursor: z.number().int().nonnegative(),
  changes: ChangesSchema.refine((changes) => countRows(changes) <= SYNC_PAGE_SIZE, {
    message: `At most ${SYNC_PAGE_SIZE} rows per request`,
  }),
});
export type SyncRequest = z.infer<typeof SyncRequestSchema>;

/** What the Worker answers: changes the app doesn't have yet, and the new cursor. */
export const SyncResponseSchema = z.object({
  cursor: z.number().int().nonnegative(),
  changes: ChangesSchema,
  /** More changes are waiting: ask again with the new cursor. */
  more: z.boolean(),
});
export type SyncResponse = z.infer<typeof SyncResponseSchema>;

/** Groups stored rows (one per table + id) back into `changes`. */
export function groupRows(rows: { table: SyncTable; data: unknown }[]): SyncChanges {
  const changes = emptyChanges() as Record<SyncTable, unknown[]>;
  for (const row of rows) changes[row.table].push(row.data);
  return changes as SyncChanges;
}

/** Is this one of the tables we sync? (Guards input that names a table.) */
export function isSyncTable(name: string): name is SyncTable {
  return (SYNC_TABLES as readonly string[]).includes(name);
}
