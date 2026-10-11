import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import type { BackupFile } from './queries';

/**
 * Saving and opening the backup file on iOS/Android. The web version is in
 * `backupFile.web.ts`: Expo picks the right file for each platform.
 */

/** Opens the share sheet ("Save to Files", Drive, email…) with the file. */
export async function saveBackupFile(backup: BackupFile, dialogTitle: string): Promise<void> {
  const file = new File(Paths.cache, backup.name);
  if (file.exists) file.delete();
  file.create();
  file.write(backup.contents);
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json', dialogTitle });
}

/** Lets the user pick a file. Returns its text, or null if they cancelled. */
export async function pickBackupFile(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
  if (result.canceled) return null;
  return new File(result.assets[0].uri).text();
}
