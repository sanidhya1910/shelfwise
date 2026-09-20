import type { Category } from '@/domain/categories';
import type { Item, ItemSource, ItemStatus, ShoppingListEntry, StorageLocation } from '@/domain/item';

export const SCHEMA_VERSION = 1;

/** Row shapes as stored. Arrays are JSON, booleans are 0/1 — SQLite has neither. */
export interface ItemRow {
  id: string;
  name: string;
  brand: string | null;
  category_id: string;
  location: string;
  quantity: number;
  unit: string | null;
  expiry_date: string;
  added_date: string;
  opened_date: string | null;
  barcode: string | null;
  image_uri: string | null;
  notes: string | null;
  price: number | null;
  status: string;
  status_changed_at: string | null;
  source: string;
  notification_ids: string;
  scan_confidence: number | null;
}

export const CREATE_SQL = `
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  brand TEXT,
  category_id TEXT NOT NULL,
  location TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 1,
  unit TEXT,
  expiry_date TEXT NOT NULL,
  added_date TEXT NOT NULL,
  opened_date TEXT,
  barcode TEXT,
  image_uri TEXT,
  notes TEXT,
  price REAL,
  status TEXT NOT NULL DEFAULT 'active',
  status_changed_at TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  notification_ids TEXT NOT NULL DEFAULT '[]',
  scan_confidence REAL
);

CREATE INDEX IF NOT EXISTS idx_items_status_expiry ON items (status, expiry_date);
CREATE INDEX IF NOT EXISTS idx_items_barcode ON items (barcode);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  default_shelf_life_days INTEGER NOT NULL,
  is_built_in INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS shopping_list (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  category_id TEXT,
  quantity REAL NOT NULL DEFAULT 1,
  checked INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  from_item_id TEXT
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS barcode_cache (
  barcode TEXT PRIMARY KEY NOT NULL,
  payload TEXT NOT NULL,
  fetched_at TEXT NOT NULL
);
`;

export function itemToRow(item: Item): ItemRow {
  return {
    id: item.id,
    name: item.name,
    brand: item.brand,
    category_id: item.categoryId,
    location: item.location,
    quantity: item.quantity,
    unit: item.unit,
    expiry_date: item.expiryDate,
    added_date: item.addedDate,
    opened_date: item.openedDate,
    barcode: item.barcode,
    image_uri: item.imageUri,
    notes: item.notes,
    price: item.price,
    status: item.status,
    status_changed_at: item.statusChangedAt,
    source: item.source,
    notification_ids: JSON.stringify(item.notificationIds ?? []),
    scan_confidence: item.scanConfidence,
  };
}

export function rowToItem(row: ItemRow): Item {
  let notificationIds: string[] = [];
  try {
    const parsed = JSON.parse(row.notification_ids ?? '[]');
    if (Array.isArray(parsed)) notificationIds = parsed.filter((v): v is string => typeof v === 'string');
  } catch {
    // A corrupt cell must not take down the whole list; an empty array just
    // means we lose the ability to cancel those notifications.
  }
  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    categoryId: row.category_id,
    location: row.location as StorageLocation,
    quantity: row.quantity,
    unit: row.unit,
    expiryDate: row.expiry_date,
    addedDate: row.added_date,
    openedDate: row.opened_date,
    barcode: row.barcode,
    imageUri: row.image_uri,
    notes: row.notes,
    price: row.price,
    status: row.status as ItemStatus,
    statusChangedAt: row.status_changed_at,
    source: row.source as ItemSource,
    notificationIds,
    scanConfidence: row.scan_confidence,
  };
}

export function categoryToRow(c: Category) {
  return {
    id: c.id,
    name: c.name,
    icon: c.icon as string,
    color: c.color,
    default_shelf_life_days: c.defaultShelfLifeDays,
    is_built_in: c.isBuiltIn ? 1 : 0,
  };
}

export function rowToCategory(row: ReturnType<typeof categoryToRow>): Category {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon as Category['icon'],
    color: row.color,
    defaultShelfLifeDays: row.default_shelf_life_days,
    isBuiltIn: row.is_built_in === 1,
  };
}

export function shoppingToRow(e: ShoppingListEntry) {
  return {
    id: e.id,
    name: e.name,
    category_id: e.categoryId,
    quantity: e.quantity,
    checked: e.checked ? 1 : 0,
    created_at: e.createdAt,
    from_item_id: e.fromItemId,
  };
}

export function rowToShopping(row: ReturnType<typeof shoppingToRow>): ShoppingListEntry {
  return {
    id: row.id,
    name: row.name,
    categoryId: row.category_id,
    quantity: row.quantity,
    checked: row.checked === 1,
    createdAt: row.created_at,
    fromItemId: row.from_item_id,
  };
}
