import {
  groupRows,
  isSyncTable,
  SYNC_PAGE_SIZE,
  SYNC_TABLES,
  SyncRequestSchema,
  type SyncResponse,
} from '@progrex/shared';
import { asc, gt, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { Hono } from 'hono';

import { syncRows } from '../db/schema';
import type { Env } from '../index';

/**
 * POST /sync — send what changed on this device, get what changed elsewhere.
 *
 * 1. Every row sent is saved if it's new or newer than the stored one
 *    (last write wins). Each saved row gets the next `server_seq`.
 * 2. The answer has the rows with `server_seq` above the device's cursor
 *    (at most SYNC_PAGE_SIZE; `more: true` means "ask again").
 */
export const sync = new Hono<{ Bindings: Env }>().post('/', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = SyncRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid_request' }, 400);
  }
  const { cursor, changes } = parsed.data;
  const db = drizzle(c.env.DB);

  // One statement per row, run together in one transaction (a D1 batch).
  // The next number is computed by SQLite itself, inside the transaction, so
  // two devices syncing at once can never get the same number.
  const writes = SYNC_TABLES.flatMap((table) =>
    changes[table].map((row) =>
      db
        .insert(syncRows)
        .values({
          tableName: table,
          id: row.id,
          updatedAt: row.updatedAt,
          data: row,
          serverSeq: sql`(SELECT COALESCE(MAX(${syncRows.serverSeq}), 0) + 1 FROM ${syncRows})`,
        })
        .onConflictDoUpdate({
          target: [syncRows.tableName, syncRows.id],
          set: {
            updatedAt: sql`excluded.updated_at`,
            data: sql`excluded.data`,
            serverSeq: sql`excluded.server_seq`,
          },
          // Last write wins: an older (or the same) version changes nothing.
          setWhere: sql`excluded.updated_at > ${syncRows.updatedAt}`,
        })
    )
  );
  if (writes.length > 0) {
    await db.batch(writes as [(typeof writes)[number], ...(typeof writes)[number][]]);
  }

  // Everything after the device's cursor, oldest first. This includes the
  // rows it just sent: harmless, the app skips versions it already has.
  const rows = await db
    .select()
    .from(syncRows)
    .where(gt(syncRows.serverSeq, cursor))
    .orderBy(asc(syncRows.serverSeq))
    .limit(SYNC_PAGE_SIZE);

  const response: SyncResponse = {
    cursor: rows.at(-1)?.serverSeq ?? cursor,
    changes: groupRows(
      rows
        .filter((row) => isSyncTable(row.tableName))
        .map((row) => ({
          table: row.tableName as (typeof SYNC_TABLES)[number],
          data: row.data,
        }))
    ),
    more: rows.length === SYNC_PAGE_SIZE,
  };
  return c.json(response);
});
