import { describe, expect, it } from 'vitest';

import { generateMesocycle } from './generate';
import { nextMesocycleRequest } from './next';

const TODAY = '2026-10-11';

describe('nextMesocycleRequest', () => {
  const plan = generateMesocycle({
    goal: 'fat_loss',
    experience: 'beginner',
    daysPerWeek: 4,
    sessionMinutes: 45,
    priorityAreas: ['glutes'],
    health: { conditions: ['diabetes'] },
    startDate: '2026-09-01',
  });

  it('keeps every choice of the block just finished', () => {
    expect(nextMesocycleRequest(plan, 1, TODAY)).toEqual({
      goal: 'fat_loss',
      experience: 'beginner',
      daysPerWeek: 4,
      sessionMinutes: 45,
      priorityAreas: ['glutes'],
      health: { conditions: ['diabetes'] },
      startDate: TODAY,
    });
  });

  it('a beginner moves up after a few completed blocks', () => {
    expect(nextMesocycleRequest(plan, 2, TODAY).experience).toBe('beginner');
    expect(nextMesocycleRequest(plan, 3, TODAY).experience).toBe('intermediate');
  });

  it('never assumes advanced', () => {
    const intermediate = { ...plan, experience: 'intermediate' as const };
    expect(nextMesocycleRequest(intermediate, 20, TODAY).experience).toBe('intermediate');
  });
});
