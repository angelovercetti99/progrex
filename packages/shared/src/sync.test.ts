import { describe, expect, it } from 'vitest';

import { rowsToRestore } from './backup';
import {
  countRows,
  emptyChanges,
  groupRows,
  isSyncTable,
  SYNC_PAGE_SIZE,
  SyncRequestSchema,
  SyncResponseSchema,
} from './sync';

const stamps = { createdAt: '2026-10-01T10:00:00.000Z', updatedAt: '2026-10-01T10:00:00.000Z' };
const location = { id: 'loc-1', name: 'Ginásio', equipment: [{ type: 'dumbbells' }], ...stamps };
const set = {
  id: 'set-1',
  workoutExerciseId: 'we-1',
  position: 0,
  reps: 10,
  weightKg: 20,
  rir: 2,
  ...stamps,
};

describe('sync contract', () => {
  it('accepts a request with only some tables (the rest count as empty)', () => {
    const parsed = SyncRequestSchema.parse({ cursor: 0, changes: { locations: [location] } });
    expect(parsed.changes.locations).toHaveLength(1);
    expect(parsed.changes.sets).toEqual([]);
    // Missing optional columns become null, like in a backup.
    expect(parsed.changes.locations[0].deletedAt).toBeNull();
  });

  it('refuses a malformed row, a negative cursor and too many rows', () => {
    expect(
      SyncRequestSchema.safeParse({ cursor: 0, changes: { sets: [{ ...set, reps: -1 }] } }).success
    ).toBe(false);
    expect(SyncRequestSchema.safeParse({ cursor: -1, changes: {} }).success).toBe(false);
    const many = Array.from({ length: SYNC_PAGE_SIZE + 1 }, (_, i) => ({ ...set, id: `set-${i}` }));
    expect(SyncRequestSchema.safeParse({ cursor: 0, changes: { sets: many } }).success).toBe(false);
  });

  it('drops fields it does not know (e.g. the local-only dirty flag)', () => {
    const parsed = SyncRequestSchema.parse({ cursor: 3, changes: { sets: [{ ...set, dirty: true }] } });
    expect(parsed.changes.sets[0]).not.toHaveProperty('dirty');
  });

  it('parses an answer and groups stored rows back by table', () => {
    const changes = groupRows([
      { table: 'locations', data: location },
      { table: 'sets', data: set },
    ]);
    expect(countRows(changes)).toBe(2);
    const answer = SyncResponseSchema.parse({ cursor: 7, changes, more: false });
    expect(answer.changes.locations[0].name).toBe('Ginásio');
    expect(countRows(emptyChanges())).toBe(0);
  });

  it('only knows the synced tables', () => {
    expect(isSyncTable('sets')).toBe(true);
    expect(isSyncTable('preferences')).toBe(false);
  });

  it('last write wins: only new or newer rows are applied', () => {
    const local = [{ id: 'a', updatedAt: '2026-10-02T00:00:00Z' }];
    const incoming = [
      { id: 'a', updatedAt: '2026-10-01T00:00:00Z' }, // older: ignored
      { id: 'b', updatedAt: '2026-10-01T00:00:00Z' }, // new: applied
    ];
    expect(rowsToRestore(local, incoming).map((row) => row.id)).toEqual(['b']);
    // The same version again changes nothing (an echo of our own change).
    expect(rowsToRestore(local, [{ id: 'a', updatedAt: '2026-10-02T00:00:00Z' }])).toEqual([]);
  });
});
