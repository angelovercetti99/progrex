import { describe, expect, it } from 'vitest';

import { builtinExerciseId, CATALOG } from '../catalog';
import { MAIN_PATTERNS, type LocationEquipment } from '../training';
import { harderVariant, selectVariant } from './variants';

const candidates = CATALOG.map((exercise) => ({ ...exercise, id: builtinExerciseId(exercise.key) }));
const id = (key: string) => builtinExerciseId(key);

const hotelRoom: LocationEquipment = [];
const home: LocationEquipment = [
  { type: 'dumbbells', maxKg: 20 },
  { type: 'bands' },
  { type: 'pull_up_bar' },
];
const gym: LocationEquipment = [
  { type: 'dumbbells' },
  { type: 'barbell' },
  { type: 'squat_rack' },
  { type: 'bench' },
  { type: 'pull_up_bar' },
  { type: 'cable_machine' },
  { type: 'machines' },
];

describe('selectVariant', () => {
  it('always finds something for every main pattern, even in an empty hotel room', () => {
    for (const pattern of MAIN_PATTERNS) {
      const choice = selectVariant({ pattern, available: hotelRoom, candidates });
      expect(choice, pattern).not.toBeNull();
      expect(choice?.equipment, pattern).toEqual([]);
    }
  });

  it('falls back from vertical to horizontal pull when there is no bar or band', () => {
    const choice = selectVariant({ pattern: 'vertical_pull', available: hotelRoom, candidates });
    expect(choice?.pattern).toBe('horizontal_pull');
  });

  it('uses the pull-up bar at home for vertical pulls', () => {
    const choice = selectVariant({ pattern: 'vertical_pull', available: home, candidates });
    expect(choice?.pattern).toBe('vertical_pull');
  });

  it('only picks exercises the place has equipment for', () => {
    const choice = selectVariant({ pattern: 'horizontal_push', available: home, candidates });
    expect(choice?.equipment.every((type) => home.some((item) => item.type === type))).toBe(true);
  });

  it('keeps the exercise used last time at this place', () => {
    const choice = selectVariant({
      pattern: 'horizontal_push',
      available: gym,
      candidates,
      preferredId: id('barbell_bench_press'),
    });
    expect(choice?.id).toBe(id('barbell_bench_press'));
  });

  it('ignores a preferred exercise this place cannot do', () => {
    const choice = selectVariant({
      pattern: 'horizontal_push',
      available: hotelRoom,
      candidates,
      preferredId: id('barbell_bench_press'),
    });
    expect(choice?.id).not.toBe(id('barbell_bench_press'));
  });

  it('prefers a loadable exercise of the target difficulty in a full gym', () => {
    const choice = selectVariant({ pattern: 'horizontal_push', available: gym, candidates });
    expect(choice?.id).toBe(id('dumbbell_bench_press'));
  });
});

describe('harderVariant', () => {
  it('steps up from push-ups to decline push-ups', () => {
    const pushUp = candidates.find((c) => c.id === id('push_up'))!;
    expect(harderVariant(pushUp, hotelRoom, candidates)?.id).toBe(id('decline_push_up'));
  });

  it('returns null when there is nothing harder here', () => {
    const pistol = candidates.find((c) => c.id === id('pistol_squat'))!;
    expect(harderVariant(pistol, hotelRoom, candidates)).toBeNull();
  });
});
