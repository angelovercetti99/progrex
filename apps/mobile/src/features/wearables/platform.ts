import type { HeartRateSample } from '@progrex/shared';

/**
 * The phone's health platform: Apple Health on iOS, Health Connect on Android
 * (docs/decisoes.md §51). Watches write heart rate there (Apple Watch, Wear OS,
 * Galaxy Watch and others whose apps sync to it), so through it Progrex works
 * with almost any watch without talking to each one.
 *
 * One file per platform: React Native picks `platform.ios.ts` on iPhone,
 * `platform.android.ts` on Android and this one everywhere else (web), where
 * there's no health platform.
 */
export type HealthPlatform = {
  /** 'apple_health' | 'health_connect': used to pick the right words. */
  name: 'apple_health' | 'health_connect';
  /** False in Expo Go, on devices without the platform, or if the module isn't built in. */
  isAvailable(): Promise<boolean>;
  /** Asks for permission (the system's own screen). True if we can write workouts. */
  connect(): Promise<boolean>;
  /** Saves a strength workout, so it counts in the rings / daily activity. */
  saveWorkout(workout: { start: Date; end: Date; title: string }): Promise<void>;
  /** Heart rate readings between two moments (what the watch measured). */
  heartRate(start: Date, end: Date): Promise<HeartRateSample[]>;
};

export const healthPlatform: HealthPlatform | null = null;
