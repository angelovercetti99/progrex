import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * The server keeps ONE table for every synced row (docs/decisoes.md §47).
 *
 * It doesn't need to understand a workout or a set: it stores each row as
 * JSON (already checked with Zod), keeps the newest version (last write
 * wins, by `updated_at`) and numbers every change (`server_seq`) so each
 * device can ask "what changed after number X?".
 */
export const syncRows = sqliteTable(
  'sync_rows',
  {
    /** Which app table the row belongs to: 'workouts', 'sets'… */
    tableName: text('table_name').notNull(),
    id: text('id').notNull(),
    /** The row's own `updatedAt`, used to decide which version wins. */
    updatedAt: text('updated_at').notNull(),
    /** The row itself, exactly as the app sent it. */
    data: text('data', { mode: 'json' }).notNull(),
    /** Grows by one on every accepted change; never repeats, never goes back. */
    serverSeq: integer('server_seq').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tableName, table.id] }),
    index('sync_rows_server_seq_idx').on(table.serverSeq),
  ]
);
