import type { Category } from '@/domain/categories';
import type { Item, ShoppingListEntry } from '@/domain/item';
import type { ProductInfo } from '@/vision/types';

/**
 * The whole persistence contract.
 *
 * Deliberately coarse: a household inventory is hundreds of rows, not millions,
 * so the app loads everything into memory once and filters/aggregates there.
 * That keeps the SQLite and IndexedDB drivers thin and identical in behaviour.
 */
export interface Repository {
  init(): Promise<void>;

  listItems(): Promise<Item[]>;
  upsertItems(items: Item[]): Promise<void>;
  deleteItem(id: string): Promise<void>;

  listShopping(): Promise<ShoppingListEntry[]>;
  upsertShopping(entries: ShoppingListEntry[]): Promise<void>;
  deleteShopping(id: string): Promise<void>;

  listCategories(): Promise<Category[]>;
  upsertCategory(category: Category): Promise<void>;
  deleteCategory(id: string): Promise<void>;

  listSettings(): Promise<Record<string, string>>;
  setSetting(key: string, value: string): Promise<void>;

  getCachedProduct(barcode: string): Promise<ProductInfo | null>;
  cacheProduct(barcode: string, product: ProductInfo): Promise<void>;

  /** Wipes items, shopping list and custom categories. Settings survive. */
  clearContent(): Promise<void>;
}
