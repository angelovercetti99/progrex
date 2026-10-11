import { isRunningInExpoGo } from 'expo';
import type * as WatchConnectivity from 'react-native-watch-connectivity';

import type { WatchBridge } from './bridge';

/** Loaded on demand: the native module isn't in Expo Go (same as features/wearables). */
function load(): typeof WatchConnectivity | null {
  if (isRunningInExpoGo()) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react-native-watch-connectivity') as typeof WatchConnectivity;
  } catch {
    return null;
  }
}

export const watchBridge: WatchBridge = {
  publish(payload) {
    try {
      // The latest state wins: the watch gets it as soon as it wakes up.
      load()?.updateApplicationContext(payload);
    } catch {
      // No watch paired, or the app isn't on it: nothing to do.
    }
  },

  onMessage(listener) {
    const watch = load();
    if (!watch) return () => {};
    // Live messages (watch and phone both awake)…
    const offMessage = watch.watchEvents.addListener('message', (payload, reply) => {
      listener(payload);
      reply?.({ ok: true });
    });
    // …and the queue the watch uses when the phone can't be reached right away.
    const offQueue = watch.watchEvents.addListener('user-info', (queue) => queue.forEach(listener));
    return () => {
      offMessage();
      offQueue();
    };
  },
};
