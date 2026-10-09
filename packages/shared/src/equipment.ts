import { isLoadedEquipment, type EquipmentType, type LocationEquipment } from './training';

/** True if a place has everything an exercise needs. */
export function hasEquipmentFor(required: readonly EquipmentType[], available: LocationEquipment): boolean {
  const types = new Set(available.map((item) => item.type));
  return required.every((type) => types.has(type));
}

/**
 * Heaviest load available for an exercise here, e.g. dumbbells "up to 20 kg".
 * Undefined when there's no limit (or the exercise isn't loaded).
 */
export function maxLoadFor(
  required: readonly EquipmentType[],
  available: LocationEquipment
): number | undefined {
  const limits = available
    .filter(
      (item) => required.includes(item.type) && isLoadedEquipment(item.type) && item.maxKg !== undefined
    )
    .map((item) => item.maxKg as number);
  return limits.length ? Math.min(...limits) : undefined;
}
