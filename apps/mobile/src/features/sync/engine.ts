import {
  countRows,
  emptyChanges,
  extraActiveMesocycles,
  SYNC_PAGE_SIZE,
  SYNC_TABLES,
  SyncResponseSchema,
  type SyncChanges,
  type SyncTable,
} from '@progrex/shared';
import { and, eq, inArray } from 'drizzle-orm';

import { db } from '@/db/client';
import { notifyChanged, type TableName } from '@/db/live';
import { mesocycles, sets } from '@/db/schema';
import { nowIso, updateStamps } from '@/db/stamps';
import { SYNCED_TABLES, upsertNewerRows } from '@/db/upsert';
import { getPreference, setPreference } from '@/lib/preferences';

import { getCredentials, setCredentials, type SyncCredentials } from './credentials';

/**
 * The sync engine (docs/decisoes.md §8 and §47), in four steps per round:
 * 1. collect the rows changed here (`dirty`);
 * 2. send them with the cursor ("I have everything up to N");
 * 3. apply what comes back, if it's newer (last write wins);
 * 4. mark what was sent as clean and save the new cursor.
 * Rounds repeat while there is more to send or receive.
 *
 * Failures are quiet: the data stays dirty and goes on the next try.
 */

export type SyncError = 'unauthorized' | 'unreachable' | 'server';
export type SyncResult = { ok: true } | { ok: false; error: SyncError } | { ok: false; error: 'off' };

const CURSOR_KEY = 'syncCursor';
const LAST_SYNC_KEY = 'syncLastAt';
const ERROR_KEY = 'syncError';
/** Safety net: a sync never loops forever. */
const MAX_ROUNDS = 40;
const TIMEOUT_MS = 20_000;

/** Live-query names of the synced tables. */
const LIVE_NAMES: Record<SyncTable, TableName> = {
  exercises: 'exercises',
  locations: 'locations',
  mesocycles: 'mesocycles',
  workouts: 'workouts',
  workoutExercises: 'workout_exercises',
  sets: 'sets',
};

/** True while the engine writes rows it received (those writes need no new sync). */
export let applyingRemoteChanges = false;

let running: Promise<SyncResult> | null = null;
let runAgain = false;

/** Syncs now. Calls made while a sync runs wait for it and then run once more. */
export function syncNow(): Promise<SyncResult> {
  if (running) {
    runAgain = true;
    return running;
  }
  running = (async () => {
    let result: SyncResult;
    do {
      runAgain = false;
      result = await syncOnce();
    } while (runAgain && result.ok);
    return result;
  })().finally(() => {
    running = null;
  });
  return running;
}

async function syncOnce(): Promise<SyncResult> {
  const credentials = await getCredentials();
  if (!credentials) return { ok: false, error: 'off' };
  const result = await runRounds(credentials);
  if (result.ok) {
    await setPreference(LAST_SYNC_KEY, nowIso());
    await setPreference(ERROR_KEY, '');
  } else if (result.error !== 'off') {
    await setPreference(ERROR_KEY, result.error);
  }
  return result;
}

async function runRounds(credentials: SyncCredentials): Promise<SyncResult> {
  let cursor = Number((await getPreference(CURSOR_KEY)) ?? 0) || 0;
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const { changes, sent } = await collectDirtyRows();

    let response: Response;
    try {
      response = await fetchWithTimeout(`${credentials.url}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${credentials.token}` },
        body: JSON.stringify({ cursor, changes }),
      });
    } catch {
      return { ok: false, error: 'unreachable' };
    }
    if (response.status === 401) return { ok: false, error: 'unauthorized' };
    if (!response.ok) return { ok: false, error: 'server' };

    const parsed = SyncResponseSchema.safeParse(await response.json().catch(() => null));
    if (!parsed.success) return { ok: false, error: 'server' };

    await applyRemoteChanges(parsed.data.changes);
    await markClean(sent);
    cursor = parsed.data.cursor;
    await setPreference(CURSOR_KEY, String(cursor));

    const moreToSend = countRows(changes) === SYNC_PAGE_SIZE;
    if (!parsed.data.more && !moreToSend) return { ok: true };
  }
  return { ok: true };
}

type SentRow = { table: SyncTable; id: string; updatedAt: string };

/** Up to one page of rows changed on this device, parents first. */
async function collectDirtyRows(): Promise<{ changes: SyncChanges; sent: SentRow[] }> {
  const changes = emptyChanges() as Record<SyncTable, unknown[]>;
  const sent: SentRow[] = [];
  for (const name of SYNC_TABLES) {
    const room = SYNC_PAGE_SIZE - sent.length;
    if (room <= 0) break;
    const table = SYNCED_TABLES[name] as unknown as typeof sets;
    const rows = await db.select().from(table).where(eq(table.dirty, true)).limit(room);
    for (const row of rows) {
      // Local-only fields never leave the device.
      const { dirty: _dirty, isBuiltin: _isBuiltin, ...data } = row as typeof row & { isBuiltin?: boolean };
      changes[name].push(data);
      sent.push({ table: name, id: row.id, updatedAt: row.updatedAt });
    }
  }
  return { changes: changes as SyncChanges, sent };
}

/** Writes the rows received, if newer. They're not dirty: they came from the server. */
async function applyRemoteChanges(changes: SyncChanges): Promise<void> {
  if (countRows(changes) === 0) return;
  const touched: TableName[] = [];
  applyingRemoteChanges = true;
  try {
    for (const name of SYNC_TABLES) {
      const written = await upsertNewerRows(name, changes[name], false);
      if (written > 0) touched.push(LIVE_NAMES[name]);
    }
    // Two devices may each have started a plan: the newest stays active.
    if (touched.includes('mesocycles')) {
      const extra = extraActiveMesocycles(await db.select().from(mesocycles));
      if (extra.length) {
        await db
          .update(mesocycles)
          .set({ status: 'abandoned', ...updateStamps() })
          .where(inArray(mesocycles.id, extra));
      }
    }
    // Screens re-read now; the auto-sync ignores these writes (they came from the server).
    if (touched.length) notifyChanged(...touched);
  } finally {
    applyingRemoteChanges = false;
  }
}

/** Clears `dirty` on what was sent, unless the row changed again meanwhile. */
async function markClean(sent: SentRow[]): Promise<void> {
  for (const row of sent) {
    const table = SYNCED_TABLES[row.table] as unknown as typeof sets;
    await db
      .update(table)
      .set({ dirty: false })
      .where(and(eq(table.id, row.id), eq(table.updatedAt, row.updatedAt)));
  }
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** "https://x.workers.dev/" → "https://x.workers.dev". Null when it isn't a web address. */
export function normalizeServerUrl(input: string): string | null {
  const url = input.trim().replace(/\/+$/, '');
  return /^https?:\/\/[^\s/]+/.test(url) ? url : null;
}

/**
 * Connects this device: saves the address and key, then syncs once to
 * check them. If that fails, nothing is kept and the reason is returned.
 */
export async function connect(url: string, token: string): Promise<SyncResult> {
  await setCredentials({ url, token: token.trim() });
  // A new connection starts from the beginning: receive everything once.
  await setPreference(CURSOR_KEY, '0');
  const result = await syncNow();
  if (!result.ok && result.error !== 'off') await setCredentials(null);
  return result;
}

/** Disconnects this device. The data stays here; it just stops syncing. */
export async function disconnect(): Promise<void> {
  await setCredentials(null);
  await setPreference(CURSOR_KEY, '0');
  await setPreference(LAST_SYNC_KEY, '');
  await setPreference(ERROR_KEY, '');
}

export type SyncStatus = {
  connected: boolean;
  url: string | null;
  lastSyncAt: string | null;
  error: SyncError | null;
};

/** For Settings: connected or not, when it last worked, and the last problem. */
export async function getSyncStatus(): Promise<SyncStatus> {
  const credentials = await getCredentials();
  const lastSyncAt = (await getPreference(LAST_SYNC_KEY)) || null;
  const error = ((await getPreference(ERROR_KEY)) || null) as SyncError | null;
  return { connected: credentials !== null, url: credentials?.url ?? null, lastSyncAt, error };
}
