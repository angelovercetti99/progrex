import { EQUIPMENT_TYPES, type LocationEquipment } from '@progrex/shared';

/** Starting points so nobody has to tick 11 boxes for a normal gym. */
export const LOCATION_PRESETS = {
  gym: EQUIPMENT_TYPES.map((type) => ({ type })),
  home: [{ type: 'dumbbells', maxKg: 20 }, { type: 'bands' }, { type: 'pull_up_bar' }],
  hotel: [],
} satisfies Record<string, LocationEquipment>;

export type LocationPreset = keyof typeof LOCATION_PRESETS;
