import { useCallback, useLayoutEffect, useRef } from 'react';

/**
 * Wraps an action so a second tap while the first is still running is
 * ignored. In the gym, with sweaty hands, double taps happen: without this,
 * "Complete set" logs two sets and "Start" creates two workouts.
 */
export function useSingleFlight<Args extends unknown[]>(
  action: (...args: Args) => unknown
): (...args: Args) => Promise<void> {
  const busy = useRef(false);
  // Always run the latest `action` (it's a new function on every render).
  const actionRef = useRef(action);
  useLayoutEffect(() => {
    actionRef.current = action;
  });

  return useCallback(async (...args: Args) => {
    if (busy.current) return;
    busy.current = true;
    try {
      await actionRef.current(...args);
    } finally {
      busy.current = false;
    }
  }, []);
}
