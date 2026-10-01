import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { type ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { IconName } from '@/domain/categories';
import { spacing } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

import { Text } from './Text';

export interface ScreenProps {
  children: ReactNode;
  /** Skip when the screen renders its own header inside a scroll view. */
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  style?: ViewStyle;
  edges?: { top?: boolean; bottom?: boolean };
}

export function Screen({ children, title, subtitle, right, style, edges }: ScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const top = edges?.top === false ? 0 : insets.top;

  return (
    <View style={[{ flex: 1, backgroundColor: colors.bg, paddingTop: top }, style]}>
      {title ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: spacing.sm,
          }}>
          <View style={{ flex: 1 }}>
            <Text variant="title">{title}</Text>
            {subtitle ? (
              <Text variant="caption" tone="secondary" style={{ marginTop: 2 }}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );
}

export interface EmptyStateProps {
  icon: IconName;
  title: string;
  body?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, body, action }: EmptyStateProps) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing.xxl,
        paddingVertical: spacing.xxxl,
        gap: spacing.sm,
      }}>
      <View
        style={{
          width: 76,
          height: 76,
          borderRadius: 38,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.surfaceAlt,
          marginBottom: spacing.sm,
        }}>
        <MaterialCommunityIcons name={icon} size={34} color={colors.textMuted} />
      </View>
      {/*
        `alignSelf: stretch` is load-bearing on Android: inside a centred column
        the text box shrink-wraps, RN under-measures bold text, and the last
        word gets clipped. Giving it the full width and centring the glyphs
        instead avoids that entirely.
      */}
      <Text variant="heading" center style={{ alignSelf: 'stretch' }}>
        {title}
      </Text>
      {body ? (
        <Text variant="body" tone="secondary" center style={{ alignSelf: 'stretch' }}>
          {body}
        </Text>
      ) : null}
      {action ? <View style={{ marginTop: spacing.md }}>{action}</View> : null}
    </View>
  );
}
