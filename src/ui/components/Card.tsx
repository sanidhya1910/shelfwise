import { type ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';

import { elevation, radius, spacing } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

export interface CardProps {
  children: ReactNode;
  style?: ViewStyle | ViewStyle[];
  level?: 0 | 1 | 2 | 3;
  padded?: boolean;
  /** Flat cards sit on the sunken background and use a border instead of shadow. */
  flat?: boolean;
}

export function Card({ children, style, level = 1, padded = true, flat }: CardProps) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: flat ? colors.surfaceAlt : colors.surface,
          borderRadius: radius.lg,
          padding: padded ? spacing.lg : 0,
          overflow: 'hidden',
        },
        flat
          ? { borderWidth: 1, borderColor: colors.border }
          : elevation(colors, level),
        style as ViewStyle,
      ]}>
      {children}
    </View>
  );
}
