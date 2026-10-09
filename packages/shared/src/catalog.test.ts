import { describe, expect, it } from 'vitest';

import { CATALOG } from './catalog';

describe('catalog', () => {
  it('has unique keys (ids must never collide)', () => {
    const keys = CATALOG.map((exercise) => exercise.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('gives every loaded exercise a weight increment', () => {
    for (const exercise of CATALOG.filter((e) => e.loadType === 'external')) {
      expect(exercise.loadIncrementKg, exercise.key).toBeGreaterThan(0);
    }
  });

  it('gives bodyweight and band exercises no weight increment', () => {
    for (const exercise of CATALOG.filter((e) => e.loadType !== 'external')) {
      expect(exercise.loadIncrementKg, exercise.key).toBe(0);
    }
  });
});
