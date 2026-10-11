import type { EquipmentType, ExerciseTrait, LoadType, MovementPattern } from './training';

/**
 * Built-in exercise catalog. Ids are stable forever (`builtin:<key>`): workouts
 * reference them, and every device must agree on them without syncing.
 * Names are translated in the app (`exercises.<key>`).
 *
 * Bodyweight variants may use furniture any room has (a chair, a table, a wall).
 */
export type CatalogExercise = {
  key: string;
  pattern: MovementPattern;
  /** ALL of these are needed. Empty = bodyweight only. */
  equipment: EquipmentType[];
  loadType: LoadType;
  /** 1 (easiest) to 5 (hardest), within the same pattern. */
  difficulty: 1 | 2 | 3 | 4 | 5;
  /** Smallest sensible weight jump in kg (0 when weight doesn't apply). */
  loadIncrementKg: number;
  /** Body positions and demands that matter for health conditions (see EXERCISE_TRAITS). */
  traits: ExerciseTrait[];
};

const bw = (
  key: string,
  pattern: MovementPattern,
  difficulty: CatalogExercise['difficulty'],
  equipment: EquipmentType[] = [],
  traits: ExerciseTrait[] = []
): CatalogExercise => ({
  key,
  pattern,
  equipment,
  loadType: 'bodyweight',
  difficulty,
  loadIncrementKg: 0,
  traits,
});

const loaded = (
  key: string,
  pattern: MovementPattern,
  difficulty: CatalogExercise['difficulty'],
  equipment: EquipmentType[],
  loadIncrementKg: number,
  traits: ExerciseTrait[] = []
): CatalogExercise => ({
  key,
  pattern,
  equipment,
  loadType: 'external',
  difficulty,
  loadIncrementKg,
  traits,
});

const band = (
  key: string,
  pattern: MovementPattern,
  difficulty: CatalogExercise['difficulty'],
  equipment: EquipmentType[] = ['bands'],
  traits: ExerciseTrait[] = []
): CatalogExercise => ({
  key,
  pattern,
  equipment,
  loadType: 'band',
  difficulty,
  loadIncrementKg: 0,
  traits,
});

export const CATALOG: CatalogExercise[] = [
  // Squat
  bw('bodyweight_squat', 'squat', 1),
  bw('assisted_pistol_squat', 'squat', 3, [], ['balance']),
  bw('pistol_squat', 'squat', 5, [], ['balance']),
  loaded('goblet_squat', 'squat', 2, ['dumbbells'], 2),
  loaded('kettlebell_goblet_squat', 'squat', 2, ['kettlebells'], 4),
  loaded('leg_press', 'squat', 2, ['machines'], 5),
  loaded('back_squat', 'squat', 4, ['barbell', 'squat_rack'], 2.5, ['heavy_axial']),
  loaded('front_squat', 'squat', 4, ['barbell', 'squat_rack'], 2.5, ['heavy_axial']),

  // Hinge
  bw('good_morning', 'hinge', 1),
  bw('single_leg_rdl', 'hinge', 2, [], ['balance']),
  bw('sliding_leg_curl', 'hinge', 3, [], ['supine', 'floor']),
  bw('nordic_curl', 'hinge', 5, [], ['floor', 'prone']),
  band('band_good_morning', 'hinge', 1),
  loaded('dumbbell_rdl', 'hinge', 2, ['dumbbells'], 2),
  loaded('single_leg_dumbbell_rdl', 'hinge', 3, ['dumbbells'], 2, ['balance']),
  loaded('kettlebell_swing', 'hinge', 2, ['kettlebells'], 4, ['ballistic']),
  loaded('leg_curl_machine', 'hinge', 2, ['machines'], 5, ['prone']),
  loaded('barbell_rdl', 'hinge', 3, ['barbell'], 2.5),
  loaded('deadlift', 'hinge', 4, ['barbell'], 2.5, ['heavy_axial']),

  // Lunge
  bw('reverse_lunge', 'lunge', 1),
  bw('step_up', 'lunge', 2),
  bw('split_squat', 'lunge', 2),
  bw('bulgarian_split_squat', 'lunge', 3, [], ['balance']),
  loaded('dumbbell_walking_lunge', 'lunge', 3, ['dumbbells'], 2, ['balance']),
  loaded('dumbbell_bulgarian_split_squat', 'lunge', 4, ['dumbbells'], 2, ['balance']),

  // Horizontal push
  bw('incline_push_up', 'horizontal_push', 1),
  bw('push_up', 'horizontal_push', 2, [], ['floor']),
  bw('decline_push_up', 'horizontal_push', 3, [], ['floor', 'inverted']),
  bw('archer_push_up', 'horizontal_push', 4, [], ['floor']),
  bw('dip', 'horizontal_push', 4, ['dip_bars']),
  band('band_chest_press', 'horizontal_push', 1),
  loaded('dumbbell_floor_press', 'horizontal_push', 2, ['dumbbells'], 2, ['supine', 'floor']),
  loaded('machine_chest_press', 'horizontal_push', 2, ['machines'], 5),
  loaded('dumbbell_bench_press', 'horizontal_push', 3, ['dumbbells', 'bench'], 2, ['supine']),
  loaded('barbell_bench_press', 'horizontal_push', 4, ['barbell', 'bench'], 2.5, ['supine']),

  // Vertical push
  bw('pike_push_up', 'vertical_push', 2, [], ['floor', 'inverted']),
  bw('elevated_pike_push_up', 'vertical_push', 3, [], ['floor', 'inverted']),
  bw('handstand_push_up', 'vertical_push', 5, [], ['floor', 'inverted']),
  band('band_overhead_press', 'vertical_push', 1),
  loaded('dumbbell_shoulder_press', 'vertical_push', 2, ['dumbbells'], 2),
  loaded('machine_shoulder_press', 'vertical_push', 2, ['machines'], 5),
  loaded('kettlebell_press', 'vertical_push', 3, ['kettlebells'], 4),
  loaded('barbell_overhead_press', 'vertical_push', 4, ['barbell'], 2.5),

  // Horizontal pull
  bw('towel_door_row', 'horizontal_pull', 1),
  bw('table_row', 'horizontal_pull', 2, [], ['supine', 'floor']),
  bw('suspension_row', 'horizontal_pull', 2, ['suspension_trainer']),
  band('band_row', 'horizontal_pull', 1),
  loaded('dumbbell_row', 'horizontal_pull', 2, ['dumbbells'], 2),
  loaded('kettlebell_row', 'horizontal_pull', 2, ['kettlebells'], 4),
  loaded('seated_cable_row', 'horizontal_pull', 2, ['cable_machine'], 5),
  loaded('barbell_row', 'horizontal_pull', 3, ['barbell'], 2.5),

  // Vertical pull (no bodyweight-only option: falls back to horizontal pull)
  band('band_pulldown', 'vertical_pull', 1),
  bw('negative_pull_up', 'vertical_pull', 2, ['pull_up_bar'], ['hanging']),
  bw('band_assisted_pull_up', 'vertical_pull', 2, ['pull_up_bar', 'bands'], ['hanging']),
  bw('chin_up', 'vertical_pull', 3, ['pull_up_bar'], ['hanging']),
  bw('pull_up', 'vertical_pull', 4, ['pull_up_bar'], ['hanging']),
  loaded('lat_pulldown', 'vertical_pull', 2, ['cable_machine'], 5),

  // Core
  bw('incline_plank', 'core', 1),
  bw('dead_bug', 'core', 1, [], ['supine', 'floor']),
  bw('plank', 'core', 1, [], ['floor', 'abdominal_load']),
  bw('side_plank', 'core', 2, [], ['floor']),
  bw('hollow_hold', 'core', 3, [], ['supine', 'floor', 'abdominal_load', 'spinal_flexion']),
  bw('hanging_knee_raise', 'core', 3, ['pull_up_bar'], ['hanging', 'abdominal_load', 'spinal_flexion']),
  band('pallof_press', 'core', 2),
  loaded('cable_crunch', 'core', 2, ['cable_machine'], 5, ['spinal_flexion', 'abdominal_load']),

  // Biceps
  band('band_curl', 'biceps', 1),
  loaded('dumbbell_curl', 'biceps', 2, ['dumbbells'], 1),
  loaded('hammer_curl', 'biceps', 2, ['dumbbells'], 1),
  loaded('cable_curl', 'biceps', 2, ['cable_machine'], 2.5),
  loaded('barbell_curl', 'biceps', 3, ['barbell'], 2.5),

  // Triceps
  bw('bench_dip', 'triceps', 2),
  bw('diamond_push_up', 'triceps', 3, [], ['floor']),
  band('band_pushdown', 'triceps', 1),
  loaded('dumbbell_overhead_extension', 'triceps', 2, ['dumbbells'], 1),
  loaded('cable_pushdown', 'triceps', 2, ['cable_machine'], 2.5),

  // Lateral delts
  band('band_lateral_raise', 'lateral_delts', 1),
  loaded('dumbbell_lateral_raise', 'lateral_delts', 2, ['dumbbells'], 1),
  loaded('cable_lateral_raise', 'lateral_delts', 2, ['cable_machine'], 2.5),

  // Calves
  bw('calf_raise', 'calves', 1),
  bw('single_leg_calf_raise', 'calves', 2, [], ['balance']),
  loaded('dumbbell_calf_raise', 'calves', 2, ['dumbbells'], 2),
  loaded('machine_calf_raise', 'calves', 2, ['machines'], 5),

  // Glutes
  bw('glute_bridge', 'glutes', 1, [], ['supine', 'floor']),
  bw('single_leg_glute_bridge', 'glutes', 2, [], ['supine', 'floor']),
  loaded('dumbbell_hip_thrust', 'glutes', 2, ['dumbbells', 'bench'], 2),
  loaded('barbell_hip_thrust', 'glutes', 3, ['barbell', 'bench'], 2.5),
];

const BY_KEY = new Map(CATALOG.map((exercise) => [exercise.key, exercise]));

/** A built-in exercise's traits. Custom exercises: none known (the user chose them). */
export function exerciseTraits(nameKey: string | null | undefined): ExerciseTrait[] {
  return (nameKey && BY_KEY.get(nameKey)?.traits) || [];
}

export function builtinExerciseId(key: string): string {
  return `builtin:${key}`;
}
