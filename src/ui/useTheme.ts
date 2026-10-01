import { useColorScheme } from 'react-native';

import { useAppStore } from '@/store/useAppStore';

import { getColors, type ThemeColors } from './theme';

/**
 * Resolves the palette for the current render.
 *
 * Reads the saved preference rather than the device directly, so a user who
 * wants Shelfwise light while their phone is dark gets that; 'system' falls
 * through to the device setting.
 */
export function useTheme(): { colors: ThemeColors; scheme: 'light' | 'dark' } {
  const system = useColorScheme();
  const preference = useAppStore((s) => s.settings.theme);
  const scheme = preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;
  return { colors: getColors(scheme), scheme };
}
