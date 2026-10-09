import { describe, expect, it } from 'vitest';

import { GOALS } from '../training';
import { estimateMinutes, generateMesocycle } from './generate';
import { DAYS_PER_WEEK, EXPERIENCE_LEVELS, SESSION_MINUTES, type BodyArea, type Mesocycle } from './schema';
import { validateMesocycle } from './validate';

describe('generateMesocycle', () => {
  it('produces a valid plan for every combination of choices', () => {
    let count = 0;
    for (const goal of GOALS)
      for (const daysPerWeek of DAYS_PER_WEEK)
        for (const sessionMinutes of SESSION_MINUTES)
          for (const experience of EXPERIENCE_LEVELS) {
            const plan = generateMesocycle({ goal, daysPerWeek, sessionMinutes, experience });
            expect(
              validateMesocycle(plan),
              `${goal}/${daysPerWeek}d/${sessionMinutes}min/${experience}`
            ).toEqual([]);
            count++;
          }
    expect(count).toBe(240);
  });

  it('has one session per training day, named A, B, C…', () => {
    const plan = generateMesocycle({
      goal: 'hypertrophy',
      daysPerWeek: 4,
      sessionMinutes: 60,
      experience: 'intermediate',
    });
    expect(plan.sessions.map((s) => s.key)).toEqual(['A', 'B', 'C', 'D']);
    expect(plan.sessions.map((s) => s.focus)).toEqual(['upper', 'lower', 'upper', 'lower']);
  });

  it('ends with a deload and makes effort rise before it', () => {
    const plan = generateMesocycle({
      goal: 'hypertrophy',
      daysPerWeek: 3,
      sessionMinutes: 60,
      experience: 'intermediate',
    });
    expect(plan.weeks.map((w) => w.rir)).toEqual([3, 2, 2, 1, 4]);
    expect(plan.weeks.at(-1)?.deload).toBe(true);
  });

  it('gives beginners a shorter block', () => {
    const plan = generateMesocycle({
      goal: 'hypertrophy',
      daysPerWeek: 3,
      sessionMinutes: 60,
      experience: 'beginner',
    });
    expect(plan.weeks).toHaveLength(4);
  });

  it('adds volume in the second half for intermediate hypertrophy, halves it in the deload', () => {
    const plan = generateMesocycle({
      goal: 'hypertrophy',
      daysPerWeek: 3,
      sessionMinutes: 75,
      experience: 'intermediate',
    });
    const squat = plan.sessions[0].slots.find((slot) => slot.pattern === 'squat')!;
    expect(squat.setsPerWeek).toEqual([3, 3, 4, 4, 2]);
  });

  it('drops isolation work first when time is short', () => {
    const long = generateMesocycle({
      goal: 'hypertrophy',
      daysPerWeek: 4,
      sessionMinutes: 75,
      experience: 'intermediate',
    });
    const short = generateMesocycle({
      goal: 'hypertrophy',
      daysPerWeek: 4,
      sessionMinutes: 30,
      experience: 'intermediate',
    });
    const mainPatterns = (plan: typeof long) =>
      plan.sessions[0].slots.filter((s) => s.main).map((s) => s.pattern);
    expect(mainPatterns(short)).toEqual(mainPatterns(long));
    expect(short.sessions[0].slots.length).toBeLessThan(long.sessions[0].slots.length);
    expect(estimateMinutes(short.sessions[0].slots, short.restSeconds)).toBeLessThanOrEqual(40);
  });

  it('keeps general health away from failure', () => {
    const plan = generateMesocycle({
      goal: 'general_health',
      daysPerWeek: 2,
      sessionMinutes: 45,
      experience: 'beginner',
    });
    const workWeeks = plan.weeks.filter((w) => !w.deload);
    expect(Math.min(...workWeeks.map((w) => w.rir))).toBeGreaterThanOrEqual(3);
  });
});

describe('validateMesocycle', () => {
  const plan = generateMesocycle({
    goal: 'strength',
    daysPerWeek: 3,
    sessionMinutes: 60,
    experience: 'intermediate',
  });

  it('rejects something that is not a plan at all', () => {
    expect(validateMesocycle({ hello: 'world' }).length).toBeGreaterThan(0);
  });

  it('rejects a plan without a deload', () => {
    const broken = { ...plan, weeks: plan.weeks.map((w) => ({ ...w, deload: false })) };
    expect(validateMesocycle(broken)).toContain('weeks: exactly one deload week, at the end');
  });

  it('rejects a plan that never trains the hinge', () => {
    const broken = {
      ...plan,
      sessions: plan.sessions.map((s) => ({
        ...s,
        slots: s.slots.filter((slot) => slot.pattern !== 'hinge'),
      })),
    };
    expect(validateMesocycle(broken)).toContain('coverage: no hinge');
  });
});

describe('priority areas (body map)', () => {
  const weeklySets = (plan: Mesocycle, patterns: string[], week = 0) =>
    plan.sessions
      .flatMap((s) => s.slots)
      .filter((slot) => patterns.includes(slot.pattern))
      .reduce((sum, slot) => sum + slot.setsPerWeek[week], 0);

  it('stays valid for every combination of choices and areas', () => {
    const areaSets: BodyArea[][] = [
      ['chest'],
      ['back', 'glutes'],
      ['shoulders', 'arms', 'calves'],
      ['legs', 'core'],
    ];
    for (const priorityAreas of areaSets)
      for (const goal of GOALS)
        for (const daysPerWeek of DAYS_PER_WEEK)
          for (const sessionMinutes of SESSION_MINUTES)
            for (const experience of EXPERIENCE_LEVELS) {
              const plan = generateMesocycle({
                goal,
                daysPerWeek,
                sessionMinutes,
                experience,
                priorityAreas,
              });
              expect(
                validateMesocycle(plan),
                `${priorityAreas.join('+')}/${goal}/${daysPerWeek}d/${sessionMinutes}min/${experience}`
              ).toEqual([]);
            }
  });

  it('gives a prioritised area more weekly sets', () => {
    const request = {
      goal: 'hypertrophy',
      daysPerWeek: 4,
      sessionMinutes: 75,
      experience: 'intermediate',
    } as const;
    const plain = generateMesocycle(request);
    const chest = generateMesocycle({ ...request, priorityAreas: ['chest'] });
    expect(weeklySets(chest, ['horizontal_push'])).toBeGreaterThan(weeklySets(plain, ['horizontal_push']));
    expect(chest.priorityAreas).toEqual(['chest']);
  });

  it('adds side-delt work twice a week when shoulders are a priority', () => {
    const request = {
      goal: 'hypertrophy',
      daysPerWeek: 3,
      sessionMinutes: 75,
      experience: 'intermediate',
    } as const;
    const plan = generateMesocycle({ ...request, priorityAreas: ['shoulders'] });
    const sessionsWithDelts = plan.sessions.filter((s) =>
      s.slots.some((slot) => slot.pattern === 'lateral_delts')
    );
    expect(sessionsWithDelts.length).toBeGreaterThanOrEqual(2);
  });

  it('keeps prioritised isolation work when time is short', () => {
    const request = {
      goal: 'hypertrophy',
      daysPerWeek: 4,
      sessionMinutes: 45,
      experience: 'intermediate',
    } as const;
    const plain = generateMesocycle(request);
    const arms = generateMesocycle({ ...request, priorityAreas: ['arms'] });
    const armSlots = (plan: Mesocycle) =>
      plan.sessions.flatMap((s) => s.slots).filter((slot) => ['biceps', 'triceps'].includes(slot.pattern))
        .length;
    expect(armSlots(arms)).toBeGreaterThan(armSlots(plain));
  });

  it('changes nothing when no area is chosen', () => {
    const request = { goal: 'strength', daysPerWeek: 3, sessionMinutes: 60, experience: 'beginner' } as const;
    expect(generateMesocycle({ ...request, priorityAreas: [] })).toEqual(generateMesocycle(request));
  });
});
