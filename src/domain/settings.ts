export type DateFormat = 'DMY' | 'MDY';
export type ThemePreference = 'system' | 'light' | 'dark';

export interface Settings {
  /** Days before expiry to fire a reminder. Empty disables reminders. */
  reminderLeadDays: number[];
  /** Local hour (0-23) reminders fire at. */
  notificationHour: number;
  /** Decides 03/04/2027 when neither number settles it. */
  dateFormat: DateFormat;
  /** 'system' follows the device; the others override it. */
  theme: ThemePreference;
  currency: string;
  /** Run the AI fallback automatically when a local scan is unsure. */
  aiAutoFallback: boolean;
  /** Chat model used for product photo recognition. */
  aiModel: string;
  /** True once the user has dismissed the first-run tour. */
  onboarded: boolean;
}

export const AI_MODELS = [
  { id: 'mistral-medium-latest', label: 'Mistral Medium', hint: 'Most accurate' },
  { id: 'ministral-8b-2512', label: 'Ministral 8B', hint: 'Cheapest, still good' },
  { id: 'mistral-large-latest', label: 'Mistral Large', hint: 'Slowest, best on tricky packs' },
] as const;

function guessRegionDefaults(): { dateFormat: DateFormat; currency: string } {
  try {
    const locale = new Intl.DateTimeFormat().resolvedOptions().locale ?? 'en-US';
    // The US is effectively alone in writing month first; treat it as the exception.
    const isUS = /(^|-)US$/i.test(locale) || locale.toLowerCase() === 'en-us';
    const region = locale.split('-')[1]?.toUpperCase();
    const currency =
      { US: '$', GB: '£', IN: '₹', EU: '€', DE: '€', FR: '€', ES: '€', IT: '€', JP: '¥', CN: '¥', AU: 'A$', CA: 'C$' }[
        region ?? ''
      ] ?? '$';
    return { dateFormat: isUS ? 'MDY' : 'DMY', currency };
  } catch {
    return { dateFormat: 'DMY', currency: '$' };
  }
}

export function defaultSettings(): Settings {
  const { dateFormat, currency } = guessRegionDefaults();
  return {
    reminderLeadDays: [7, 3, 1, 0],
    notificationHour: 9,
    dateFormat,
    theme: 'system',
    currency,
    aiAutoFallback: true,
    aiModel: 'mistral-medium-latest',
    onboarded: false,
  };
}

/** Settings live in a key/value table, so everything round-trips through strings. */
export function deserializeSettings(raw: Record<string, string>): Settings {
  const base = defaultSettings();
  const num = (key: string, fallback: number) => {
    const v = Number(raw[key]);
    return Number.isFinite(v) ? v : fallback;
  };
  let leadDays = base.reminderLeadDays;
  if (raw.reminderLeadDays != null) {
    try {
      const parsed = JSON.parse(raw.reminderLeadDays);
      if (Array.isArray(parsed)) {
        leadDays = [...new Set(parsed.filter((n) => Number.isInteger(n) && n >= 0 && n <= 90))].sort(
          (a, b) => b - a
        );
      }
    } catch {
      // Keep the defaults rather than silently disabling every reminder.
    }
  }
  return {
    reminderLeadDays: leadDays,
    notificationHour: Math.min(23, Math.max(0, Math.round(num('notificationHour', base.notificationHour)))),
    dateFormat: raw.dateFormat === 'MDY' ? 'MDY' : raw.dateFormat === 'DMY' ? 'DMY' : base.dateFormat,
    theme:
      raw.theme === 'light' || raw.theme === 'dark' || raw.theme === 'system'
        ? raw.theme
        : base.theme,
    currency: raw.currency ?? base.currency,
    aiAutoFallback: raw.aiAutoFallback ? raw.aiAutoFallback === 'true' : base.aiAutoFallback,
    aiModel: raw.aiModel ?? base.aiModel,
    onboarded: raw.onboarded === 'true',
  };
}

export function serializeSetting<K extends keyof Settings>(key: K, value: Settings[K]): string {
  return Array.isArray(value) ? JSON.stringify(value) : String(value);
}
