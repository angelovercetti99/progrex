import type { BackupFile } from './queries';

/** Web: the browser downloads the file to the Downloads folder. */
export async function saveBackupFile(backup: BackupFile, _dialogTitle: string): Promise<void> {
  const url = URL.createObjectURL(new Blob([backup.contents], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = backup.name;
  link.click();
  // Give the browser a moment to start the download before freeing the memory.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Web: the browser's file picker. Returns the file's text, or null if the
 * user closed the picker (the `cancel` event).
 */
export function pickBackupFile(): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (file) file.text().then(resolve, reject);
      else resolve(null);
    });
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}
