import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { parseBackup, type Backup } from './backup';
import type { BackupIo } from './backupIo';

function filename(): string {
  return `shelfwise-backup-${new Date().toISOString().slice(0, 10)}.json`;
}

export const backupIo: BackupIo = {
  async save(backup: Backup) {
    const file = new File(Paths.cache, filename());
    if (file.exists) file.delete();
    file.create();
    file.write(JSON.stringify(backup, null, 2));

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri, {
        mimeType: 'application/json',
        dialogTitle: 'Save your Shelfwise backup',
        UTI: 'public.json',
      });
    }
  },

  async open() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/json', 'text/plain', '*/*'],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets[0]) return null;
    return parseBackup(await new File(result.assets[0].uri).text());
  },
};
