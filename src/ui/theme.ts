/**
 * Shelfwise design tokens — warm, friendly, food-app feel.
 *
 * Surfaces are warm cream rather than pure white so the fresh-green accent and
 * the amber->red urgency ramp read as "produce" rather than "dashboard".
 */
import { Platform } from 'react-native';

export type Urgency = 'expired' | 'today' | 'soon' | 'week' | 'fresh';

const palette = {
  light: {
    bg: '#FBF8F3',
    surface: '#FFFFFF',
    surfaceAlt: '#F4EFE6',
    surfaceSunken: '#EFE9DE',
    border: '#E7DFD2',
    borderStrong: '#D6CBB8',

    text: '#2B2924',
    textSecondary: '#78716A',
    textMuted: '#A69D91',
    onAccent: '#FFFFFF',

    accent: '#2E9E5B',
    accentSoft: '#E2F4E9',
    accentPressed: '#25834A',

    expired: '#D2453C',
    today: '#E46A31',
    soon: '#E39430',
    week: '#D2AC33',
    fresh: '#2E9E5B',

    expiredSoft: '#FBE7E5',
    todaySoft: '#FCEBE1',
    soonSoft: '#FCF1DF',
    weekSoft: '#FAF4DC',
    freshSoft: '#E2F4E9',

    shadow: '#3E3423',
  },
  dark: {
    bg: '#161513',
    surface: '#201E1B',
    surfaceAlt: '#2A2724',
    surfaceSunken: '#121110',
    border: '#34302B',
    borderStrong: '#463F38',

    text: '#F3EFE8',
    textSecondary: '#A89F93',
    textMuted: '#7B7268',
    onAccent: '#0C1F14',

    accent: '#4FC47D',
    accentSoft: '#1C3626',
    accentPressed: '#43AE6C',

    expired: '#F0685F',
    today: '#F58A52',
    soon: '#F0AC4F',
    week: '#E0C455',
    fresh: '#4FC47D',

    expiredSoft: '#3A1F1D',
    todaySoft: '#3A2519',
    soonSoft: '#3A2E19',
    weekSoft: '#37331B',
    freshSoft: '#1C3626',

    shadow: '#000000',
  },
};

export type ThemeColors = typeof palette.light;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

/**
 * Bottom padding a tab screen's scroll content needs so its last row clears the
 * tab bar. Kept next to the spacing scale because every tab screen needs it.
 */
export const tabBarClearance = Platform.select({ android: 76, default: 96 }) ?? 76;

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  pill: 999,
} as const;

export const type = {
  display: { fontSize: 34, lineHeight: 40, fontWeight: '700' },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '700' },
  heading: { fontSize: 19, lineHeight: 25, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '500' },
  label: { fontSize: 14, lineHeight: 19, fontWeight: '600' },
  caption: { fontSize: 12.5, lineHeight: 17, fontWeight: '600' },
  micro: { fontSize: 11, lineHeight: 14, fontWeight: '700' },
} as const;

/** Warm, low-spread elevation. Cards should feel like paper, not glass. */
export function elevation(colors: ThemeColors, level: 0 | 1 | 2 | 3) {
  if (level === 0) return {};
  const spec = [
    null,
    { o: 0.05, r: 8, y: 2, e: 1 },
    { o: 0.07, r: 16, y: 6, e: 3 },
    { o: 0.11, r: 28, y: 12, e: 8 },
  ][level]!;
  return Platform.select({
    android: { elevation: spec.e, shadowColor: colors.shadow },
    default: {
      shadowColor: colors.shadow,
      shadowOpacity: spec.o,
      shadowRadius: spec.r,
      shadowOffset: { width: 0, height: spec.y },
    },
  });
}

export const timing = {
  /** Snappy feedback — presses, chips, toggles. */
  fast: 160,
  /** Default for most transitions. */
  base: 260,
  /** Entrances and larger layout moves. */
  slow: 420,
} as const;

export const spring = {
  /** For anything the finger is driving. */
  responsive: { damping: 20, stiffness: 260, mass: 0.7 },
  /** For things that should feel a little alive. */
  bouncy: { damping: 13, stiffness: 190, mass: 0.8 },
  /** For large surfaces where overshoot would look sloppy. */
  gentle: { damping: 26, stiffness: 150, mass: 1 },
} as const;

export function getColors(scheme: 'light' | 'dark' | null | undefined): ThemeColors {
  return scheme === 'dark' ? palette.dark : palette.light;
}
