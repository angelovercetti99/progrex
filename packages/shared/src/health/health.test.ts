import { describe, expect, it } from 'vitest';

import { adaptSession } from '../adapt';
import { builtinExerciseId, CATALOG, exerciseTraits } from '../catalog';
import { generateMesocycle } from '../plan/generate';
import { validateMesocycle } from '../plan/validate';
import { selectVariant } from '../progression/variants';
import { EQUIPMENT_TYPES, MAIN_PATTERNS, type LocationEquipment } from '../training';
import {
  activeHealth,
  dateWeeksAgo,
  dueDateFromWeek,
  HEALTH_CONDITIONS,
  HEALTH_RULES,
  HEALTH_STAGES,
  healthStages,
  isAllowed,
  pregnancyWeek,
  type ActiveHealth,
  type HealthStage,
} from '.';

const TODAY = '2026-10-11';
const candidates = CATALOG.map((exercise) => ({ ...exercise, id: builtinExerciseId(exercise.key) }));

/** The rules of some stages, combined (as activeHealth would). */
function rulesFor(stages: HealthStage[]): ActiveHealth {
  const rules = stages.map((stage) => HEALTH_RULES[stage]);
  return {
    stages,
    avoid: new Set(rules.flatMap((rule) => rule.avoid)),
    minRir: Math.max(0, ...rules.map((rule) => rule.minRir)),
    minRestSeconds: Math.max(0, ...rules.map((rule) => rule.minRestSeconds ?? 0)),
    fewerSets: rules.some((rule) => rule.fewerSets),
    clearance: rules.some((rule) => rule.clearance),
    preWorkoutCheck: rules.some((rule) => rule.preWorkoutCheck),
  };
}

describe('pregnancy and postpartum follow the calendar', () => {
  it('works out the week from the due date, and back', () => {
    expect(pregnancyWeek(dueDateFromWeek(12, TODAY), TODAY)).toBe(12);
    expect(pregnancyWeek(dueDateFromWeek(30, TODAY), TODAY)).toBe(30);
  });

  it('moves through the trimesters on its own', () => {
    const stage = (week: number) =>
      healthStages({ conditions: ['pregnancy'], dueDate: dueDateFromWeek(week, TODAY) }, TODAY);
    expect(stage(8)).toEqual(['pregnancy_1']);
    expect(stage(20)).toEqual(['pregnancy_2']);
    expect(stage(34)).toEqual(['pregnancy_3']);
  });

  it('turns into postpartum after the due date, and ends after ~6 months', () => {
    const profile = { conditions: ['pregnancy' as const], dueDate: dateWeeksAgo(3, TODAY) };
    expect(healthStages(profile, TODAY)).toEqual(['postpartum_early']);
    expect(healthStages({ ...profile, dueDate: dateWeeksAgo(10, TODAY) }, TODAY)).toEqual(['postpartum']);
    expect(healthStages({ ...profile, dueDate: dateWeeksAgo(30, TODAY) }, TODAY)).toEqual([]);
  });

  it('postpartum on its own uses the birth date', () => {
    expect(healthStages({ conditions: ['postpartum'], birthDate: dateWeeksAgo(2, TODAY) }, TODAY)).toEqual([
      'postpartum_early',
    ]);
    // Without a date there is nothing to work out from: no rules guessed.
    expect(healthStages({ conditions: ['postpartum'] }, TODAY)).toEqual([]);
  });
});

describe('combining conditions', () => {
  it('nothing changes without conditions', () => {
    const health = activeHealth({ conditions: [] }, TODAY);
    expect(health.stages).toEqual([]);
    expect(health.minRir).toBe(0);
    expect(health.avoid.size).toBe(0);
  });

  it('the strictest value wins', () => {
    const health = activeHealth({ conditions: ['diabetes', 'heart_condition', 'obesity'] }, TODAY);
    expect(health.minRir).toBe(3);
    expect(health.minRestSeconds).toBe(90);
    expect(health.avoid.has('floor')).toBe(true);
    expect(health.avoid.has('heavy_axial')).toBe(true);
    expect(health.clearance).toBe(true);
    expect(health.preWorkoutCheck).toBe(true);
  });

  it('every rule keeps some effort (never to failure)', () => {
    for (const stage of HEALTH_STAGES) expect(HEALTH_RULES[stage].minRir, stage).toBeGreaterThanOrEqual(2);
  });

  it('leaves out what the rules say', () => {
    const second = rulesFor(['pregnancy_2']);
    expect(isAllowed(exerciseTraits('barbell_bench_press'), second)).toBe(false); // lying on the back
    expect(isAllowed(exerciseTraits('incline_push_up'), second)).toBe(true);
    expect(isAllowed(exerciseTraits('my_custom_exercise'), second)).toBe(true);
  });
});

// The promise of the app: wherever you are, whatever your condition, you can train.
describe('there is always a safe exercise for every main movement', () => {
  const places: Record<string, LocationEquipment> = {
    hotel: [],
    home: [{ type: 'dumbbells', maxKg: 20 }, { type: 'bands' }, { type: 'pull_up_bar' }],
    gym: EQUIPMENT_TYPES.map((type) => ({ type })),
  };
  const cases: [string, HealthStage[]][] = [
    ...HEALTH_STAGES.map((stage): [string, HealthStage[]] => [stage, [stage]]),
    ['everything at once', [...HEALTH_STAGES]],
  ];

  for (const [name, stages] of cases) {
    it(name, () => {
      const health = rulesFor(stages);
      const safe = candidates.filter((candidate) => isAllowed(candidate.traits, health));
      for (const [place, available] of Object.entries(places)) {
        for (const pattern of MAIN_PATTERNS) {
          const choice = selectVariant({ pattern, available, candidates: safe });
          expect(choice, `${pattern} at the ${place}`).not.toBeNull();
        }
      }
    });
  }
});

describe('the plan respects the conditions', () => {
  it('effort and rest never go below what the conditions allow', () => {
    const plan = generateMesocycle({
      goal: 'strength',
      experience: 'advanced',
      daysPerWeek: 4,
      sessionMinutes: 60,
      health: { conditions: ['hypertension'] },
      startDate: TODAY,
    });
    expect(validateMesocycle(plan)).toEqual([]);
    expect(plan.weeks.every((week) => week.rir >= HEALTH_RULES.hypertension.minRir)).toBe(true);
    expect(plan.restSeconds).toBeGreaterThanOrEqual(90);
    expect(plan.health).toEqual({ conditions: ['hypertension'] });
  });

  it('every condition still makes a valid plan for every number of days', () => {
    for (const condition of HEALTH_CONDITIONS) {
      for (const daysPerWeek of [2, 3, 4, 5, 6]) {
        const plan = generateMesocycle({
          goal: 'hypertrophy',
          experience: 'intermediate',
          daysPerWeek,
          sessionMinutes: 45,
          health: {
            conditions: [condition],
            dueDate: dueDateFromWeek(20, TODAY),
            birthDate: dateWeeksAgo(8, TODAY),
          },
          startDate: TODAY,
        });
        expect(validateMesocycle(plan), `${condition}, ${daysPerWeek} days`).toEqual([]);
      }
    }
  });

  it('late pregnancy: one set fewer, and says why', () => {
    const plan = generateMesocycle({
      goal: 'general_health',
      experience: 'intermediate',
      daysPerWeek: 3,
      sessionMinutes: 60,
    });
    const slots = plan.sessions[0].slots;
    const adapted = adaptSession({ slots, plan, health: rulesFor(['pregnancy_3']) });
    expect(adapted.reasons[0]).toBe('health');
    adapted.slots.forEach((slot, index) => {
      expect(slot.setsPerWeek[0]).toBe(Math.max(slot.main ? 2 : 1, slots[index].setsPerWeek[0] - 1));
    });
  });

  it('a long break on top of it does not take two sets away', () => {
    const plan = generateMesocycle({
      goal: 'hypertrophy',
      experience: 'advanced',
      daysPerWeek: 3,
      sessionMinutes: 75,
    });
    const slots = plan.sessions[0].slots;
    const both = adaptSession({
      slots,
      plan,
      health: rulesFor(['postpartum_early']),
      daysSinceLastWorkout: 30,
    });
    const one = adaptSession({ slots, plan, daysSinceLastWorkout: 30 });
    expect(both.slots.map((slot) => slot.setsPerWeek)).toEqual(one.slots.map((slot) => slot.setsPerWeek));
  });
});
