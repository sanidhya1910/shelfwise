import { parseBackup, type Backup } from './backup';
import type { BackupIo } from './backupIo';

/**
 * Browser file I/O, done with plain DOM rather than a picker library — the web
 * build is a viewer whose whole job is opening a backup the phone produced and
 * handing an edited copy back.
 */
export const backupIo: BackupIo = {
  async save(backup: Backup) {
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `shelfwise-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    // Revoking immediately can cancel the download in some browsers.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  },

  open() {
    return new Promise<Backup | null>((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json,.json';

      // There is no reliable cancel event, so a blur-based timeout resolves
      // null rather than leaving the promise hanging forever.
      let settled = false;
      const settle = (value: Backup | null) => {
        if (settled) return;
        settled = true;
        input.remove();
        resolve(value);
      };

      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) {
          settle(null);
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          if (settled) return;
          settled = true;
          input.remove();
          try {
            resolve(parseBackup(String(reader.result ?? '')));
          } catch (error) {
            reject(error);
          }
        };
        reader.onerror = () => {
          settled = true;
          input.remove();
          reject(new Error('That file could not be read.'));
        };
        reader.readAsText(file);
      };

      window.addEventListener('focus', () => setTimeout(() => settle(null), 800), { once: true });

      document.body.appendChild(input);
      input.click();
    });
  },
};
