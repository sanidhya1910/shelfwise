import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { BUILT_IN_CATEGORIES } from '@/domain/categories';
import type { Item, ShoppingListEntry } from '@/domain/item';
import { buildBackup, isBackupError, parseBackup, BACKUP_VERSION } from '@/utils/backup';

/** A real export pulled off a device, so the format is pinned to reality. */
const deviceBackup = readFileSync(join(__dirname, 'fixtures/device-backup.json'), 'utf8');

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 'i_1',
    name: 'Greek yoghurt',
    brand: 'Amul',
    categoryId: 'dairy',
    location: 'fridge',
    quantity: 1,
    unit: null,
    expiryDate: '2027-03-12',
    addedDate: '2026-09-09T10:00:00.000Z',
    openedDate: null,
    barcode: null,
    imageUri: null,
    notes: null,
    price: 60,
    status: 'active',
    statusChangedAt: null,
    source: 'date-scan',
    notificationIds: ['n1', 'n2'],
    scanConfidence: 0.82,
    ...overrides,
  };
}

describe('buildBackup', () => {
  it('strips notification ids, which mean nothing on another device', () => {
    const backup = buildBackup([makeItem()], [], BUILT_IN_CATEGORIES);
    expect(backup.items[0].notificationIds).toEqual([]);
    expect(backup.version).toBe(BACKUP_VERSION);
  });

  it('keeps everything else about the item intact', () => {
    const item = makeItem();
    const [restored] = parseBackup(
      JSON.stringify(buildBackup([item], [], BUILT_IN_CATEGORIES))
    ).items;
    expect(restored).toEqual({ ...item, notificationIds: [] });
  });
});

describe('parseBackup — a real device export', () => {
  it('accepts a file the app actually produced', () => {
    const backup = parseBackup(deviceBackup);
    expect(backup.items).toHaveLength(5);
    expect(backup.categories.length).toBeGreaterThan(0);
  });

  it('preserves the statuses the stats screen depends on', () => {
    const statuses = parseBackup(deviceBackup).items.map((i) => i.status);
    expect(statuses).toContain('active');
    expect(statuses).toContain('consumed');
    expect(statuses).toContain('wasted');
  });

  it('survives the CRLF a file round-tripped through Windows picks up', () => {
    expect(parseBackup(deviceBackup.replace(/\n/g, '\r\n')).items).toHaveLength(5);
  });
});

describe('parseBackup — rejection', () => {
  const cases: [string, string][] = [
    ['not JSON at all', 'not json {'],
    ['a JSON array', '[]'],
    ['a different version', JSON.stringify({ version: 99, items: [] })],
    ['no items array', JSON.stringify({ version: 1 })],
  ];

  it.each(cases)('rejects %s with an explanation', (_label, raw) => {
    try {
      parseBackup(raw);
      throw new Error('should have thrown');
    } catch (error) {
      // The discriminant must survive transpilation — `instanceof` does not.
      expect(isBackupError(error)).toBe(true);
      expect((error as Error).message.length).toBeGreaterThan(10);
    }
  });

  it('rejects a file whose items are all unreadable', () => {
    const raw = JSON.stringify({ version: 1, items: [{ id: 1 }, { name: null }] });
    expect(() => parseBackup(raw)).toThrow(/none of the items/i);
  });

  it('drops individual malformed items but keeps the good ones', () => {
    const raw = JSON.stringify({
      version: 1,
      items: [makeItem(), { id: 'bad', name: 'No date' }, makeItem({ id: 'i_2' })],
    });
    expect(parseBackup(raw).items.map((i) => i.id)).toEqual(['i_1', 'i_2']);
  });

  it('tolerates a missing shopping list', () => {
    const raw = JSON.stringify({ version: 1, items: [makeItem()] });
    expect(parseBackup(raw).shoppingList).toEqual([]);
  });

  it('falls back to the built-in categories when none are included', () => {
    const raw = JSON.stringify({ version: 1, items: [makeItem()], categories: [] });
    expect(parseBackup(raw).categories).toEqual(BUILT_IN_CATEGORIES);
  });
});

describe('isBackupError', () => {
  it('does not claim ordinary errors as its own', () => {
    expect(isBackupError(new Error('boom'))).toBe(false);
    expect(isBackupError(null)).toBe(false);
    expect(isBackupError('string')).toBe(false);
  });
});

describe('shopping list round trip', () => {
  it('carries entries through unchanged', () => {
    const entry: ShoppingListEntry = {
      id: 's_1',
      name: 'Milk',
      categoryId: 'dairy',
      quantity: 2,
      checked: false,
      createdAt: '2026-09-09T10:00:00.000Z',
      fromItemId: null,
    };
    const raw = JSON.stringify(buildBackup([], [entry], BUILT_IN_CATEGORIES));
    expect(parseBackup(raw).shoppingList).toEqual([entry]);
  });
});
