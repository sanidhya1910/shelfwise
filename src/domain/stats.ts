import type { Category } from './categories';
import { parseDateOnly, todayISO, type Item } from './item';

export interface MonthBucket {
  /** `YYYY-MM`, used as the key and for ordering. */
  key: string;
  year: number;
  monthIndex: number;
  consumed: number;
  wasted: number;
  wastedValue: number;
  savedValue: number;
}

export interface CategoryWaste {
  categoryId: string;
  name: string;
  color: string;
  wasted: number;
  wastedValue: number;
}

export interface Stats {
  months: MonthBucket[];
  /** The current month, always present even when empty. */
  current: MonthBucket;
  allTime: { consumed: number; wasted: number; wastedValue: number; savedValue: number };
  /** 0..1. Null when nothing has been resolved yet, so the UI can stay quiet. */
  wasteRate: number | null;
  topWasted: CategoryWaste[];
  /** Consecutive days ending today with nothing binned. */
  streakDays: number;
  /** Active items already past their date — the thing to act on right now. */
  atRisk: number;
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}`;
}

function emptyBucket(date: Date): MonthBucket {
  return {
    key: monthKey(date),
    year: date.getFullYear(),
    monthIndex: date.getMonth(),
    consumed: 0,
    wasted: 0,
    wastedValue: 0,
    savedValue: 0,
  };
}

/**
 * Everything the stats screen needs, in one pass over the items.
 *
 * Value is only counted for items that actually carry a price, so the number is
 * an understatement rather than a guess — a fabricated average would make the
 * headline figure meaningless.
 */
export function computeStats(items: Item[], categories: Category[], monthsBack = 6): Stats {
  const now = new Date();
  const buckets = new Map<string, MonthBucket>();

  for (let i = monthsBack - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.set(monthKey(date), emptyBucket(date));
  }

  const allTime = { consumed: 0, wasted: 0, wastedValue: 0, savedValue: 0 };
  const byCategory = new Map<string, CategoryWaste>();
  let lastWastedAt: number | null = null;

  for (const item of items) {
    if (item.status !== 'consumed' && item.status !== 'wasted') continue;

    const value = (item.price ?? 0) * (item.quantity || 1);
    const resolvedAt = item.statusChangedAt ? new Date(item.statusChangedAt) : null;

    if (item.status === 'consumed') {
      allTime.consumed++;
      allTime.savedValue += value;
    } else {
      allTime.wasted++;
      allTime.wastedValue += value;
      if (resolvedAt) {
        const time = resolvedAt.getTime();
        if (lastWastedAt == null || time > lastWastedAt) lastWastedAt = time;
      }

      const category = categories.find((c) => c.id === item.categoryId);
      const entry = byCategory.get(item.categoryId) ?? {
        categoryId: item.categoryId,
        name: category?.name ?? 'Other',
        color: category?.color ?? '#9A9086',
        wasted: 0,
        wastedValue: 0,
      };
      entry.wasted++;
      entry.wastedValue += value;
      byCategory.set(item.categoryId, entry);
    }

    if (!resolvedAt) continue;
    const bucket = buckets.get(monthKey(resolvedAt));
    if (!bucket) continue;
    if (item.status === 'consumed') {
      bucket.consumed++;
      bucket.savedValue += value;
    } else {
      bucket.wasted++;
      bucket.wastedValue += value;
    }
  }

  const today = todayISO();
  let atRisk = 0;
  for (const item of items) {
    if (item.status === 'active' && item.expiryDate < today) atRisk++;
  }

  const resolved = allTime.consumed + allTime.wasted;
  const months = [...buckets.values()];

  return {
    months,
    current: months[months.length - 1] ?? emptyBucket(now),
    allTime,
    wasteRate: resolved > 0 ? allTime.wasted / resolved : null,
    topWasted: [...byCategory.values()].sort((a, b) => b.wasted - a.wasted).slice(0, 4),
    streakDays: streakSince(lastWastedAt),
    atRisk,
  };
}

/** Whole days between the last binned item and today. */
function streakSince(lastWastedAt: number | null): number {
  if (lastWastedAt == null) return 0;
  const last = new Date(lastWastedAt);
  const lastDay = parseDateOnly(todayISO(last));
  const today = parseDateOnly(todayISO());
  return Math.max(0, Math.round((today.getTime() - lastDay.getTime()) / 86_400_000));
}

export function formatMoney(value: number, currency: string): string {
  const rounded = Math.round(value * 100) / 100;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
  return `${currency}${text}`;
}
