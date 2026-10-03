import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { findCategory } from '@/domain/categories';
import { daysUntil, freshnessOf, urgencyColor, urgencySoftColor } from '@/domain/freshness';
import { todayISO, type ItemStatus, type StorageLocation } from '@/domain/item';
import { LOCATIONS } from '@/domain/locations';
import { useAppStore } from '@/store/useAppStore';
import { Button } from '@/ui/components/Button';
import { Card } from '@/ui/components/Card';
import { Chip } from '@/ui/components/Chip';
import { DateField } from '@/ui/components/DateField';
import { FreshnessRing } from '@/ui/components/FreshnessRing';
import { Touchable } from '@/ui/components/Pressable';
import { EmptyState, Screen } from '@/ui/components/Screen';
import { Text } from '@/ui/components/Text';
import { TextField } from '@/ui/components/TextField';
import { radius, spacing } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';
import { addDays, formatDate } from '@/utils/dates';
import { haptics } from '@/utils/haptics';
import { goBack } from '@/utils/nav';

const STATUS_COPY: Record<ItemStatus, string> = {
  active: 'On the shelf',
  consumed: 'Used',
  wasted: 'Binned',
  archived: 'Archived',
};

export default function ItemDetailScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const item = useAppStore((s) => s.items.find((i) => i.id === id));
  const categories = useAppStore((s) => s.categories);
  const settings = useAppStore((s) => s.settings);
  const updateItem = useAppStore((s) => s.updateItem);
  const deleteItem = useAppStore((s) => s.deleteItem);
  const setItemStatus = useAppStore((s) => s.setItemStatus);
  const addShopping = useAppStore((s) => s.addShopping);
  const addItem = useAppStore((s) => s.addItem);

  const [draft, setDraft] = useState(() =>
    item
      ? {
          name: item.name,
          brand: item.brand ?? '',
          categoryId: item.categoryId,
          location: item.location,
          quantity: item.quantity,
          expiryDate: item.expiryDate,
          notes: item.notes ?? '',
          price: item.price != null ? String(item.price) : '',
        }
      : null
  );

  const category = useMemo(
    () => findCategory(categories, draft?.categoryId ?? item?.categoryId),
    [categories, draft?.categoryId, item?.categoryId]
  );

  if (!item || !draft) {
    return (
      <Screen>
        <EmptyState
          icon="help-circle-outline"
          title="Item not found"
          body="It may have been deleted."
          action={<Button label="Go back" onPress={() => goBack()} />}
        />
      </Screen>
    );
  }

  const freshness = freshnessOf(draft.expiryDate);
  const accent = urgencyColor(freshness.urgency, colors);

  const dirty =
    draft.name !== item.name ||
    draft.brand !== (item.brand ?? '') ||
    draft.categoryId !== item.categoryId ||
    draft.location !== item.location ||
    draft.quantity !== item.quantity ||
    draft.expiryDate !== item.expiryDate ||
    draft.notes !== (item.notes ?? '') ||
    draft.price !== (item.price != null ? String(item.price) : '');

  const save = async () => {
    const parsedPrice = Number.parseFloat(draft.price.replace(/[^0-9.]/g, ''));
    await updateItem(item.id, {
      name: draft.name.trim() || item.name,
      brand: draft.brand.trim() || null,
      categoryId: draft.categoryId,
      location: draft.location,
      quantity: draft.quantity,
      expiryDate: draft.expiryDate,
      notes: draft.notes.trim() || null,
      price: Number.isFinite(parsedPrice) ? parsedPrice : null,
    });
    haptics.success();
    goBack();
  };

  const confirmDelete = () => {
    Alert.alert('Delete this item?', 'It disappears from your stats too.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void deleteItem(item.id);
          goBack();
        },
      },
    ]);
  };

  /** Buying the same thing again should not mean retyping it. */
  const duplicate = async () => {
    // Reuse how long the original actually lasted rather than copying its date,
    // which would create a replacement that is already expired.
    const addedOn = item.addedDate ? todayISO(new Date(item.addedDate)) : todayISO();
    const originalShelfLife = Math.max(1, daysUntil(item.expiryDate, addedOn));

    await addItem({
      name: item.name,
      brand: item.brand,
      categoryId: item.categoryId,
      location: item.location,
      quantity: item.quantity,
      unit: item.unit,
      expiryDate: addDays(todayISO(), originalShelfLife),
      openedDate: null,
      barcode: item.barcode,
      imageUri: item.imageUri,
      notes: item.notes,
      price: item.price,
      source: item.source,
      scanConfidence: null,
    });
    haptics.success();
    goBack();
  };

  const markAs = (status: ItemStatus) => {
    void setItemStatus(item.id, status);
    haptics.success();
    goBack();
  };

  return (
    <Screen>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
        }}>
        <Touchable onPress={() => goBack()} scaleTo={0.9}>
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.surfaceAlt,
            }}>
            <MaterialCommunityIcons name="chevron-left" size={24} color={colors.textSecondary} />
          </View>
        </Touchable>
        <Touchable onPress={confirmDelete} scaleTo={0.9} haptic="press">
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.surfaceAlt,
            }}>
            <MaterialCommunityIcons name="trash-can-outline" size={19} color={colors.expired} />
          </View>
        </Touchable>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingBottom: 140 + insets.bottom,
            gap: spacing.xl,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeInDown.duration(300).springify()}>
            <Card
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.lg,
                backgroundColor: urgencySoftColor(freshness.urgency, colors),
              }}
              level={0}>
              {item.imageUri ? (
                <Image
                  source={{ uri: item.imageUri }}
                  style={{ width: 66, height: 66, borderRadius: radius.md }}
                  contentFit="cover"
                />
              ) : (
                <FreshnessRing
                  daysLeft={freshness.daysLeft}
                  urgency={freshness.urgency}
                  icon={category.icon}
                  size={66}
                  strokeWidth={5}
                />
              )}
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="heading" numberOfLines={2}>
                  {draft.name}
                </Text>
                <Text variant="caption" style={{ color: accent }}>
                  {freshness.long}
                </Text>
                <Text variant="caption" tone="secondary">
                  {formatDate(draft.expiryDate, settings.dateFormat)}
                  {item.status !== 'active' ? ` · ${STATUS_COPY[item.status]}` : ''}
                </Text>
              </View>
            </Card>
          </Animated.View>

          {item.status === 'active' ? (
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Button label="Used it" icon="check-circle-outline" fullWidth onPress={() => markAs('consumed')} />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  label="Binned it"
                  icon="delete-outline"
                  variant="danger"
                  fullWidth
                  onPress={() => markAs('wasted')}
                />
              </View>
            </View>
          ) : (
            <Button
              label="Put it back on the shelf"
              icon="undo-variant"
              variant="secondary"
              fullWidth
              onPress={() => markAs('active')}
            />
          )}

          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Button
                label="Add to list"
                icon="cart-plus"
                variant="secondary"
                fullWidth
                onPress={() => {
                  void addShopping(item.name, item.categoryId, item.id);
                  haptics.success();
                }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label="Duplicate"
                icon="content-duplicate"
                variant="secondary"
                fullWidth
                onPress={() => void duplicate()}
              />
            </View>
          </View>

          <View style={{ gap: spacing.lg }}>
            <TextField
              label="What is it"
              value={draft.name}
              onChangeText={(name) => setDraft({ ...draft, name })}
            />
            <TextField
              label="Brand"
              value={draft.brand}
              onChangeText={(brand) => setDraft({ ...draft, brand })}
              placeholder="Optional"
            />
          </View>

          <View style={{ gap: spacing.sm }}>
            <Text variant="micro" tone="muted" uppercase>
              Expires
            </Text>
            <DateField
              value={draft.expiryDate}
              onChange={(expiryDate) => setDraft({ ...draft, expiryDate })}
              dateFormat={settings.dateFormat}
            />
          </View>

          <View style={{ gap: spacing.sm }}>
            <Text variant="micro" tone="muted" uppercase>
              Category
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {categories.map((c) => (
                <Chip
                  key={c.id}
                  label={c.name}
                  icon={c.icon}
                  color={c.color}
                  size="sm"
                  selected={draft.categoryId === c.id}
                  onPress={() => setDraft({ ...draft, categoryId: c.id })}
                />
              ))}
            </View>
          </View>

          <View style={{ gap: spacing.sm }}>
            <Text variant="micro" tone="muted" uppercase>
              Where it lives
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {LOCATIONS.map((l) => (
                <Chip
                  key={l.id}
                  label={l.name}
                  icon={l.icon}
                  size="sm"
                  selected={draft.location === l.id}
                  onPress={() => setDraft({ ...draft, location: l.id as StorageLocation })}
                />
              ))}
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: spacing.lg }}>
            <View style={{ gap: spacing.sm }}>
              <Text variant="micro" tone="muted" uppercase>
                Quantity
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surfaceAlt,
                  height: 48,
                }}>
                <Touchable
                  onPress={() => setDraft({ ...draft, quantity: Math.max(1, draft.quantity - 1) })}
                  scaleTo={0.88}
                  haptic="select"
                  style={{ paddingHorizontal: spacing.md }}>
                  <MaterialCommunityIcons name="minus" size={18} color={colors.textSecondary} />
                </Touchable>
                <Text variant="body" style={{ minWidth: 28, textAlign: 'center' }}>
                  {draft.quantity}
                </Text>
                <Touchable
                  onPress={() => setDraft({ ...draft, quantity: draft.quantity + 1 })}
                  scaleTo={0.88}
                  haptic="select"
                  style={{ paddingHorizontal: spacing.md }}>
                  <MaterialCommunityIcons name="plus" size={18} color={colors.textSecondary} />
                </Touchable>
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <TextField
                label="Price"
                value={draft.price}
                onChangeText={(price) => setDraft({ ...draft, price })}
                placeholder="0"
                keyboardType="decimal-pad"
                prefix={settings.currency}
              />
            </View>
          </View>

          <TextField
            label="Notes"
            value={draft.notes}
            onChangeText={(notes) => setDraft({ ...draft, notes })}
            placeholder="Optional"
            multiline
          />

          {item.barcode ? (
            <Text variant="caption" tone="muted">
              Barcode {item.barcode}
            </Text>
          ) : null}
        </ScrollView>

        {dirty ? (
          <Animated.View
            entering={FadeInDown.duration(200)}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              paddingHorizontal: spacing.lg,
              paddingTop: spacing.md,
              paddingBottom: insets.bottom + spacing.md,
              backgroundColor: colors.bg,
              borderTopWidth: 1,
              borderTopColor: colors.border,
            }}>
            <Button label="Save changes" icon="check" size="lg" fullWidth onPress={() => void save()} />
          </Animated.View>
        ) : null}
      </KeyboardAvoidingView>
    </Screen>
  );
}
