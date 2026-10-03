import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { findCategory } from '@/domain/categories';
import { todayISO, type ItemSource, type StorageLocation } from '@/domain/item';
import { LOCATIONS, suggestLocation } from '@/domain/locations';
import { useAppStore } from '@/store/useAppStore';
import { Button } from '@/ui/components/Button';
import { Chip } from '@/ui/components/Chip';
import { DateField } from '@/ui/components/DateField';
import { Touchable } from '@/ui/components/Pressable';
import { Screen } from '@/ui/components/Screen';
import { Text } from '@/ui/components/Text';
import { TextField } from '@/ui/components/TextField';
import { radius, spacing } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';
import { addDays } from '@/utils/dates';
import { haptics } from '@/utils/haptics';
import { goBack } from '@/utils/nav';

/** Everything a scan flow can hand to this screen. All optional. */
export interface AddParams {
  name?: string;
  brand?: string;
  categoryId?: string;
  expiryDate?: string;
  barcode?: string;
  imageUri?: string;
  source?: ItemSource;
  confidence?: string;
  /** Free-text explanation of where the prefill came from. */
  hint?: string;
}

export default function AddScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams() as AddParams;

  const categories = useAppStore((s) => s.categories);
  const settings = useAppStore((s) => s.settings);
  const addItem = useAppStore((s) => s.addItem);

  const [name, setName] = useState(params.name ?? '');
  const [brand, setBrand] = useState(params.brand ?? '');
  const [categoryId, setCategoryId] = useState(params.categoryId ?? 'other');
  const [locationTouched, setLocationTouched] = useState(false);
  const [location, setLocation] = useState<StorageLocation>(suggestLocation(params.categoryId ?? 'other'));
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const category = useMemo(() => findCategory(categories, categoryId), [categories, categoryId]);
  const [expiryDate, setExpiryDate] = useState(
    params.expiryDate ?? addDays(todayISO(), category.defaultShelfLifeDays)
  );

  const canSave = name.trim().length > 0 && !saving;

  const pickCategory = (id: string) => {
    setCategoryId(id);
    // Only steer the location while the user has not made their own choice.
    if (!locationTouched) setLocation(suggestLocation(id));
  };

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const parsedPrice = Number.parseFloat(price.replace(/[^0-9.]/g, ''));
      await addItem({
        name,
        brand: brand || null,
        categoryId,
        location,
        quantity,
        unit: null,
        expiryDate,
        openedDate: null,
        barcode: params.barcode ?? null,
        imageUri: params.imageUri ?? null,
        notes: notes || null,
        price: Number.isFinite(parsedPrice) ? parsedPrice : null,
        source: (params.source as ItemSource) ?? 'manual',
        scanConfidence: params.confidence ? Number(params.confidence) : null,
      });
      haptics.success();
      goBack();
    } finally {
      setSaving(false);
    }
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
            <MaterialCommunityIcons name="close" size={20} color={colors.textSecondary} />
          </View>
        </Touchable>
        <Text variant="heading">Add item</Text>
        <View style={{ width: 38 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={12}>
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingBottom: 120 + insets.bottom,
            gap: spacing.xl,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {params.imageUri ? (
            <Image
              source={{ uri: params.imageUri }}
              style={{ height: 150, borderRadius: radius.lg, backgroundColor: colors.surfaceAlt }}
              contentFit="cover"
              transition={200}
            />
          ) : null}

          <View style={{ gap: spacing.lg }}>
            <TextField
              label="What is it"
              value={name}
              onChangeText={setName}
              placeholder="Greek yoghurt"
              autoFocus={!params.name}
            />
            <TextField label="Brand (optional)" value={brand} onChangeText={setBrand} placeholder="Amul" />
          </View>

          <View style={{ gap: spacing.sm }}>
            <Text variant="micro" tone="muted" uppercase>
              Expires
            </Text>
            <DateField
              value={expiryDate}
              onChange={setExpiryDate}
              dateFormat={settings.dateFormat}
              hint={params.hint}
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
                  selected={categoryId === c.id}
                  onPress={() => pickCategory(c.id)}
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
                  selected={location === l.id}
                  onPress={() => {
                    setLocation(l.id);
                    setLocationTouched(true);
                  }}
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
                  onPress={() => setQuantity((q) => Math.max(1, q - 1))}
                  scaleTo={0.88}
                  haptic="select"
                  style={{ paddingHorizontal: spacing.md }}>
                  <MaterialCommunityIcons name="minus" size={18} color={colors.textSecondary} />
                </Touchable>
                <Text variant="body" style={{ minWidth: 28, textAlign: 'center' }}>
                  {quantity}
                </Text>
                <Touchable
                  onPress={() => setQuantity((q) => q + 1)}
                  scaleTo={0.88}
                  haptic="select"
                  style={{ paddingHorizontal: spacing.md }}>
                  <MaterialCommunityIcons name="plus" size={18} color={colors.textSecondary} />
                </Touchable>
              </View>
            </View>

            <View style={{ flex: 1 }}>
              <TextField
                label={`Price (optional)`}
                value={price}
                onChangeText={setPrice}
                placeholder="0"
                keyboardType="decimal-pad"
                prefix={settings.currency}
              />
            </View>
          </View>

          <TextField
            label="Notes (optional)"
            value={notes}
            onChangeText={setNotes}
            placeholder="Half used, back of the top shelf"
            multiline
          />
        </ScrollView>

        <View
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
          <Button
            label={saving ? 'Saving' : 'Add to shelf'}
            icon="check"
            size="lg"
            fullWidth
            loading={saving}
            disabled={!canSave}
            onPress={() => void save()}
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
