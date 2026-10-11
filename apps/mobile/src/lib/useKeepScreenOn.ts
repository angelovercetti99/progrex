import { useKeepAwake } from 'expo-keep-awake';

/**
 * Keeps the screen on while the calling screen is open (a workout: you put the
 * phone down between sets and it shouldn't lock). Web: see useKeepScreenOn.web.ts.
 */
export function useKeepScreenOn(): void {
  useKeepAwake();
}
