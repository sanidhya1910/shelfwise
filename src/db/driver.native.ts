import * as SQLite from 'expo-sqlite';

import { BUILT_IN_CATEGORIES, type Category } from '@/domain/categories';
import type { Item, ShoppingListEntry } from '@/domain/item';
import type { ProductInfo } from '@/vision/types';

import type { Repository } from './repository';
import {
  CREATE_SQL,
  categoryToRow,
  itemToRow,
  rowToCategory,
  rowToItem,
  rowToShopping,
  shoppingToRow,
  type ItemRow,
} from './schema';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function open(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('shelfwise.db');
      await db.execAsync(CREATE_SQL);
      await seedCategories(db);
      return db;
    })();
  }
  return dbPromise;
}

/** Built-in categories are rows, not constants, so users can retune shelf lives. */
async function seedCategories(db: SQLite.SQLiteDatabase) {
  const existing = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM categories');
  if ((existing?.n ?? 0) > 0) return;
  for (const c of BUILT_IN_CATEGORIES) {
    const r = categoryToRow(c);
    await db.runAsync(
      `INSERT OR REPLACE INTO categories (id, name, icon, color, default_shelf_life_days, is_built_in)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [r.id, r.name, r.icon, r.color, r.default_shelf_life_days, r.is_built_in]
    );
  }
}

const ITEM_COLUMNS =
  'id, name, brand, category_id, location, quantity, unit, expiry_date, added_date, opened_date, ' +
  'barcode, image_uri, notes, price, status, status_changed_at, source, notification_ids, scan_confidence';
const ITEM_PLACEHOLDERS = new Array(19).fill('?').join(', ');

export const repository: Repository = {
  async init() {
    await open();
  },

  async listItems() {
    const db = await open();
    const rows = await db.getAllAsync<ItemRow>(`SELECT ${ITEM_COLUMNS} FROM items`);
    return rows.map(rowToItem);
  },

  async upsertItems(items: Item[]) {
    if (items.length === 0) return;
    const db = await open();
    await db.withTransactionAsync(async () => {
      for (const item of items) {
        const r = itemToRow(item);
        await db.runAsync(
          `INSERT OR REPLACE INTO items (${ITEM_COLUMNS}) VALUES (${ITEM_PLACEHOLDERS})`,
          [
            r.id, r.name, r.brand, r.category_id, r.location, r.quantity, r.unit,
            r.expiry_date, r.added_date, r.opened_date, r.barcode, r.image_uri,
            r.notes, r.price, r.status, r.status_changed_at, r.source,
            r.notification_ids, r.scan_confidence,
          ]
        );
      }
    });
  },

  async deleteItem(id: string) {
    const db = await open();
    await db.runAsync('DELETE FROM items WHERE id = ?', [id]);
  },

  async listShopping() {
    const db = await open();
    const rows = await db.getAllAsync<ReturnType<typeof shoppingToRow>>('SELECT * FROM shopping_list');
    return rows.map(rowToShopping);
  },

  async upsertShopping(entries: ShoppingListEntry[]) {
    if (entries.length === 0) return;
    const db = await open();
    await db.withTransactionAsync(async () => {
      for (const e of entries) {
        const r = shoppingToRow(e);
        await db.runAsync(
          `INSERT OR REPLACE INTO shopping_list (id, name, category_id, quantity, checked, created_at, from_item_id)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [r.id, r.name, r.category_id, r.quantity, r.checked, r.created_at, r.from_item_id]
        );
      }
    });
  },

  async deleteShopping(id: string) {
    const db = await open();
    await db.runAsync('DELETE FROM shopping_list WHERE id = ?', [id]);
  },

  async listCategories() {
    const db = await open();
    const rows = await db.getAllAsync<ReturnType<typeof categoryToRow>>('SELECT * FROM categories');
    return rows.map(rowToCategory);
  },

  async upsertCategory(category: Category) {
    const db = await open();
    const r = categoryToRow(category);
    await db.runAsync(
      `INSERT OR REPLACE INTO categories (id, name, icon, color, default_shelf_life_days, is_built_in)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [r.id, r.name, r.icon, r.color, r.default_shelf_life_days, r.is_built_in]
    );
  },

  async deleteCategory(id: string) {
    const db = await open();
    await db.runAsync('DELETE FROM categories WHERE id = ? AND is_built_in = 0', [id]);
  },

  async listSettings() {
    const db = await open();
    const rows = await db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM settings');
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  },

  async setSetting(key: string, value: string) {
    const db = await open();
    await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
  },

  async getCachedProduct(barcode: string) {
    const db = await open();
    const row = await db.getFirstAsync<{ payload: string }>(
      'SELECT payload FROM barcode_cache WHERE barcode = ?',
      [barcode]
    );
    if (!row) return null;
    try {
      return { ...(JSON.parse(row.payload) as ProductInfo), source: 'cache' as const };
    } catch {
      return null;
    }
  },

  async cacheProduct(barcode: string, product: ProductInfo) {
    const db = await open();
    await db.runAsync(
      'INSERT OR REPLACE INTO barcode_cache (barcode, payload, fetched_at) VALUES (?, ?, ?)',
      [barcode, JSON.stringify(product), new Date().toISOString()]
    );
  },

  async clearContent() {
    const db = await open();
    await db.execAsync(
      'DELETE FROM items; DELETE FROM shopping_list; DELETE FROM categories WHERE is_built_in = 0;'
    );
  },
};
