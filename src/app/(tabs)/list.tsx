import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useMemo, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import { findCategory } from '@/domain/categories';
import type { ShoppingListEntry } from '@/domain/item';
import { useAppStore } from '@/store/useAppStore';
import { Card } from '@/ui/components/Card';
import { Touchable } from '@/ui/components/Pressable';
import { EmptyState, Screen } from '@/ui/components/Screen';
import { Text } from '@/ui/components/Text';
import { radius, spacing, tabBarClearance } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';
import { haptics } from '@/utils/haptics';

function Row({ entry, onToggle, onDelete }: { entry: ShoppingListEntry; onToggle: () => void; onDelete: () => void }) {
  const { colors } = useTheme();
  const categories = useAppStore((s) => s.categories);
  const category = entry.categoryId ? findCategory(categories, entry.categoryId) : null;

  return (
    <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(140)} layout={LinearTransition.springify()}>
      <Card style={{ padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md }} flat>
        <Touchable onPress={onToggle} scaleTo={0.86} haptic="select">
          <View
            style={{
              width: 26,
              height: 26,
              borderRadius: 13,
              borderWidth: 2,
              borderColor: entry.checked ? colors.accent : colors.borderStrong,
              backgroundColor: entry.checked ? colors.accent : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            {entry.checked ? <MaterialCommunityIcons name="check" size={16} color={colors.onAccent} /> : null}
          </View>
        </Touchable>

        <View style={{ flex: 1 }}>
          <Text
            variant="body"
            tone={entry.checked ? 'muted' : 'default'}
            style={entry.checked ? { textDecorationLine: 'line-through' } : undefined}
            numberOfLines={1}>
            {entry.name}
          </Text>
          {category ? (
            <Text variant="caption" tone="muted">
              {category.name}
            </Text>
          ) : null}
        </View>

        <Touchable onPress={onDelete} scaleTo={0.85} haptic="tap">
          <MaterialCommunityIcons name="close" size={18} color={colors.textMuted} />
        </Touchable>
      </Card>
    </Animated.View>
  );
}

export default function ShoppingListScreen() {
  const { colors } = useTheme();
  const shopping = useAppStore((s) => s.shopping);
  const items = useAppStore((s) => s.items);
  const addShopping = useAppStore((s) => s.addShopping);
  const toggleShopping = useAppStore((s) => s.toggleShopping);
  const deleteShopping = useAppStore((s) => s.deleteShopping);
  const clearChecked = useAppStore((s) => s.clearCheckedShopping);

  const [draft, setDraft] = useState('');

  const { pending, done } = useMemo(
    () => ({
      pending: shopping.filter((e) => !e.checked),
      done: shopping.filter((e) => e.checked),
    }),
    [shopping]
  );

  /** Things you have run out of before are the likeliest things to buy again. */
  const suggestions = useMemo(() => {
    const counts = new Map<string, { name: string; categoryId: string; n: number }>();
    for (const item of items) {
      if (item.status !== 'consumed' && item.status !== 'wasted') continue;
      const key = item.name.toLowerCase();
      const existing = counts.get(key);
      counts.set(key, {
        name: item.name,
        categoryId: item.categoryId,
        n: (existing?.n ?? 0) + 1,
      });
    }
    const onList = new Set(shopping.map((e) => e.name.toLowerCase()));
    const stocked = new Set(items.filter((i) => i.status === 'active').map((i) => i.name.toLowerCase()));
    return [...counts.values()]
      .filter((s) => !onList.has(s.name.toLowerCase()) && !stocked.has(s.name.toLowerCase()))
      .sort((a, b) => b.n - a.n)
      .slice(0, 6);
  }, [items, shopping]);

  const submit = () => {
    if (!draft.trim()) return;
    void addShopping(draft);
    setDraft('');
    haptics.success();
  };

  return (
    <Screen
      title="Shopping list"
      subtitle={pending.length === 0 ? 'Nothing to buy' : `${pending.length} to buy`}
      right={
        done.length > 0 ? (
          <Touchable onPress={() => void clearChecked()} scaleTo={0.94}>
            <Text variant="label" tone="accent">
              Clear done
            </Text>
          </Touchable>
        ) : undefined
      }>
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            height: 46,
            paddingLeft: spacing.md,
            paddingRight: spacing.xs,
            borderRadius: radius.md,
            backgroundColor: colors.surfaceAlt,
            borderWidth: 1,
            borderColor: colors.border,
          }}>
          <MaterialCommunityIcons name="plus" size={19} color={colors.textMuted} />
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={submit}
            placeholder="Add something to buy"
            placeholderTextColor={colors.textMuted}
            style={{ flex: 1, color: colors.text, fontSize: 15, fontWeight: '500' }}
            returnKeyType="done"
          />
          {draft.trim() ? (
            <Touchable onPress={submit} scaleTo={0.9} haptic="press">
              <View
                style={{
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  borderRadius: radius.sm,
                  backgroundColor: colors.accent,
                }}>
                <Text variant="caption" style={{ color: colors.onAccent }}>
                  Add
                </Text>
              </View>
            </Touchable>
          ) : null}
        </View>
      </View>

      {shopping.length === 0 && suggestions.length === 0 ? (
        <EmptyState
          icon="cart-outline"
          title="Nothing on the list"
          body="Add something above, or mark an item as used and Shelfwise will suggest a restock."
        />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: tabBarClearance, gap: spacing.sm }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          {pending.map((entry) => (
            <Row
              key={entry.id}
              entry={entry}
              onToggle={() => void toggleShopping(entry.id)}
              onDelete={() => void deleteShopping(entry.id)}
            />
          ))}

          {suggestions.length > 0 ? (
            <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
              <Text variant="micro" tone="muted" uppercase>
                Buy again
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {suggestions.map((s) => (
                  <Touchable
                    key={s.name}
                    onPress={() => void addShopping(s.name, s.categoryId)}
                    scaleTo={0.94}
                    haptic="select">
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: spacing.xs,
                        paddingHorizontal: spacing.md,
                        paddingVertical: spacing.sm,
                        borderRadius: radius.pill,
                        borderWidth: 1,
                        borderStyle: 'dashed',
                        borderColor: colors.borderStrong,
                      }}>
                      <MaterialCommunityIcons name="plus" size={14} color={colors.textSecondary} />
                      <Text variant="caption" tone="secondary">
                        {s.name}
                      </Text>
                    </View>
                  </Touchable>
                ))}
              </View>
            </View>
          ) : null}

          {done.length > 0 ? (
            <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
              <Text variant="micro" tone="muted" uppercase>
                In the basket
              </Text>
              {done.map((entry) => (
                <Row
                  key={entry.id}
                  entry={entry}
                  onToggle={() => void toggleShopping(entry.id)}
                  onDelete={() => void deleteShopping(entry.id)}
                />
              ))}
            </View>
          ) : null}
        </ScrollView>
      )}
    </Screen>
  );
}
