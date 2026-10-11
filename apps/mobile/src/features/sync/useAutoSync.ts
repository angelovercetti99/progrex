import { useEffect } from 'react';
import { AppState } from 'react-native';

import { subscribeChanges } from '@/db/live';

import { applyingRemoteChanges, syncNow } from './engine';

/** Wait this long after the last change before syncing (several sets in a row = one sync). */
const DEBOUNCE_MS = 4_000;

/**
 * Syncs in the background (CLAUDE.md, Sync): when the app opens, when it
 * comes back to the foreground, and a few seconds after you save something.
 * Without a key it does nothing. Failures are quiet and retried later.
 */
export function useAutoSync(): void {
  useEffect(() => {
    syncNow();

    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') syncNow();
    });

    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = subscribeChanges((changed) => {
      // Settings aren't synced; rows we just received don't need sending back.
      if (applyingRemoteChanges) return;
      if (changed.size === 1 && changed.has('preferences')) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => syncNow(), DEBOUNCE_MS);
    });

    return () => {
      appState.remove();
      unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, []);
}
