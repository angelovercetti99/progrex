import { describe, expect, it } from 'vitest';

import { hasEquipmentFor, maxLoadFor } from './equipment';

describe('equipment', () => {
  const home = [{ type: 'dumbbells' as const, maxKg: 20 }, { type: 'bench' as const }];

  it('needs every required item', () => {
    expect(hasEquipmentFor(['dumbbells', 'bench'], home)).toBe(true);
    expect(hasEquipmentFor(['barbell', 'bench'], home)).toBe(false);
    expect(hasEquipmentFor([], [])).toBe(true);
  });

  it('knows the heaviest load available for an exercise', () => {
    expect(maxLoadFor(['dumbbells', 'bench'], home)).toBe(20);
    expect(maxLoadFor(['dumbbells'], [{ type: 'dumbbells' }])).toBeUndefined();
    expect(maxLoadFor([], home)).toBeUndefined();
  });
});
