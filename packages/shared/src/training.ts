import { z } from 'zod';

/**
 * The training vocabulary shared by the app (and, later, the server).
 *
 * Pattern: `as const` arrays are the single source of truth. From each one we
 * derive a Zod schema (runtime validation) and a TypeScript type (editor checks).
 */

/** What the body does. Plans are written in patterns, never in specific exercises. */
export const MOVEMENT_PATTERNS = [
  // Main patterns: the backbone of every plan.
  'squat',
  'hinge',
  'lunge',
  'horizontal_push',
  'vertical_push',
  'horizontal_pull',
  'vertical_pull',
  'core',
  // Isolation patterns: optional accessories.
  'biceps',
  'triceps',
  'lateral_delts',
  'calves',
  'glutes',
] as const;
export const MovementPatternSchema = z.enum(MOVEMENT_PATTERNS);
export type MovementPattern = z.infer<typeof MovementPatternSchema>;

export const MAIN_PATTERNS = [
  'squat',
  'hinge',
  'lunge',
  'horizontal_push',
  'vertical_push',
  'horizontal_pull',
  'vertical_pull',
  'core',
] as const satisfies readonly MovementPattern[];

/** Equipment a place can have. Bodyweight is always available, so it's not listed. */
export const EQUIPMENT_TYPES = [
  'dumbbells',
  'kettlebells',
  'barbell',
  'squat_rack',
  'bench',
  'pull_up_bar',
  'dip_bars',
  'bands',
  'suspension_trainer',
  'cable_machine',
  'machines',
] as const;
export const EquipmentTypeSchema = z.enum(EQUIPMENT_TYPES);
export type EquipmentType = z.infer<typeof EquipmentTypeSchema>;

/** Equipment whose heaviest available load matters (e.g. dumbbells up to 20 kg). */
export const LOADED_EQUIPMENT = [
  'dumbbells',
  'kettlebells',
  'barbell',
] as const satisfies readonly EquipmentType[];

export function isLoadedEquipment(type: EquipmentType): boolean {
  return (LOADED_EQUIPMENT as readonly EquipmentType[]).includes(type);
}

/** One item of a place's equipment checklist. */
export const LocationEquipmentItemSchema = z.object({
  type: EquipmentTypeSchema,
  /** Heaviest load available, for loaded equipment. Missing = no practical limit. */
  maxKg: z.number().positive().optional(),
});
export type LocationEquipmentItem = z.infer<typeof LocationEquipmentItemSchema>;

export const LocationEquipmentSchema = z.array(LocationEquipmentItemSchema);
export type LocationEquipment = z.infer<typeof LocationEquipmentSchema>;

/** How an exercise is made heavier. */
export const LOAD_TYPES = ['external', 'bodyweight', 'band'] as const;
export const LoadTypeSchema = z.enum(LOAD_TYPES);
export type LoadType = z.infer<typeof LoadTypeSchema>;

export const GOALS = ['hypertrophy', 'strength', 'fat_loss', 'general_health'] as const;
export const GoalSchema = z.enum(GOALS);
export type Goal = z.infer<typeof GoalSchema>;

/** Reps in reserve: how many more good reps you could have done. 0 = failure. */
export const RirSchema = z.number().int().min(0).max(5);
