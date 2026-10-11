import { z } from 'zod';

import type { ExerciseTrait } from '../training';

/**
 * Special populations (docs/decisoes.md §50): health conditions change WHICH
 * exercises are safe and HOW hard to push, never the method. Like the rest of
 * the training logic: pure functions, tested, no network.
 *
 * Not medical advice. The rules follow public guidance (ACOG for pregnancy and
 * postpartum, ADA for diabetes, ACSM for the rest) and lean conservative: an
 * app can't examine anyone, so when in doubt it leaves the exercise out.
 */

export const HEALTH_CONDITIONS = [
  'pregnancy',
  'postpartum',
  'obesity',
  'diabetes',
  'hypertension',
  'heart_condition',
  'older_adult',
  'osteoporosis',
] as const;
export const HealthConditionSchema = z.enum(HEALTH_CONDITIONS);
export type HealthCondition = z.infer<typeof HealthConditionSchema>;

const LocalDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** What the user told us, once. Everything else is worked out from the dates. */
export const HealthProfileSchema = z.object({
  conditions: z.array(HealthConditionSchema),
  /** Pregnancy: the expected due date. The trimester follows from it, day by day. */
  dueDate: LocalDateSchema.optional(),
  /** Postpartum: the day the baby was born. */
  birthDate: LocalDateSchema.optional(),
});
export type HealthProfile = z.infer<typeof HealthProfileSchema>;

export const NO_HEALTH: HealthProfile = { conditions: [] };

/** A condition at a given moment (pregnancy and postpartum change with time). */
export const HEALTH_STAGES = [
  'pregnancy_1',
  'pregnancy_2',
  'pregnancy_3',
  'postpartum_early',
  'postpartum',
  'obesity',
  'diabetes',
  'hypertension',
  'heart_condition',
  'older_adult',
  'osteoporosis',
] as const;
export type HealthStage = (typeof HEALTH_STAGES)[number];

export type HealthRule = {
  /** Exercises with any of these traits are left out. */
  avoid: ExerciseTrait[];
  /** Never closer to failure than this (reps in reserve). */
  minRir: number;
  /** Never less rest than this, in seconds. */
  minRestSeconds?: number;
  /** One set fewer per exercise (a gentler load overall). */
  fewerSets?: boolean;
  /** Should talk to a doctor before training (shown once, kindly). */
  clearance?: boolean;
  /** A check before each workout (e.g. blood sugar). */
  preWorkoutCheck?: boolean;
};

export const HEALTH_RULES: Record<HealthStage, HealthRule> = {
  // ACOG: moderate effort ("you can still talk"), nothing face down, no impact
  // or ballistic moves, no heavy loads on the spine.
  pregnancy_1: { avoid: ['prone', 'ballistic', 'heavy_axial'], minRir: 3, clearance: true },
  // From the 2nd trimester: also nothing lying on the back (the womb presses on
  // the vena cava), head-down, hanging, or hard work for the front of the belly.
  pregnancy_2: {
    avoid: ['prone', 'ballistic', 'heavy_axial', 'supine', 'inverted', 'hanging', 'abdominal_load'],
    minRir: 3,
    clearance: true,
  },
  // 3rd trimester: balance changes and getting up from the floor gets hard.
  pregnancy_3: {
    avoid: [
      'prone',
      'ballistic',
      'heavy_axial',
      'supine',
      'inverted',
      'hanging',
      'abdominal_load',
      'balance',
      'floor',
    ],
    minRir: 3,
    fewerSets: true,
    clearance: true,
  },
  // First 6 weeks after birth: only with a doctor's OK, gently, the core rebuilds first.
  postpartum_early: {
    avoid: ['ballistic', 'heavy_axial', 'hanging', 'inverted', 'abdominal_load', 'spinal_flexion'],
    minRir: 4,
    fewerSets: true,
    clearance: true,
  },
  // Up to ~6 months: a gradual return; the abdomen (diastasis) and pelvic floor still come first.
  postpartum: { avoid: ['ballistic', 'abdominal_load', 'spinal_flexion'], minRir: 3 },
  // Joint-friendly and no getting down to the floor (often the biggest barrier).
  obesity: { avoid: ['floor', 'inverted', 'hanging'], minRir: 2 },
  // ADA: strength training helps; check blood sugar before, don't go to failure.
  diabetes: { avoid: [], minRir: 2, preWorkoutCheck: true },
  // No breath-holding near failure, nothing head-down, a bit more rest.
  hypertension: { avoid: ['inverted'], minRir: 2, minRestSeconds: 90 },
  heart_condition: {
    avoid: ['inverted', 'heavy_axial', 'ballistic'],
    minRir: 3,
    minRestSeconds: 90,
    clearance: true,
  },
  older_adult: { avoid: ['inverted', 'ballistic'], minRir: 2 },
  // Loaded forward bending of the spine is the classic risk; swings too.
  osteoporosis: { avoid: ['spinal_flexion', 'ballistic'], minRir: 2 },
};

const DAY_MS = 86_400_000;
const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);

/** Weeks of pregnancy on `today`, counted like doctors do (40 weeks at the due date). */
export function pregnancyWeek(dueDate: string, today: string): number {
  return 40 - Math.ceil(daysBetween(today, dueDate) / 7);
}

/** The due date for someone who is `week` weeks pregnant today. */
export function dueDateFromWeek(week: number, today: string): string {
  return new Date(Date.parse(`${today}T00:00:00Z`) + (40 - week) * 7 * DAY_MS).toISOString().slice(0, 10);
}

/** The day that was `weeks` weeks before today (e.g. the birth date). */
export function dateWeeksAgo(weeks: number, today: string): string {
  return new Date(Date.parse(`${today}T00:00:00Z`) - weeks * 7 * DAY_MS).toISOString().slice(0, 10);
}

/** Weeks since `date` (whole weeks). */
export function weeksSince(date: string, today: string): number {
  return Math.floor(daysBetween(date, today) / 7);
}

/** After this, postpartum is over and training goes back to normal. */
export const POSTPARTUM_WEEKS = 26;
const POSTPARTUM_EARLY_WEEKS = 6;

/**
 * Which stages apply today. Pregnancy turns into postpartum by itself once the
 * due date passes, and postpartum ends by itself after ~6 months: nobody has
 * to come back and update anything.
 */
export function healthStages(profile: HealthProfile | null | undefined, today: string): HealthStage[] {
  if (!profile) return [];
  const stages: HealthStage[] = [];

  // Birth: the date given, or the due date once it has passed.
  let birth = profile.conditions.includes('postpartum') ? (profile.birthDate ?? null) : null;
  if (profile.conditions.includes('pregnancy') && profile.dueDate) {
    if (daysBetween(today, profile.dueDate) > 0) {
      const week = pregnancyWeek(profile.dueDate, today);
      stages.push(week < 14 ? 'pregnancy_1' : week < 28 ? 'pregnancy_2' : 'pregnancy_3');
    } else {
      birth = birth ?? profile.dueDate;
    }
  }
  if (birth) {
    const weeks = weeksSince(birth, today);
    if (weeks >= 0 && weeks < POSTPARTUM_EARLY_WEEKS) stages.push('postpartum_early');
    else if (weeks >= 0 && weeks < POSTPARTUM_WEEKS) stages.push('postpartum');
  }

  for (const condition of profile.conditions) {
    if (condition !== 'pregnancy' && condition !== 'postpartum') stages.push(condition);
  }
  return stages;
}

/** Every rule that applies today, combined: the strictest value wins. */
export type ActiveHealth = {
  stages: HealthStage[];
  avoid: ReadonlySet<ExerciseTrait>;
  minRir: number;
  minRestSeconds: number;
  fewerSets: boolean;
  clearance: boolean;
  preWorkoutCheck: boolean;
};

export function activeHealth(profile: HealthProfile | null | undefined, today: string): ActiveHealth {
  const stages = healthStages(profile, today);
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

/** True when an exercise with these traits is fine today. */
export function isAllowed(traits: readonly ExerciseTrait[], health: ActiveHealth): boolean {
  return !traits.some((trait) => health.avoid.has(trait));
}

/** Does any health rule change training today? */
export function hasHealthRules(health: ActiveHealth): boolean {
  return health.stages.length > 0;
}
