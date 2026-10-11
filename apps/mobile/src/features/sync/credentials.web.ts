import type { SyncCredentials } from './credentials';

export type { SyncCredentials } from './credentials';

/**
 * Web version: the browser has no Keychain, so the key lives in
 * localStorage (docs/decisoes.md §9: acceptable for your own browser).
 */
const KEY = 'progrex.sync';

export async function getCredentials(): Promise<SyncCredentials | null> {
  try {
    const value = window.localStorage.getItem(KEY);
    return value ? (JSON.parse(value) as SyncCredentials) : null;
  } catch {
    return null;
  }
}

export async function setCredentials(credentials: SyncCredentials | null): Promise<void> {
  if (credentials) window.localStorage.setItem(KEY, JSON.stringify(credentials));
  else window.localStorage.removeItem(KEY);
}
