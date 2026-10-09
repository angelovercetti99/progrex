import { z } from 'zod';

import { GoalSchema, MovementPatternSchema, RirSchema } from '../training';

/**
 * The shape of a mesocycle. This is the contract between whoever designs the
 * plan (today: templates in code; later: the AI) and the rest of the app.
 * The app only knows this shape — not who produced it (docs/decisoes.md §22).
 */

export const EXPERIENCE_LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
export const ExperienceSchema = z.enum(EXPERIENCE_LEVELS);
export type Experience = z.infer<typeof ExperienceSchema>;

export const DAYS_PER_WEEK = [2, 3, 4, 5, 6] as const;
export const SESSION_MINUTES = [30, 45, 60, 75] as const;

export const SESSION_FOCUSES = ['full_body', 'upper', 'lower', 'push', 'pull', 'legs'] as const;
export const SessionFocusSchema = z.enum(SESSION_FOCUSES);
export type SessionFocus = z.infer<typeof SessionFocusSchema>;

/** Body areas the user wants to improve (the body map). At most 3: more is no focus. */
export const BODY_AREAS = ['chest', 'back', 'shoulders', 'arms', 'core', 'glutes', 'legs', 'calves'] as const;
export const BodyAreaSchema = z.enum(BODY_AREAS);
export type BodyArea = z.infer<typeof BodyAreaSchema>;
export const MAX_PRIORITY_AREAS = 3;

/** One "do this pattern" line of a session. The exercise is chosen on the day. */
export const SlotSchema = z.object({
  /** Stable within the plan, e.g. "A1": links logged exercises back to the plan. */
  id: z.string().min(1),
  pattern: MovementPatternSchema,
  /** Main slots come first and are never dropped to fit the time. */
  main: z.boolean(),
  repMin: z.number().int().min(1).max(30),
  repMax: z.number().int().min(1).max(30),
  /** Sets for each week, by week index. */
  setsPerWeek: z.array(z.number().int().min(1).max(6)),
  /** Trains a body area the user prioritised (gets extra volume, dropped last). */
  priority: z.boolean().optional(),
});
export type Slot = z.infer<typeof SlotSchema>;

export const SessionSchema = z.object({
  /** "A", "B", "C"… */
  key: z.string().min(1),
  focus: SessionFocusSchema,
  slots: z.array(SlotSchema).min(1),
});
export type Session = z.infer<typeof SessionSchema>;

export const WeekSchema = z.object({
  /** Target reps in reserve this week (effort rises as the weeks go by). */
  rir: RirSchema,
  /** Recovery week: fewer sets, easier effort. */
  deload: z.boolean(),
});
export type Week = z.infer<typeof WeekSchema>;

export const MesocycleSchema = z.object({
  goal: GoalSchema,
  experience: ExperienceSchema,
  daysPerWeek: z.number().int().min(2).max(6),
  sessionMinutes: z.number().int().min(20).max(120),
  restSeconds: z.number().int().min(30).max(300),
  weeks: z.array(WeekSchema).min(2).max(8),
  /** The sessions repeat every week, in order. */
  sessions: z.array(SessionSchema).min(1),
  /** Body areas prioritised in this plan (optional: older plans don't have it). */
  priorityAreas: z.array(BodyAreaSchema).max(MAX_PRIORITY_AREAS).optional(),
});
export type Mesocycle = z.infer<typeof MesocycleSchema>;

export type MesocycleRequest = {
  goal: Mesocycle['goal'];
  experience: Experience;
  daysPerWeek: number;
  sessionMinutes: number;
  priorityAreas?: BodyArea[];
};
