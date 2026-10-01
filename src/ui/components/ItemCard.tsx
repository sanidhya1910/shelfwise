import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import { useMemo } from 'react';
import { View } from 'react-native';

import { findCategory, type Category } from '@/domain/categories';
import { freshnessOf, urgencyColor, urgencySoftColor } from '@/domain/freshness';
import type { Item } from '@/domain/item';
import { locationMeta } from '@/domain/locations';
import { radius, spacing } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

import { Card } from './Card';
import { FreshnessRing } from './FreshnessRing';
import { Touchable } from './Pressable';
import { Text } from './Text';

export interface ItemCardProps {
  item: Item;
  categories: Category[];
  onPress?: () => void;
  onLongPress?: () => void;
  /** Compact cards are used in the dashboard carousel. */
  compact?: boolean;
  /** Null when the list is not in selection mode, so the check is hidden. */
  selected?: boolean | null;
}

export function ItemCard({
  item,
  categories,
  onPress,
  onLongPress,
  compact,
  selected = null,
}: ItemCardProps) {
  const { colors } = useTheme();
  const category = useMemo(() => findCategory(categories, item.categoryId), [categories, item.categoryId]);
  const freshness = useMemo(() => freshnessOf(item.expiryDate), [item.expiryDate]);
  const accent = urgencyColor(freshness.urgency, colors);
  const soft = urgencySoftColor(freshness.urgency, colors);
  const location = locationMeta(item.location);

  if (compact) {
    return (
      <Touchable onPress={onPress} scaleTo={0.95}>
        <Card style={{ width: 152, padding: spacing.md, gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <FreshnessRing
              daysLeft={freshness.daysLeft}
              urgency={freshness.urgency}
              icon={category.icon}
              size={40}
              strokeWidth={3}
            />
            <View
              style={{
                paddingHorizontal: spacing.sm,
                paddingVertical: 3,
                borderRadius: radius.pill,
                backgroundColor: soft,
              }}>
              <Text variant="micro" style={{ color: accent }}>
                {freshness.short}
              </Text>
            </View>
          </View>
          <View>
            <Text variant="label" numberOfLines={1}>
              {item.name}
            </Text>
            <Text variant="caption" tone="muted" numberOfLines={1}>
              {item.brand ?? category.name}
            </Text>
          </View>
        </Card>
      </Touchable>
    );
  }

  return (
    <Touchable onPress={onPress} onLongPress={onLongPress} delayLongPress={280} scaleTo={0.985}>
      <Card
        style={{
          padding: spacing.md,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          borderWidth: selected ? 2 : 0,
          borderColor: selected ? colors.accent : 'transparent',
        }}>
        {selected !== null ? (
          <MaterialCommunityIcons
            name={selected ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
            size={22}
            color={selected ? colors.accent : colors.textMuted}
          />
        ) : null}
        {item.imageUri ? (
          <Image
            source={{ uri: item.imageUri }}
            style={{ width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.surfaceAlt }}
            contentFit="cover"
            transition={180}
          />
        ) : (
          <FreshnessRing
            daysLeft={freshness.daysLeft}
            urgency={freshness.urgency}
            icon={category.icon}
            size={52}
          />
        )}

        <View style={{ flex: 1, gap: 3 }}>
          <Text variant="body" numberOfLines={1} style={{ fontWeight: '700' }}>
            {item.name}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Text variant="caption" tone="secondary" numberOfLines={1} style={{ flexShrink: 1 }}>
              {item.brand ? `${item.brand} · ` : ''}
              {category.name}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <MaterialCommunityIcons name={location.icon} size={12} color={colors.textMuted} />
              <Text variant="caption" tone="muted">
                {location.name}
              </Text>
            </View>
            {item.quantity !== 1 ? (
              <Text variant="caption" tone="muted">
                ×{item.quantity}
              </Text>
            ) : null}
          </View>
        </View>

        <View
          style={{
            paddingHorizontal: spacing.md - 2,
            paddingVertical: spacing.xs + 1,
            borderRadius: radius.pill,
            backgroundColor: soft,
            minWidth: 58,
            alignItems: 'center',
          }}>
          <Text variant="caption" style={{ color: accent, fontWeight: '700' }}>
            {freshness.short}
          </Text>
        </View>
      </Card>
    </Touchable>
  );
}
