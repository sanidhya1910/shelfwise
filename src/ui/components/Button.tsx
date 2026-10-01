import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ActivityIndicator, View, type ViewStyle } from 'react-native';

import type { IconName } from '@/domain/categories';
import { elevation, radius, spacing } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

import { Touchable } from './Pressable';
import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  icon?: IconName;
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
}

export function Button({
  label,
  onPress,
  icon,
  variant = 'primary',
  size = 'md',
  disabled,
  loading,
  fullWidth,
  style,
}: ButtonProps) {
  const { colors } = useTheme();

  const height = size === 'sm' ? 38 : size === 'lg' ? 56 : 48;
  const scheme = {
    primary: { bg: colors.accent, fg: colors.onAccent, border: 'transparent' },
    secondary: { bg: colors.surfaceAlt, fg: colors.text, border: colors.border },
    ghost: { bg: 'transparent', fg: colors.textSecondary, border: 'transparent' },
    danger: { bg: colors.expiredSoft, fg: colors.expired, border: 'transparent' },
  }[variant];

  return (
    <Touchable
      onPress={onPress}
      disabled={disabled || loading}
      haptic={variant === 'primary' ? 'press' : 'tap'}
      scaleTo={0.96}
      style={fullWidth ? { alignSelf: 'stretch' } : undefined}>
      <View
        style={[
          {
            height,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.sm,
            paddingHorizontal: size === 'lg' ? spacing.xl : spacing.lg,
            borderRadius: radius.md + 2,
            backgroundColor: scheme.bg,
            borderWidth: scheme.border === 'transparent' ? 0 : 1,
            borderColor: scheme.border,
          },
          variant === 'primary' ? elevation(colors, 1) : null,
          style,
        ]}>
        {loading ? (
          <ActivityIndicator color={scheme.fg} size="small" />
        ) : (
          <>
            {icon ? <MaterialCommunityIcons name={icon} size={size === 'lg' ? 21 : 18} color={scheme.fg} /> : null}
            {/* Fixed-height button: without this the label can wrap and the
                second line is simply clipped away on Android. */}
            <Text
              variant={size === 'lg' ? 'body' : 'label'}
              numberOfLines={1}
              style={{ color: scheme.fg, fontWeight: '700' }}>
              {label}
            </Text>
          </>
        )}
      </View>
    </Touchable>
  );
}
