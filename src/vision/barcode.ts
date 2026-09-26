import { repository } from '@/db/driver';
import { categoryFromKeywords } from '@/domain/categories';

import type { ProductInfo } from './types';

const ENDPOINT = 'https://world.openfoodfacts.org/api/v2/product';
const FIELDS = 'product_name,product_name_en,brands,categories_tags,image_front_small_url,quantity';
/** Open Food Facts asks every client to identify itself. */
const USER_AGENT = 'Shelfwise-ExpiryTracker/1.0 (personal home inventory app)';
const TIMEOUT_MS = 8000;

interface OffResponse {
  status?: number;
  product?: {
    product_name?: string;
    product_name_en?: string;
    brands?: string;
    categories_tags?: string[];
    image_front_small_url?: string;
    quantity?: string;
  };
}

/**
 * Resolves a scanned barcode to a product.
 *
 * Cache first, so a repeat scan is instant and still works with no signal —
 * the same jar of jam gets rebought over and over.
 */
export async function lookupBarcode(barcode: string): Promise<ProductInfo | null> {
  const cached = await repository.getCachedProduct(barcode).catch(() => null);
  if (cached) return cached;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let data: OffResponse | null = null;
  try {
    const response = await fetch(`${ENDPOINT}/${encodeURIComponent(barcode)}.json?fields=${FIELDS}`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    data = (await response.json()) as OffResponse;
  } catch {
    // Offline or the database is down; the caller falls back to manual entry.
    return null;
  } finally {
    clearTimeout(timeout);
  }

  const product = data?.product;
  const name = product?.product_name_en?.trim() || product?.product_name?.trim();
  if (data?.status !== 1 || !name) return null;

  const info: ProductInfo = {
    name,
    brand: product?.brands?.split(',')[0]?.trim() || null,
    categoryId: categoryFromKeywords([...(product?.categories_tags ?? []), name]),
    imageUrl: product?.image_front_small_url ?? null,
    packSize: product?.quantity?.trim() || null,
    barcode,
    shelfLifeDays: null,
    confidence: 1,
    source: 'openfoodfacts',
  };

  await repository.cacheProduct(barcode, info).catch(() => undefined);
  return info;
}

/** EAN-13 / UPC-A checksum, used to ignore obvious misreads before a lookup. */
export function isPlausibleBarcode(value: string): boolean {
  if (!/^\d{8}$|^\d{12,13}$/.test(value)) return false;
  const digits = value.split('').map(Number);
  const check = digits.pop()!;
  const sum = digits
    .reverse()
    .reduce((acc, digit, index) => acc + digit * (index % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}
