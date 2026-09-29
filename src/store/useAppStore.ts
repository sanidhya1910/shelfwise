import { create } from 'zustand';

import { repository } from '@/db/driver';
import { BUILT_IN_CATEGORIES, type Category } from '@/domain/categories';
import {
  todayISO,
  type Item,
  type ItemDraft,
  type ItemStatus,
  type ShoppingListEntry,
} from '@/domain/item';
import {
  defaultSettings,
  deserializeSettings,
  serializeSetting,
  type Settings,
} from '@/domain/settings';
import { scheduler } from '@/notifications/scheduler';
import { newId } from '@/utils/id';

export interface AppState {
  hydrated: boolean;
  items: Item[];
  categories: Category[];
  shopping: ShoppingListEntry[];
  settings: Settings;

  hydrate: () => Promise<void>;

  addItem: (draft: ItemDraft) => Promise<Item>;
  updateItem: (id: string, patch: Partial<Item>) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  setItemStatus: (id: string, status: ItemStatus) => Promise<void>;
  adjustQuantity: (id: string, delta: number) => Promise<void>;

  addShopping: (name: string, categoryId?: string | null, fromItemId?: string | null) => Promise<void>;
  toggleShopping: (id: string) => Promise<void>;
  deleteShopping: (id: string) => Promise<void>;
  clearCheckedShopping: () => Promise<void>;

  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  replaceAll: (data: {
    items: Item[];
    shopping: ShoppingListEntry[];
    categories?: Category[];
  }) => Promise<void>;
  clearContent: () => Promise<void>;
}

function draftToItem(draft: ItemDraft): Item {
  return {
    id: draft.id ?? newId(),
    name: draft.name.trim(),
    brand: draft.brand?.trim() || null,
    categoryId: draft.categoryId,
    location: draft.location,
    quantity: draft.quantity,
    unit: draft.unit?.trim() || null,
    expiryDate: draft.expiryDate,
    addedDate: draft.addedDate ?? new Date().toISOString(),
    openedDate: draft.openedDate ?? null,
    barcode: draft.barcode ?? null,
    imageUri: draft.imageUri ?? null,
    notes: draft.notes?.trim() || null,
    price: draft.price ?? null,
    status: draft.status ?? 'active',
    statusChangedAt: draft.statusChangedAt ?? null,
    source: draft.source,
    notificationIds: draft.notificationIds ?? [],
    scanConfidence: draft.scanConfidence ?? null,
  };
}

export const useAppStore = create<AppState>((set, get) => ({
  hydrated: false,
  items: [],
  categories: BUILT_IN_CATEGORIES,
  shopping: [],
  settings: defaultSettings(),

  async hydrate() {
    await repository.init();
    const [items, categories, shopping, rawSettings] = await Promise.all([
      repository.listItems(),
      repository.listCategories(),
      repository.listShopping(),
      repository.listSettings(),
    ]);
    set({
      hydrated: true,
      items,
      categories: categories.length > 0 ? categories : BUILT_IN_CATEGORIES,
      shopping,
      settings: deserializeSettings(rawSettings),
    });
  },

  async addItem(draft) {
    const item = draftToItem(draft);
    const notificationIds = await scheduler.scheduleForItem(item, get().settings);
    const saved = { ...item, notificationIds };
    await repository.upsertItems([saved]);
    set((s) => ({ items: [...s.items, saved] }));
    return saved;
  },

  async updateItem(id, patch) {
    const current = get().items.find((i) => i.id === id);
    if (!current) return;
    const next: Item = { ...current, ...patch, id: current.id };

    // Anything that changes when or whether we should nudge invalidates the
    // pending reminders, so tear them down and rebuild rather than diffing.
    const remindersStale =
      next.expiryDate !== current.expiryDate ||
      next.status !== current.status ||
      next.name !== current.name ||
      next.brand !== current.brand;

    if (remindersStale) {
      await scheduler.cancel(current.notificationIds);
      next.notificationIds = await scheduler.scheduleForItem(next, get().settings);
    }

    await repository.upsertItems([next]);
    set((s) => ({ items: s.items.map((i) => (i.id === id ? next : i)) }));
  },

  async deleteItem(id) {
    const current = get().items.find((i) => i.id === id);
    if (current) await scheduler.cancel(current.notificationIds);
    await repository.deleteItem(id);
    set((s) => ({ items: s.items.filter((i) => i.id !== id) }));
  },

  async setItemStatus(id, status) {
    await get().updateItem(id, { status, statusChangedAt: new Date().toISOString() });
  },

  async adjustQuantity(id, delta) {
    const current = get().items.find((i) => i.id === id);
    if (!current) return;
    const quantity = Math.max(0, Math.round((current.quantity + delta) * 100) / 100);
    // Reaching zero means it is gone, which is the same thing as consuming it.
    if (quantity === 0) {
      await get().updateItem(id, {
        quantity: 0,
        status: 'consumed',
        statusChangedAt: new Date().toISOString(),
      });
      return;
    }
    await get().updateItem(id, { quantity });
  },

  async addShopping(name, categoryId = null, fromItemId = null) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const entry: ShoppingListEntry = {
      id: newId('s'),
      name: trimmed,
      categoryId,
      quantity: 1,
      checked: false,
      createdAt: new Date().toISOString(),
      fromItemId,
    };
    await repository.upsertShopping([entry]);
    set((s) => ({ shopping: [entry, ...s.shopping] }));
  },

  async toggleShopping(id) {
    const current = get().shopping.find((e) => e.id === id);
    if (!current) return;
    const next = { ...current, checked: !current.checked };
    await repository.upsertShopping([next]);
    set((s) => ({ shopping: s.shopping.map((e) => (e.id === id ? next : e)) }));
  },

  async deleteShopping(id) {
    await repository.deleteShopping(id);
    set((s) => ({ shopping: s.shopping.filter((e) => e.id !== id) }));
  },

  async clearCheckedShopping() {
    const checked = get().shopping.filter((e) => e.checked);
    await Promise.all(checked.map((e) => repository.deleteShopping(e.id)));
    set((s) => ({ shopping: s.shopping.filter((e) => !e.checked) }));
  },

  async updateSettings(patch) {
    const next = { ...get().settings, ...patch };
    for (const key of Object.keys(patch) as (keyof Settings)[]) {
      await repository.setSetting(key, serializeSetting(key, next[key]));
    }
    set({ settings: next });

    // Reminder timing changed, so every active schedule is now wrong.
    if (patch.reminderLeadDays !== undefined || patch.notificationHour !== undefined) {
      const active = get().items.filter((i) => i.status === 'active');
      const rescheduled: Item[] = [];
      for (const item of active) {
        await scheduler.cancel(item.notificationIds);
        rescheduled.push({ ...item, notificationIds: await scheduler.scheduleForItem(item, next) });
      }
      if (rescheduled.length > 0) {
        await repository.upsertItems(rescheduled);
        const byId = new Map(rescheduled.map((i) => [i.id, i]));
        set((s) => ({ items: s.items.map((i) => byId.get(i.id) ?? i) }));
      }
    }
  },

  async replaceAll({ items, shopping, categories }) {
    for (const item of get().items) await scheduler.cancel(item.notificationIds);
    await repository.clearContent();
    if (categories) for (const c of categories) await repository.upsertCategory(c);

    const scheduled: Item[] = [];
    for (const item of items) {
      scheduled.push({
        ...item,
        notificationIds: await scheduler.scheduleForItem(item, get().settings),
      });
    }
    await repository.upsertItems(scheduled);
    await repository.upsertShopping(shopping);
    const nextCategories = await repository.listCategories();
    set({
      items: scheduled,
      shopping,
      categories: nextCategories.length > 0 ? nextCategories : BUILT_IN_CATEGORIES,
    });
  },

  async clearContent() {
    for (const item of get().items) await scheduler.cancel(item.notificationIds);
    await repository.clearContent();
    set({ items: [], shopping: [], categories: await repository.listCategories() });
  },
}));

/** Active items only, soonest expiry first — what almost every screen wants. */
export function selectActiveSorted(items: Item[]): Item[] {
  return items
    .filter((i) => i.status === 'active')
    .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
}

export interface UrgencyCounts {
  expired: number;
  dueToday: number;
  thisWeek: number;
  total: number;
}

export function selectUrgencyCounts(items: Item[]): UrgencyCounts {
  const today = todayISO();
  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndISO = todayISO(weekEnd);

  const counts: UrgencyCounts = { expired: 0, dueToday: 0, thisWeek: 0, total: 0 };
  for (const item of items) {
    if (item.status !== 'active') continue;
    counts.total++;
    if (item.expiryDate < today) counts.expired++;
    else if (item.expiryDate === today) counts.dueToday++;
    else if (item.expiryDate <= weekEndISO) counts.thisWeek++;
  }
  return counts;
}
