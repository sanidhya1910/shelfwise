// Dexie ships its class as both the default and a named export; the default
// import is the documented usage.
// eslint-disable-next-line import/no-named-as-default
import Dexie, { type EntityTable } from 'dexie';

import { BUILT_IN_CATEGORIES, type Category } from '@/domain/categories';
import type { Item, ShoppingListEntry } from '@/domain/item';
import type { ProductInfo } from '@/vision/types';

import type { Repository } from './repository';

/**
 * IndexedDB rather than the WASM build of SQLite: the web target is a viewer for
 * an exported backup, and expo-sqlite's web support still needs COOP/COEP headers
 * that a plain static host will not send. Dexie stores the domain objects directly,
 * so no row mapping is needed here.
 */
interface SettingRow {
  key: string;
  value: string;
}
interface CacheRow {
  barcode: string;
  payload: ProductInfo;
  fetchedAt: string;
}

const db = new Dexie('shelfwise') as Dexie & {
  items: EntityTable<Item, 'id'>;
  categories: EntityTable<Category, 'id'>;
  shopping: EntityTable<ShoppingListEntry, 'id'>;
  settings: EntityTable<SettingRow, 'key'>;
  barcodeCache: EntityTable<CacheRow, 'barcode'>;
};

db.version(1).stores({
  items: 'id, status, expiryDate, categoryId, barcode',
  categories: 'id',
  shopping: 'id',
  settings: 'key',
  barcodeCache: 'barcode',
});

let ready: Promise<void> | null = null;

async function open(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      await db.open();
      if ((await db.categories.count()) === 0) {
        await db.categories.bulkPut(BUILT_IN_CATEGORIES);
      }
    })();
  }
  return ready;
}

export const repository: Repository = {
  async init() {
    await open();
  },

  async listItems() {
    await open();
    return db.items.toArray();
  },

  async upsertItems(items: Item[]) {
    await open();
    await db.items.bulkPut(items);
  },

  async deleteItem(id: string) {
    await open();
    await db.items.delete(id);
  },

  async listShopping() {
    await open();
    return db.shopping.toArray();
  },

  async upsertShopping(entries: ShoppingListEntry[]) {
    await open();
    await db.shopping.bulkPut(entries);
  },

  async deleteShopping(id: string) {
    await open();
    await db.shopping.delete(id);
  },

  async listCategories() {
    await open();
    return db.categories.toArray();
  },

  async upsertCategory(category: Category) {
    await open();
    await db.categories.put(category);
  },

  async deleteCategory(id: string) {
    await open();
    const existing = await db.categories.get(id);
    if (existing && !existing.isBuiltIn) await db.categories.delete(id);
  },

  async listSettings() {
    await open();
    const rows = await db.settings.toArray();
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  },

  async setSetting(key: string, value: string) {
    await open();
    await db.settings.put({ key, value });
  },

  async getCachedProduct(barcode: string) {
    await open();
    const row = await db.barcodeCache.get(barcode);
    return row ? { ...row.payload, source: 'cache' as const } : null;
  },

  async cacheProduct(barcode: string, product: ProductInfo) {
    await open();
    await db.barcodeCache.put({ barcode, payload: product, fetchedAt: new Date().toISOString() });
  },

  async clearContent() {
    await open();
    await db.items.clear();
    await db.shopping.clear();
    const custom = await db.categories.filter((c) => !c.isBuiltIn).toArray();
    await db.categories.bulkDelete(custom.map((c) => c.id));
  },
};
