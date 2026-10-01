import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { View, type ViewStyle } from 'react-native';

import type { IconName } from '@/domain/categories';
import { radius, spacing } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

import { Touchable } from './Pressable';
import { Text } from './Text';

export interface ChipProps {
  label: string;
  icon?: IconName;
  selected?: boolean;
  onPress?: () => void;
  /** Overrides the accent for category chips that carry their own colour. */
  color?: string;
  size?: 'sm' | 'md';
  count?: number;
  style?: ViewStyle;
}

export function Chip({
  label,
  icon,
  selected,
  onPress,
  color,
  size = 'md',
  count,
  style,
}: ChipProps) {
  const { colors } = useTheme();
  const tint = color ?? colors.accent;
  const height = size === 'sm' ? 30 : 38;
  const fg = selected ? colors.surface : colors.text;

  const body = (
    <View
      style={[
        {
          height,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs + 2,
          paddingHorizontal: size === 'sm' ? spacing.md - 2 : spacing.lg - 2,
          borderRadius: radius.pill,
          backgroundColor: selected ? tint : colors.surfaceAlt,
          borderWidth: 1,
          borderColor: selected ? tint : colors.border,
        },
        style,
      ]}>
      {icon ? (
        <MaterialCommunityIcons
          name={icon}
          size={size === 'sm' ? 14 : 16}
          color={selected ? colors.surface : tint}
        />
      ) : null}
      <Text variant={size === 'sm' ? 'caption' : 'label'} numberOfLines={1} style={{ color: fg }}>
        {label}
      </Text>
      {count !== undefined ? (
        <Text
          variant="caption"
          style={{ color: selected ? colors.surface : colors.textMuted, opacity: 0.9 }}>
          {count}
        </Text>
      ) : null}
    </View>
  );

  if (!onPress) return body;
  return (
    <Touchable onPress={onPress} haptic="select" scaleTo={0.94}>
      {body}
    </Touchable>
  );
}
