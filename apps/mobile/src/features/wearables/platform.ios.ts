import type * as HealthKitModule from '@kingstinct/react-native-healthkit';
import { isRunningInExpoGo } from 'expo';

import type { HealthPlatform } from './platform';

const HEART_RATE = 'HKQuantityTypeIdentifierHeartRate';
const WORKOUT = 'HKWorkoutTypeIdentifier';

/**
 * Loaded on demand: the native module doesn't exist in Expo Go, and importing
 * it there would crash the app on startup. In a real build it's there.
 */
function load(): typeof HealthKitModule | null {
  if (isRunningInExpoGo()) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@kingstinct/react-native-healthkit') as typeof HealthKitModule;
  } catch {
    return null;
  }
}

export const healthPlatform: HealthPlatform = {
  name: 'apple_health',

  async isAvailable() {
    const kit = load();
    return kit !== null && kit.isHealthDataAvailable();
  },

  async connect() {
    const kit = load();
    if (!kit) return false;
    return kit.requestAuthorization({ toShare: [WORKOUT], toRead: [HEART_RATE] });
  },

  async saveWorkout({ start, end, title }) {
    const kit = load();
    if (!kit) return;
    await kit.saveWorkoutSample(
      kit.WorkoutActivityType.traditionalStrengthTraining,
      [],
      start,
      end,
      undefined,
      {
        HKWorkoutBrandName: 'Progrex',
        title,
      }
    );
  },

  async heartRate(start, end) {
    const kit = load();
    if (!kit) return [];
    const samples = await kit.queryQuantitySamples(HEART_RATE, {
      limit: 0,
      unit: 'count/min',
      ascending: true,
      filter: { date: { startDate: start, endDate: end } },
    });
    return samples.map((sample) => ({
      time: new Date(sample.startDate).toISOString(),
      bpm: sample.quantity,
    }));
  },
};
