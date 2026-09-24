import { todayISO, type DateOnly } from '@/domain/item';
import type { DateFormat } from '@/domain/settings';
import { daysInMonth, lastDayOfMonth } from '@/utils/dates';

import type { DateCandidate, OcrLine } from './types';

/** Below this we stop trusting the local read and offer the AI fallback. */
export const MIN_CONFIDENCE = 0.55;

const MONTH_NAMES: Record<string, number> = {
  JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
  JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
  // Spelling variants that turn up on packaging around the world.
  SEPT: 8, MARCH: 2, APRIL: 3, JUNE: 5, JULY: 6,
  ENE: 0, ABR: 3, AGO: 7, DIC: 11,
  MRZ: 2, MAI: 4, OKT: 9, DEZ: 11,
};

const MONTH_ALT = Object.keys(MONTH_NAMES).sort((a, b) => b.length - a.length).join('|');

const EXPIRY_KEYWORDS = [
  'BEST BEFORE END', 'BEST BEFORE', 'BEST BY', 'BEST-BEFORE',
  'USE BY', 'USE BEFORE', 'USE-BY',
  'CONSUME BEFORE', 'CONSUME BY',
  'EXPIRY DATE', 'EXPIRY', 'EXPIRES', 'EXPIRATION', 'EXP DATE', 'EXP',
  'SELL BY', 'VALID UNTIL', 'VALID TILL', 'VALID UPTO', 'VALID TO',
  'BBE', 'BBD', 'BB',
];

const MANUFACTURE_KEYWORDS = [
  'MANUFACTURED', 'MANUFACTURE', 'MFG DATE', 'MFD', 'MFG', 'PKD', 'PACKED', 'PACKAGED',
  'PRODUCTION', 'PRODUCED', 'PROD', 'DOM', 'DATE OF MANUFACTURE',
];

/**
 * Repairs the letter/digit confusions OCR makes, but only where a digit is
 * already expected — otherwise "SOUP" would become "5OUP".
 */
function repairDigits(text: string): string {
  return text.replace(/[0-9OISBZ]{2,}/g, (run) => {
    // Only rewrite runs that are mostly digits already.
    const digits = (run.match(/[0-9]/g) ?? []).length;
    if (digits < Math.ceil(run.length / 2)) return run;
    return run
      .replace(/O/g, '0')
      .replace(/I/g, '1')
      .replace(/S/g, '5')
      .replace(/B/g, '8')
      .replace(/Z/g, '2');
  });
}

export function normalizeLine(text: string): string {
  return repairDigits(
    text
      .toUpperCase()
      .replace(/[–—]/g, '-')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

function containsAny(text: string, words: string[]): number {
  // Returns the index of the earliest match, or -1.
  let best = -1;
  for (const word of words) {
    const idx = text.indexOf(word);
    if (idx !== -1 && (best === -1 || idx < best)) best = idx;
  }
  return best;
}

/** Two-digit years are always the nearest sensible future, never the 1900s. */
function expandYear(raw: string, referenceYear: number): number {
  const n = Number(raw);
  if (raw.length === 4) return n;
  const century = Math.floor(referenceYear / 100) * 100;
  let year = century + n;
  // A "24" printed in 2026 is far more likely 2024 than 2124, but a "05"
  // printed in 2099 should roll forward, so only nudge when clearly stale.
  if (year < referenceYear - 10) year += 100;
  return year;
}

function isValidYmd(year: number, month: number, day: number): boolean {
  if (month < 0 || month > 11) return false;
  if (day < 1 || day > daysInMonth(year, month)) return false;
  return year >= 1990 && year <= 2100;
}

function iso(year: number, month: number, day: number): DateOnly {
  return `${year}-${`${month + 1}`.padStart(2, '0')}-${`${day}`.padStart(2, '0')}`;
}

interface RawCandidate {
  date: DateOnly;
  raw: string;
  precision: 'day' | 'month';
  snappedToMonthEnd: boolean;
  /** Character offset within the line, used for keyword proximity. */
  offset: number;
}

function monthIndex(token: string): number | undefined {
  return MONTH_NAMES[token as keyof typeof MONTH_NAMES];
}

/**
 * Pulls every plausible date out of one normalized line.
 * Ordering matters: the most specific patterns run first so that, for example,
 * "2027-03-12" is not also read as the month-year pair "27-03".
 */
function extractFromLine(line: string, dateFormat: DateFormat, referenceYear: number): RawCandidate[] {
  const found: RawCandidate[] = [];
  const claimed: [number, number][] = [];

  const overlaps = (start: number, end: number) =>
    claimed.some(([s, e]) => start < e && end > s);

  const push = (c: RawCandidate, start: number, end: number) => {
    if (overlaps(start, end)) return;
    claimed.push([start, end]);
    found.push(c);
  };

  const scan = (re: RegExp, handle: (m: RegExpExecArray) => RawCandidate | null) => {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line)) !== null) {
      const candidate = handle(m);
      if (candidate) push(candidate, m.index, m.index + m[0].length);
    }
  };

  // 2027-03-12 / 2027.03.12
  scan(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/g, (m) => {
    const year = Number(m[1]);
    const month = Number(m[2]) - 1;
    const day = Number(m[3]);
    if (!isValidYmd(year, month, day)) return null;
    return { date: iso(year, month, day), raw: m[0], precision: 'day', snappedToMonthEnd: false, offset: m.index };
  });

  // 12 MAR 2027 / 12MAR27 / 12-MAR-2027
  scan(new RegExp(`\\b(\\d{1,2})\\s*[-/. ]?\\s*(${MONTH_ALT})[A-Z]*\\.?\\s*[-/. ]?\\s*(\\d{2,4})\\b`, 'g'), (m) => {
    const month = monthIndex(m[2]);
    if (month === undefined) return null;
    const day = Number(m[1]);
    const year = expandYear(m[3], referenceYear);
    if (!isValidYmd(year, month, day)) return null;
    return { date: iso(year, month, day), raw: m[0], precision: 'day', snappedToMonthEnd: false, offset: m.index };
  });

  // MAR 12 2027 / MAR 12, 2027.
  // The day and year must be separated by real whitespace or a comma, otherwise
  // "MAR 2027" would be read as day 20 of year 27.
  scan(new RegExp(`\\b(${MONTH_ALT})[A-Z]*\\.?\\s+(\\d{1,2})[\\s,]+(\\d{2,4})\\b`, 'g'), (m) => {
    const month = monthIndex(m[1]);
    if (month === undefined) return null;
    const day = Number(m[2]);
    const year = expandYear(m[3], referenceYear);
    if (!isValidYmd(year, month, day)) return null;
    return { date: iso(year, month, day), raw: m[0], precision: 'day', snappedToMonthEnd: false, offset: m.index };
  });

  // 12/03/2027 — order decided below
  scan(/\b(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{2,4})\b/g, (m) => {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const year = expandYear(m[3], referenceYear);

    let day: number;
    let month: number;
    if (a > 12 && b <= 12) {
      day = a;
      month = b - 1;
    } else if (b > 12 && a <= 12) {
      month = a - 1;
      day = b;
    } else {
      // Genuinely ambiguous, so fall back to how this user writes dates.
      day = dateFormat === 'MDY' ? b : a;
      month = (dateFormat === 'MDY' ? a : b) - 1;
    }
    if (!isValidYmd(year, month, day)) return null;
    return { date: iso(year, month, day), raw: m[0], precision: 'day', snappedToMonthEnd: false, offset: m.index };
  });

  // MAR 2027 / MAR/27
  scan(new RegExp(`\\b(${MONTH_ALT})[A-Z]*\\.?\\s*[-/. ]?\\s*(\\d{2,4})\\b`, 'g'), (m) => {
    const month = monthIndex(m[1]);
    if (month === undefined) return null;
    const year = expandYear(m[2], referenceYear);
    if (!isValidYmd(year, month, 1)) return null;
    return {
      date: lastDayOfMonth(year, month),
      raw: m[0],
      precision: 'month',
      snappedToMonthEnd: true,
      offset: m.index,
    };
  });

  // 2027-03
  scan(/\b(\d{4})[-/.](\d{1,2})\b/g, (m) => {
    const year = Number(m[1]);
    const month = Number(m[2]) - 1;
    if (!isValidYmd(year, month, 1)) return null;
    return {
      date: lastDayOfMonth(year, month),
      raw: m[0],
      precision: 'month',
      snappedToMonthEnd: true,
      offset: m.index,
    };
  });

  // 03/2027 or 03/27 — month and year
  scan(/\b(\d{1,2})[-/.](\d{2,4})\b/g, (m) => {
    const month = Number(m[1]) - 1;
    const year = expandYear(m[2], referenceYear);
    if (!isValidYmd(year, month, 1)) return null;
    return {
      date: lastDayOfMonth(year, month),
      raw: m[0],
      precision: 'month',
      snappedToMonthEnd: true,
      offset: m.index,
    };
  });

  return found;
}

export interface ParseOptions {
  dateFormat?: DateFormat;
  /** Overridable so tests are not tied to the real clock. */
  today?: DateOnly;
}

export interface ParsedDates {
  best: DateCandidate | null;
  alternates: DateCandidate[];
}

/**
 * Ranks every date found in an OCR result and returns the most likely expiry.
 *
 * The signals, in rough order of usefulness: proximity to an expiry keyword,
 * distance from a manufacture keyword, whether the date is in the future, and
 * how physically prominent the text is — printed expiry dates are usually the
 * largest thing in their corner of the pack.
 */
export function parseExpiryDates(lines: OcrLine[], options: ParseOptions = {}): ParsedDates {
  const dateFormat = options.dateFormat ?? 'DMY';
  const today = options.today ?? todayISO();
  const referenceYear = Number(today.slice(0, 4));

  const normalized = lines.map((line) => ({
    text: normalizeLine(line.text),
    height: line.frame ? Math.abs(line.frame.bottom - line.frame.top) : null,
  }));

  const heights = normalized.map((l) => l.height).filter((h): h is number => h != null && h > 0);
  const maxHeight = heights.length > 0 ? Math.max(...heights) : null;

  const byDate = new Map<string, DateCandidate>();

  normalized.forEach((line, index) => {
    const previous = index > 0 ? normalized[index - 1].text : '';

    const expiryHere = containsAny(line.text, EXPIRY_KEYWORDS);
    const expiryAbove = containsAny(previous, EXPIRY_KEYWORDS);
    const mfgHere = containsAny(line.text, MANUFACTURE_KEYWORDS);
    const mfgAbove = containsAny(previous, MANUFACTURE_KEYWORDS);

    for (const candidate of extractFromLine(line.text, dateFormat, referenceYear)) {
      let score = 0.5;

      if (expiryHere !== -1) {
        // A keyword sitting just before the date is the strongest signal there is.
        const gap = candidate.offset - expiryHere;
        score += gap >= 0 && gap < 24 ? 0.3 : 0.18;
      } else if (expiryAbove !== -1) {
        score += 0.2;
      }

      if (mfgHere !== -1) {
        const gap = candidate.offset - mfgHere;
        score -= gap >= 0 && gap < 24 ? 0.4 : 0.2;
      } else if (mfgAbove !== -1) {
        score -= 0.25;
      }

      if (candidate.raw.length >= 8) score += 0.08;

      if (candidate.date >= today) {
        score += 0.15;
        // A date decades out is almost always a misread, not a tin of beans.
        const years = Number(candidate.date.slice(0, 4)) - referenceYear;
        if (years > 15) score -= 0.35;
      } else {
        // Already-expired items are real, but a past date is more often a
        // packing date that slipped through the manufacture-keyword check.
        score -= 0.25;
      }

      if (maxHeight && line.height) {
        score += Math.min(0.15, (line.height / maxHeight) * 0.15);
      }

      const confidence = Math.max(0, Math.min(1, score));
      const existing = byDate.get(candidate.date);
      if (!existing || existing.confidence < confidence) {
        byDate.set(candidate.date, {
          date: candidate.date,
          confidence,
          raw: candidate.raw,
          precision: candidate.precision,
          snappedToMonthEnd: candidate.snappedToMonthEnd,
        });
      }
    }
  });

  const ranked = [...byDate.values()].sort((a, b) => b.confidence - a.confidence);
  return { best: ranked[0] ?? null, alternates: ranked.slice(1, 5) };
}

/** Convenience wrapper for callers that only have flat text. */
export function parseExpiryFromText(text: string, options: ParseOptions = {}): ParsedDates {
  return parseExpiryDates(
    text.split(/\r?\n/).map((line) => ({ text: line, frame: null })),
    options
  );
}
