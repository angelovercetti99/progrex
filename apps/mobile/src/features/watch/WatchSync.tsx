import { decodeWatchCommand, encodeWatchState } from '@progrex/shared';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { useLiveQuery } from '@/db/live';
import { useExerciseName } from '@/features/exercises/useExerciseName';

import { watchBridge } from './bridge';
import { currentWatchState, handleWatchCommand } from './queries';

/**
 * Keeps the Apple Watch in step with the workout (docs/decisoes.md §52):
 * publishes the current set whenever anything changes, and logs the sets
 * completed on the wrist. Mounted once, at the root, like AutoSync. Renders nothing.
 */
export function WatchSync() {
  if (!watchBridge) return null;
  return <WatchSyncInner />;
}

function WatchSyncInner() {
  const { t, i18n } = useTranslation();
  const exerciseName = useExerciseName();
  const state = useLiveQuery(
    () => currentWatchState(t, exerciseName),
    ['workouts', 'workout_exercises', 'sets', 'exercises'],
    [i18n.language]
  );

  const payload = state.status === 'ready' ? JSON.stringify(encodeWatchState(state.data ?? null)) : null;
  useEffect(() => {
    if (payload !== null) watchBridge?.publish(JSON.parse(payload));
  }, [payload]);

  useEffect(
    () =>
      watchBridge?.onMessage((message) => {
        const command = decodeWatchCommand(message);
        if (command) void handleWatchCommand(command).catch(() => {});
      }),
    []
  );

  return null;
}
