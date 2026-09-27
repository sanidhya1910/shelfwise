import { BUILT_IN_CATEGORIES, type Category } from '@/domain/categories';
import type { Item, ShoppingListEntry } from '@/domain/item';

export const BACKUP_VERSION = 1;

export interface Backup {
  version: number;
  exportedAt: string;
  items: Item[];
  shoppingList: ShoppingListEntry[];
  categories: Category[];
}

export function buildBackup(
  items: Item[],
  shoppingList: ShoppingListEntry[],
  categories: Category[]
): Backup {
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    // Notification ids are device-local and meaningless in a restore, so they
    // are stripped rather than exported and later cancelled against nothing.
    items: items.map((item) => ({ ...item, notificationIds: [] })),
    shoppingList,
    categories,
  };
}

/**
 * A backup file we could read but not accept.
 *
 * Carries an explicit discriminant instead of relying on `instanceof`: when a
 * subclassed Error is transpiled down, the prototype chain is rebuilt and
 * `instanceof` silently returns false, which would swallow the one message that
 * tells the user what is actually wrong with their file.
 */
export class BackupError extends Error {
  readonly isBackupError = true;

  constructor(message: string) {
    super(message);
    this.name = 'BackupError';
  }
}

export function isBackupError(error: unknown): error is BackupError {
  return typeof error === 'object' && error !== null && 'isBackupError' in error;
}

/**
 * Validates an untrusted backup file.
 *
 * A hand-edited or truncated file must fail loudly here rather than half-import
 * and leave the database in a state the user cannot reason about.
 */
export function parseBackup(raw: string): Backup {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new BackupError('That file is not valid JSON.');
  }

  if (typeof data !== 'object' || data === null) {
    throw new BackupError('That file does not look like a Shelfwise backup.');
  }

  const candidate = data as Partial<Backup>;
  if (candidate.version !== BACKUP_VERSION) {
    throw new BackupError(
      `That backup is version ${String(candidate.version ?? '?')}, and this app reads version ${BACKUP_VERSION}.`
    );
  }
  if (!Array.isArray(candidate.items)) {
    throw new BackupError('That backup has no items in it.');
  }

  const items = candidate.items.filter(
    (item): item is Item =>
      typeof item?.id === 'string' &&
      typeof item?.name === 'string' &&
      typeof item?.expiryDate === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(item.expiryDate)
  );

  if (items.length === 0 && candidate.items.length > 0) {
    throw new BackupError('None of the items in that backup could be read.');
  }

  return {
    version: BACKUP_VERSION,
    exportedAt: typeof candidate.exportedAt === 'string' ? candidate.exportedAt : new Date().toISOString(),
    items: items.map((item) => ({ ...item, notificationIds: [] })),
    shoppingList: Array.isArray(candidate.shoppingList)
      ? candidate.shoppingList.filter(
          (entry): entry is ShoppingListEntry =>
            typeof entry?.id === 'string' && typeof entry?.name === 'string'
        )
      : [],
    categories: Array.isArray(candidate.categories) && candidate.categories.length > 0
      ? (candidate.categories as Category[])
      : BUILT_IN_CATEGORIES,
  };
}
