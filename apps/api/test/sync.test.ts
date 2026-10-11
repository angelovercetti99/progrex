import { SELF } from 'cloudflare:test';
import { SYNC_PAGE_SIZE, type SyncResponse } from '@progrex/shared';
import { describe, expect, it } from 'vitest';

import { bearerToken, safeEqual } from '../src/auth';

const KEY = 'test-key';

function sync(body: unknown, key: string | null = KEY) {
  return SELF.fetch('https://api.test/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(key ? { Authorization: `Bearer ${key}` } : {}) },
    body: JSON.stringify(body),
  });
}

async function syncOk(body: unknown): Promise<SyncResponse> {
  const response = await sync(body);
  expect(response.status).toBe(200);
  return response.json();
}

const location = (id: string, name: string, updatedAt: string) => ({
  id,
  name,
  equipment: [],
  createdAt: '2026-10-01T10:00:00.000Z',
  updatedAt,
});

describe('the personal key', () => {
  it('refuses requests without the key or with a wrong one', async () => {
    expect((await sync({ cursor: 0, changes: {} }, null)).status).toBe(401);
    expect((await sync({ cursor: 0, changes: {} }, 'wrong-key')).status).toBe(401);
    expect((await sync({ cursor: 0, changes: {} }, `${KEY}x`)).status).toBe(401);
  });

  it('compares keys without stopping at the first difference', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
    expect(safeEqual('', 'abc')).toBe(false);
    expect(bearerToken('Bearer abc')).toBe('abc');
    expect(bearerToken('Basic abc')).toBeNull();
    expect(bearerToken(undefined)).toBeNull();
  });

  it('answers the browser preflight (CORS) without the key', async () => {
    const response = await SELF.fetch('https://api.test/sync', {
      method: 'OPTIONS',
      headers: { Origin: 'http://localhost:8081', 'Access-Control-Request-Method': 'POST' },
    });
    expect(response.status).toBeLessThan(300);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });
});

describe('POST /sync', () => {
  it('refuses a body that is not a valid sync request', async () => {
    expect((await sync({ cursor: 'zero' })).status).toBe(400);
    expect((await sync({ cursor: 0, changes: { sets: [{ id: 'x' }] } })).status).toBe(400);
  });

  it('another device receives what one device sent, and the cursor moves on', async () => {
    const first = await syncOk({
      cursor: 0,
      changes: { locations: [location('a', 'Ginásio', '2026-10-01T10:00:00.000Z')] },
    });
    expect(first.cursor).toBe(1);

    const other = await syncOk({ cursor: 0, changes: {} });
    expect(other.changes.locations.map((row) => row.name)).toEqual(['Ginásio']);
    expect(other.more).toBe(false);

    // Nothing new since the last cursor.
    const again = await syncOk({ cursor: other.cursor, changes: {} });
    expect(again.changes.locations).toEqual([]);
    expect(again.cursor).toBe(other.cursor);
  });

  it('last write wins: an older version is ignored, a newer one replaces it', async () => {
    await syncOk({
      cursor: 0,
      changes: { locations: [location('a', 'Ginásio', '2026-10-02T10:00:00.000Z')] },
    });
    // A device that was offline sends an older edit: it loses.
    await syncOk({ cursor: 0, changes: { locations: [location('a', 'Casa', '2026-10-01T10:00:00.000Z')] } });
    let state = await syncOk({ cursor: 0, changes: {} });
    expect(state.changes.locations.map((row) => row.name)).toEqual(['Ginásio']);

    // A newer edit wins, and gets a new number so every device sees it.
    const before = state.cursor;
    await syncOk({ cursor: 0, changes: { locations: [location('a', 'Hotel', '2026-10-03T10:00:00.000Z')] } });
    state = await syncOk({ cursor: before, changes: {} });
    expect(state.changes.locations.map((row) => row.name)).toEqual(['Hotel']);
    expect(state.cursor).toBeGreaterThan(before);
  });

  it('keeps deletions (tombstones) so other devices learn about them', async () => {
    const deleted = {
      ...location('a', 'Ginásio', '2026-10-02T10:00:00.000Z'),
      deletedAt: '2026-10-02T10:00:00.000Z',
    };
    await syncOk({ cursor: 0, changes: { locations: [deleted] } });
    const state = await syncOk({ cursor: 0, changes: {} });
    expect(state.changes.locations[0].deletedAt).toBe('2026-10-02T10:00:00.000Z');
  });

  it('sends big histories in pages', async () => {
    const rows = Array.from({ length: SYNC_PAGE_SIZE }, (_, i) =>
      location(`loc-${String(i).padStart(4, '0')}`, `Espaço ${i}`, '2026-10-01T10:00:00.000Z')
    );
    await syncOk({ cursor: 0, changes: { locations: rows } });
    await syncOk({
      cursor: 0,
      changes: { locations: [location('last', 'Último', '2026-10-01T10:00:00.000Z')] },
    });

    const page1 = await syncOk({ cursor: 0, changes: {} });
    expect(page1.changes.locations).toHaveLength(SYNC_PAGE_SIZE);
    expect(page1.more).toBe(true);
    const page2 = await syncOk({ cursor: page1.cursor, changes: {} });
    expect(page2.changes.locations.map((row) => row.name)).toEqual(['Último']);
    expect(page2.more).toBe(false);
  });
});
