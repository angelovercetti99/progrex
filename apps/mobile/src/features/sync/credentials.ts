import * as SecureStore from 'expo-secure-store';

/**
 * Where the server is and the personal key (docs/decisoes.md §9).
 * On the phone they live in the Keychain (iOS) / Keystore (Android), never
 * in the database or in the code. The web version is in credentials.web.ts.
 */
export type SyncCredentials = { url: string; token: string };

const KEY = 'progrex.sync';

export async function getCredentials(): Promise<SyncCredentials | null> {
  const value = await SecureStore.getItemAsync(KEY);
  return value ? (JSON.parse(value) as SyncCredentials) : null;
}

export async function setCredentials(credentials: SyncCredentials | null): Promise<void> {
  if (credentials) await SecureStore.setItemAsync(KEY, JSON.stringify(credentials));
  else await SecureStore.deleteItemAsync(KEY);
}
