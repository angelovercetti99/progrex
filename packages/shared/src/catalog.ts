import type { EquipmentType, LoadType, MovementPattern } from './training';

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
};

const bw = (
  key: string,
  pattern: MovementPattern,
  difficulty: CatalogExercise['difficulty'],
  equipment: EquipmentType[] = []
): CatalogExercise => ({
  key,
  pattern,
  equipment,
  loadType: 'bodyweight',
  difficulty,
  loadIncrementKg: 0,
});

const loaded = (
  key: string,
  pattern: MovementPattern,
  difficulty: CatalogExercise['difficulty'],
  equipment: EquipmentType[],
  loadIncrementKg: number
): CatalogExercise => ({
  key,
  pattern,
  equipment,
  loadType: 'external',
  difficulty,
  loadIncrementKg,
});

const band = (
  key: string,
  pattern: MovementPattern,
  difficulty: CatalogExercise['difficulty'],
  equipment: EquipmentType[] = ['bands']
): CatalogExercise => ({
  key,
  pattern,
  equipment,
  loadType: 'band',
  difficulty,
  loadIncrementKg: 0,
});

export const CATALOG: CatalogExercise[] = [
  // Squat
  bw('bodyweight_squat', 'squat', 1),
  bw('assisted_pistol_squat', 'squat', 3),
  bw('pistol_squat', 'squat', 5),
  loaded('goblet_squat', 'squat', 2, ['dumbbells'], 2),
  loaded('kettlebell_goblet_squat', 'squat', 2, ['kettlebells'], 4),
  loaded('leg_press', 'squat', 2, ['machines'], 5),
  loaded('back_squat', 'squat', 4, ['barbell', 'squat_rack'], 2.5),
  loaded('front_squat', 'squat', 4, ['barbell', 'squat_rack'], 2.5),

  // Hinge
  bw('single_leg_rdl', 'hinge', 2),
  bw('sliding_leg_curl', 'hinge', 3),
  bw('nordic_curl', 'hinge', 5),
  band('band_good_morning', 'hinge', 1),
  loaded('dumbbell_rdl', 'hinge', 2, ['dumbbells'], 2),
  loaded('single_leg_dumbbell_rdl', 'hinge', 3, ['dumbbells'], 2),
  loaded('kettlebell_swing', 'hinge', 2, ['kettlebells'], 4),
  loaded('leg_curl_machine', 'hinge', 2, ['machines'], 5),
  loaded('barbell_rdl', 'hinge', 3, ['barbell'], 2.5),
  loaded('deadlift', 'hinge', 4, ['barbell'], 2.5),

  // Lunge
  bw('reverse_lunge', 'lunge', 1),
  bw('step_up', 'lunge', 2),
  bw('split_squat', 'lunge', 2),
  bw('bulgarian_split_squat', 'lunge', 3),
  loaded('dumbbell_walking_lunge', 'lunge', 3, ['dumbbells'], 2),
  loaded('dumbbell_bulgarian_split_squat', 'lunge', 4, ['dumbbells'], 2),

  // Horizontal push
  bw('incline_push_up', 'horizontal_push', 1),
  bw('push_up', 'horizontal_push', 2),
  bw('decline_push_up', 'horizontal_push', 3),
  bw('archer_push_up', 'horizontal_push', 4),
  bw('dip', 'horizontal_push', 4, ['dip_bars']),
  band('band_chest_press', 'horizontal_push', 1),
  loaded('dumbbell_floor_press', 'horizontal_push', 2, ['dumbbells'], 2),
  loaded('machine_chest_press', 'horizontal_push', 2, ['machines'], 5),
  loaded('dumbbell_bench_press', 'horizontal_push', 3, ['dumbbells', 'bench'], 2),
  loaded('barbell_bench_press', 'horizontal_push', 4, ['barbell', 'bench'], 2.5),

  // Vertical push
  bw('pike_push_up', 'vertical_push', 2),
  bw('elevated_pike_push_up', 'vertical_push', 3),
  bw('handstand_push_up', 'vertical_push', 5),
  band('band_overhead_press', 'vertical_push', 1),
  loaded('dumbbell_shoulder_press', 'vertical_push', 2, ['dumbbells'], 2),
  loaded('machine_shoulder_press', 'vertical_push', 2, ['machines'], 5),
  loaded('kettlebell_press', 'vertical_push', 3, ['kettlebells'], 4),
  loaded('barbell_overhead_press', 'vertical_push', 4, ['barbell'], 2.5),

  // Horizontal pull
  bw('towel_door_row', 'horizontal_pull', 1),
  bw('table_row', 'horizontal_pull', 2),
  bw('suspension_row', 'horizontal_pull', 2, ['suspension_trainer']),
  band('band_row', 'horizontal_pull', 1),
  loaded('dumbbell_row', 'horizontal_pull', 2, ['dumbbells'], 2),
  loaded('kettlebell_row', 'horizontal_pull', 2, ['kettlebells'], 4),
  loaded('seated_cable_row', 'horizontal_pull', 2, ['cable_machine'], 5),
  loaded('barbell_row', 'horizontal_pull', 3, ['barbell'], 2.5),

  // Vertical pull (no bodyweight-only option: falls back to horizontal pull)
  band('band_pulldown', 'vertical_pull', 1),
  bw('negative_pull_up', 'vertical_pull', 2, ['pull_up_bar']),
  bw('band_assisted_pull_up', 'vertical_pull', 2, ['pull_up_bar', 'bands']),
  bw('chin_up', 'vertical_pull', 3, ['pull_up_bar']),
  bw('pull_up', 'vertical_pull', 4, ['pull_up_bar']),
  loaded('lat_pulldown', 'vertical_pull', 2, ['cable_machine'], 5),

  // Core
  bw('dead_bug', 'core', 1),
  bw('plank', 'core', 1),
  bw('side_plank', 'core', 2),
  bw('hollow_hold', 'core', 3),
  bw('hanging_knee_raise', 'core', 3, ['pull_up_bar']),
  band('pallof_press', 'core', 2),
  loaded('cable_crunch', 'core', 2, ['cable_machine'], 5),

  // Biceps
  band('band_curl', 'biceps', 1),
  loaded('dumbbell_curl', 'biceps', 2, ['dumbbells'], 1),
  loaded('hammer_curl', 'biceps', 2, ['dumbbells'], 1),
  loaded('cable_curl', 'biceps', 2, ['cable_machine'], 2.5),
  loaded('barbell_curl', 'biceps', 3, ['barbell'], 2.5),

  // Triceps
  bw('bench_dip', 'triceps', 2),
  bw('diamond_push_up', 'triceps', 3),
  band('band_pushdown', 'triceps', 1),
  loaded('dumbbell_overhead_extension', 'triceps', 2, ['dumbbells'], 1),
  loaded('cable_pushdown', 'triceps', 2, ['cable_machine'], 2.5),

  // Lateral delts
  band('band_lateral_raise', 'lateral_delts', 1),
  loaded('dumbbell_lateral_raise', 'lateral_delts', 2, ['dumbbells'], 1),
  loaded('cable_lateral_raise', 'lateral_delts', 2, ['cable_machine'], 2.5),

  // Calves
  bw('calf_raise', 'calves', 1),
  bw('single_leg_calf_raise', 'calves', 2),
  loaded('dumbbell_calf_raise', 'calves', 2, ['dumbbells'], 2),
  loaded('machine_calf_raise', 'calves', 2, ['machines'], 5),

  // Glutes
  bw('glute_bridge', 'glutes', 1),
  bw('single_leg_glute_bridge', 'glutes', 2),
  loaded('dumbbell_hip_thrust', 'glutes', 2, ['dumbbells', 'bench'], 2),
  loaded('barbell_hip_thrust', 'glutes', 3, ['barbell', 'bench'], 2.5),
];

export function builtinExerciseId(key: string): string {
  return `builtin:${key}`;
}
