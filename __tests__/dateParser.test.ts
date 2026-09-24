import { MIN_CONFIDENCE, normalizeLine, parseExpiryFromText } from '@/vision/dateParser';
import { parseExpiryDates } from '@/vision/dateParser';
import type { OcrLine } from '@/vision/types';

/**
 * Every fixture is text that really appears on packaging. `today` is pinned so
 * the "is it in the future" signal behaves the same on every run.
 */
const TODAY = '2026-09-09';

function parse(text: string, dateFormat: 'DMY' | 'MDY' = 'DMY') {
  return parseExpiryFromText(text, { today: TODAY, dateFormat });
}

describe('normalizeLine', () => {
  it('repairs OCR letter/digit confusion inside numeric runs', () => {
    expect(normalizeLine('exp 1O/2O27')).toBe('EXP 10/2027');
    expect(normalizeLine('I2.O3.27')).toBe('12.03.27');
  });

  it('leaves ordinary words alone', () => {
    expect(normalizeLine('Best Before')).toBe('BEST BEFORE');
    expect(normalizeLine('SOUP BASE')).toBe('SOUP BASE');
  });
});

describe('parseExpiryDates — common label formats', () => {
  const cases: [string, string][] = [
    ['EXP 12/2027', '2027-12-31'],
    ['EXP: 12-2027', '2027-12-31'],
    ['BEST BEFORE 03.06.27', '2027-06-03'],
    ['USE BY 30 NOV 2026', '2026-11-30'],
    ['USE BY 30NOV26', '2026-11-30'],
    ['BEST BEFORE END: MAR 2027', '2027-03-31'],
    ['EXPIRY DATE 2027-03-12', '2027-03-12'],
    ['BB 31/12/2026', '2026-12-31'],
    ['VALID UNTIL 01 JAN 2028', '2028-01-01'],
    ['CONSUME BEFORE 15.10.2026', '2026-10-15'],
    ['SELL BY 05 OCT 26', '2026-10-05'],
    ['EXPIRES SEPT 2029', '2029-09-30'],
  ];

  it.each(cases)('reads %s as %s', (text, expected) => {
    const { best } = parse(text);
    expect(best?.date).toBe(expected);
    expect(best?.confidence).toBeGreaterThanOrEqual(MIN_CONFIDENCE);
  });
});

describe('parseExpiryDates — manufacture dates', () => {
  it('prefers the expiry date over the manufacture date on the same label', () => {
    const { best } = parse('MFD 01/2025\nEXP 01/2027');
    expect(best?.date).toBe('2027-01-31');
  });

  it('still prefers expiry when both sit on one line', () => {
    const { best } = parse('MFG 10.2024 EXP 10.2027');
    expect(best?.date).toBe('2027-10-31');
  });

  it('demotes a lone packing date below the confidence bar', () => {
    const { best } = parse('PKD 05/09/2026');
    expect(best?.confidence ?? 0).toBeLessThan(MIN_CONFIDENCE);
  });
});

describe('parseExpiryDates — ambiguous numeric order', () => {
  it('uses the day when one number cannot be a month', () => {
    expect(parse('EXP 25/03/2027').best?.date).toBe('2027-03-25');
    expect(parse('EXP 03/25/2027', 'MDY').best?.date).toBe('2027-03-25');
  });

  it('falls back to the preferred order when genuinely ambiguous', () => {
    expect(parse('EXP 03/04/2027', 'DMY').best?.date).toBe('2027-04-03');
    expect(parse('EXP 03/04/2027', 'MDY').best?.date).toBe('2027-03-04');
  });
});

describe('parseExpiryDates — month precision', () => {
  it('snaps a month-only date to the last day of that month', () => {
    const { best } = parse('BEST BEFORE 02/2028');
    expect(best?.date).toBe('2028-02-29');
    expect(best?.precision).toBe('month');
    expect(best?.snappedToMonthEnd).toBe(true);
  });

  it('handles a non-leap February', () => {
    expect(parse('BEST BEFORE 02/2027').best?.date).toBe('2027-02-28');
  });
});

describe('parseExpiryDates — two-digit years', () => {
  it('reads a short year as the nearest sensible one', () => {
    expect(parse('EXP 12/27').best?.date).toBe('2027-12-31');
  });

  it('does not roll a recent past year into the next century', () => {
    const { best } = parse('EXP 06/24');
    expect(best?.date.startsWith('2024')).toBe(true);
  });
});

describe('parseExpiryDates — noise rejection', () => {
  it('ignores batch and price numbers that are not dates', () => {
    const { best } = parse('LOT 4471\nNET 500 g\nEXP 08/2027\nMRP 249.00');
    expect(best?.date).toBe('2027-08-31');
  });

  it('returns nothing when there is no date at all', () => {
    expect(parse('ORGANIC ROLLED OATS\nNET WT 1 KG').best).toBeNull();
  });

  it('rejects an impossible day', () => {
    expect(parse('EXP 32/13/2027').best?.date).not.toBe('2027-13-32');
  });
});

describe('parseExpiryDates — layout signals', () => {
  const lines = (entries: [string, number][]): OcrLine[] =>
    entries.map(([text, height], i) => ({
      text,
      frame: { left: 0, right: 100, top: i * 40, bottom: i * 40 + height },
    }));

  it('favours the physically larger date when keywords are absent', () => {
    const { best } = parseExpiryDates(
      lines([
        ['04.03.2025', 8],
        ['21.07.2028', 30],
      ]),
      { today: TODAY }
    );
    expect(best?.date).toBe('2028-07-21');
  });

  it('lets a keyword outweigh size', () => {
    const { best } = parseExpiryDates(
      lines([
        ['12.11.2029', 34],
        ['BEST BEFORE 21.07.2027', 10],
      ]),
      { today: TODAY }
    );
    expect(best?.date).toBe('2027-07-21');
  });
});

describe('parseExpiryDates — alternates', () => {
  it('offers the runner-up so the user can correct a misread in one tap', () => {
    const { best, alternates } = parse('MFD 01/2025\nEXP 01/2027');
    expect(best?.date).toBe('2027-01-31');
    expect(alternates.map((a) => a.date)).toContain('2025-01-31');
  });
});
