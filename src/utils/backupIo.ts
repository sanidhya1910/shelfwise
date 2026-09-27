/** Type contract; Metro swaps in the platform file. */
import type { Backup } from './backup';

export interface BackupIo {
  /** Writes the backup somewhere the user can keep it. */
  save(backup: Backup): Promise<void>;
  /** Opens a picker and parses the chosen file. Null when cancelled. */
  open(): Promise<Backup | null>;
}

export const backupIo: BackupIo = {
  async save() {
    throw new Error('Backups are not supported on this platform.');
  },
  async open() {
    return null;
  },
};
