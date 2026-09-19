import { parseDateOnly, todayISO, type DateOnly } from '@/domain/item';
import type { DateFormat } from '@/domain/settings';

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** "12 Mar 2027" / "Mar 12, 2027" — long enough to be unambiguous at a glance. */
export function formatDate(value: DateOnly, format: DateFormat = 'DMY'): string {
  const d = parseDateOnly(value);
  const day = d.getDate();
  const month = MONTHS_SHORT[d.getMonth()];
  const year = d.getFullYear();
  return format === 'MDY' ? `${month} ${day}, ${year}` : `${day} ${month} ${year}`;
}

export function formatDateLong(value: DateOnly, format: DateFormat = 'DMY'): string {
  const d = parseDateOnly(value);
  return `${WEEKDAYS[d.getDay()]}, ${formatDate(value, format)}`;
}

/** "12/03/2027" or "03/12/2027" — the compact form used in dense rows. */
export function formatDateNumeric(value: DateOnly, format: DateFormat = 'DMY'): string {
  const [y, m, d] = value.split('-');
  return format === 'MDY' ? `${m}/${d}/${y}` : `${d}/${m}/${y}`;
}

export function addDays(value: DateOnly, days: number): DateOnly {
  const d = parseDateOnly(value);
  d.setDate(d.getDate() + days);
  return todayISO(d);
}

/** Clamps to the last valid day, so 31 Jan + 1 month is 28/29 Feb rather than 3 Mar. */
export function addMonths(value: DateOnly, months: number): DateOnly {
  const d = parseDateOnly(value);
  const targetDay = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  d.setDate(Math.min(targetDay, daysInMonth(d.getFullYear(), d.getMonth())));
  return todayISO(d);
}

export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

export function lastDayOfMonth(year: number, monthIndex: number): DateOnly {
  return todayISO(new Date(year, monthIndex, daysInMonth(year, monthIndex)));
}

/** "Mar 2027" — used by the stats chart axis. */
export function formatMonth(year: number, monthIndex: number): string {
  return `${MONTHS_SHORT[monthIndex]} ${year}`;
}

export { MONTHS_SHORT };
