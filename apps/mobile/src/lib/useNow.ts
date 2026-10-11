import { useEffect, useState } from 'react';

/**
 * The current time, refreshed every `ms`. Rendering must not read the clock
 * directly (React may render more than once), so screens that show "3 min
 * ago" use this instead of `Date.now()`.
 */
export function useNow(ms: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(timer);
  }, [ms]);
  return now;
}
