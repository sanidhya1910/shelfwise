/** Domain types. Dates are stored as plain strings so nothing drifts across timezones. */

/** `YYYY-MM-DD` — a calendar day, deliberately not a timestamp. */
export type DateOnly = string;
/** Full ISO 8601 timestamp. */
export type Timestamp = string;

export type StorageLocation = 'fridge' | 'freezer' | 'pantry' | 'other';
export type ItemStatus = 'active' | 'consumed' | 'wasted' | 'archived';
export type ItemSource = 'manual' | 'barcode' | 'date-scan' | 'photo-ai';

export interface Item {
  id: string;
  name: string;
  brand: string | null;
  categoryId: string;
  location: StorageLocation;
  quantity: number;
  unit: string | null;
  expiryDate: DateOnly;
  addedDate: Timestamp;
  openedDate: DateOnly | null;
  barcode: string | null;
  imageUri: string | null;
  notes: string | null;
  price: number | null;
  status: ItemStatus;
  statusChangedAt: Timestamp | null;
  source: ItemSource;
  /** Ids of the scheduled local notifications, so we can cancel them on edit. */
  notificationIds: string[];
  /** 0..1 confidence from whichever scan produced the expiry date, null if typed. */
  scanConfidence: number | null;
}

export type ItemDraft = Omit<
  Item,
  'id' | 'addedDate' | 'status' | 'statusChangedAt' | 'notificationIds'
> &
  Partial<Pick<Item, 'id' | 'addedDate' | 'status' | 'statusChangedAt' | 'notificationIds'>>;

export interface ShoppingListEntry {
  id: string;
  name: string;
  categoryId: string | null;
  quantity: number;
  checked: boolean;
  createdAt: Timestamp;
  /** Set when the entry was generated from an item that ran out. */
  fromItemId: string | null;
}

/** `YYYY-MM-DD` for the device's local today — never via toISOString, which is UTC. */
export function todayISO(d: Date = new Date()): DateOnly {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDateOnly(value: DateOnly): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function isActive(item: Item): boolean {
  return item.status === 'active';
}
