import { useAutoSync } from './useAutoSync';

/** Mounted once, inside DatabaseGate: syncs only after the database is ready. */
export function AutoSync() {
  useAutoSync();
  return null;
}
