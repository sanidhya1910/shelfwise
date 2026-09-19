import type { ThemeColors, Urgency } from '@/ui/theme';

import { parseDateOnly, todayISO, type DateOnly } from './item';

export interface Freshness {
  daysLeft: number;
  urgency: Urgency;
  /** Short form for badges: "3d", "Today", "2d ago". */
  short: string;
  /** Sentence form for cards: "Expires in 3 days". */
  long: string;
}

/** Whole calendar days between today and `expiry`. Negative once expired. */
export function daysUntil(expiry: DateOnly, from: DateOnly = todayISO()): number {
  const a = parseDateOnly(from);
  const b = parseDateOnly(expiry);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export function urgencyOf(daysLeft: number): Urgency {
  if (daysLeft < 0) return 'expired';
  if (daysLeft === 0) return 'today';
  if (daysLeft <= 3) return 'soon';
  if (daysLeft <= 7) return 'week';
  return 'fresh';
}

export function freshnessOf(expiry: DateOnly, from: DateOnly = todayISO()): Freshness {
  const daysLeft = daysUntil(expiry, from);
  const urgency = urgencyOf(daysLeft);

  let short: string;
  let long: string;
  if (daysLeft < 0) {
    const n = Math.abs(daysLeft);
    short = n === 1 ? '1d ago' : `${n}d ago`;
    long = n === 1 ? 'Expired yesterday' : `Expired ${n} days ago`;
  } else if (daysLeft === 0) {
    short = 'Today';
    long = 'Expires today';
  } else if (daysLeft === 1) {
    short = '1d';
    long = 'Expires tomorrow';
  } else if (daysLeft < 31) {
    short = `${daysLeft}d`;
    long = `Expires in ${daysLeft} days`;
  } else if (daysLeft < 365) {
    const months = Math.round(daysLeft / 30);
    short = `${months}mo`;
    long = months === 1 ? 'Expires in about a month' : `Expires in about ${months} months`;
  } else {
    const years = Math.floor(daysLeft / 365);
    short = `${years}y`;
    long = years === 1 ? 'Expires in over a year' : `Expires in over ${years} years`;
  }

  return { daysLeft, urgency, short, long };
}

export function urgencyColor(urgency: Urgency, colors: ThemeColors): string {
  return colors[urgency];
}

export function urgencySoftColor(urgency: Urgency, colors: ThemeColors): string {
  const key = `${urgency}Soft` as const;
  return colors[key];
}

export const URGENCY_LABEL: Record<Urgency, string> = {
  expired: 'Expired',
  today: 'Today',
  soon: 'Next 3 days',
  week: 'This week',
  fresh: 'Fresh',
};

/**
 * How full the freshness ring should be, 0..1.
 *
 * Anchored to a 60-day window so a tin of beans and a bag of salad do not both
 * render as a full circle — the ring is about attention, not proportion.
 */
export function ringProgress(daysLeft: number): number {
  if (daysLeft <= 0) return 1;
  return Math.max(0.04, Math.min(1, 1 - daysLeft / 60));
}
