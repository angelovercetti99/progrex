import { isRunningInExpoGo } from 'expo';
import type * as HealthConnectModule from 'react-native-health-connect';

import type { HealthPlatform } from './platform';

/** Loaded on demand: the native module doesn't exist in Expo Go (see platform.ios.ts). */
function load(): typeof HealthConnectModule | null {
  if (isRunningInExpoGo()) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react-native-health-connect') as typeof HealthConnectModule;
  } catch {
    return null;
  }
}

/** Health Connect has to be set up once per app run before any call. */
let ready: Promise<boolean> | null = null;
async function client(): Promise<typeof HealthConnectModule | null> {
  const hc = load();
  if (!hc) return null;
  ready ??= (async () => {
    const status = await hc.getSdkStatus();
    return status === hc.SdkAvailabilityStatus.SDK_AVAILABLE && (await hc.initialize());
  })().catch(() => false);
  return (await ready) ? hc : null;
}

export const healthPlatform: HealthPlatform = {
  name: 'health_connect',

  async isAvailable() {
    return (await client()) !== null;
  },

  async connect() {
    const hc = await client();
    if (!hc) return false;
    const granted = await hc.requestPermission([
      { accessType: 'write', recordType: 'ExerciseSession' },
      { accessType: 'read', recordType: 'HeartRate' },
    ]);
    return granted.some(
      (permission) =>
        'recordType' in permission &&
        permission.recordType === 'ExerciseSession' &&
        permission.accessType === 'write'
    );
  },

  async saveWorkout({ start, end, title }) {
    const hc = await client();
    if (!hc) return;
    await hc.insertRecords([
      {
        recordType: 'ExerciseSession',
        exerciseType: hc.ExerciseType.STRENGTH_TRAINING,
        title,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
      },
    ]);
  },

  async heartRate(start, end) {
    const hc = await client();
    if (!hc) return [];
    const { records } = await hc.readRecords('HeartRate', {
      timeRangeFilter: { operator: 'between', startTime: start.toISOString(), endTime: end.toISOString() },
    });
    return records.flatMap((record) =>
      record.samples.map((sample) => ({ time: sample.time, bpm: sample.beatsPerMinute }))
    );
  },
};
