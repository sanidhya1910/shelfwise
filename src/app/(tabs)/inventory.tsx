import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { FlashList } from '@shopify/flash-list';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import { freshnessOf, URGENCY_LABEL } from '@/domain/freshness';
import type { Item, StorageLocation } from '@/domain/item';
import { LOCATIONS } from '@/domain/locations';
import { selectActiveSorted, useAppStore } from '@/store/useAppStore';
import { Chip } from '@/ui/components/Chip';
import { ItemCard } from '@/ui/components/ItemCard';
import { Touchable } from '@/ui/components/Pressable';
import { EmptyState, Screen } from '@/ui/components/Screen';
import { SwipeableRow } from '@/ui/components/SwipeableRow';
import { Text } from '@/ui/components/Text';
import { radius, spacing, tabBarClearance, type Urgency } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';
import { haptics } from '@/utils/haptics';

type Row = { kind: 'header'; key: string; label: string; count: number } | { kind: 'item'; key: string; item: Item };

const SORTS = [
  { id: 'expiry', label: 'Expiring first', icon: 'sort-clock-ascending-outline' },
  { id: 'added', label: 'Recently added', icon: 'sort-calendar-descending' },
  { id: 'name', label: 'Name', icon: 'sort-alphabetical-ascending' },
] as const;
type SortId = (typeof SORTS)[number]['id'];

const URGENCY_ORDER: Urgency[] = ['expired', 'today', 'soon', 'week', 'fresh'];

/** Replaces the search and filter row while items are selected. */
function SelectionBar({
  count,
  onCancel,
  onConsumed,
  onWasted,
  onDelete,
}: {
  count: number;
  onCancel: () => void;
  onConsumed: () => void;
  onWasted: () => void;
  onDelete: () => void;
}) {
  const { colors } = useTheme();
  const actions = [
    { icon: 'check-circle-outline', label: 'Used', color: colors.fresh, onPress: onConsumed },
    { icon: 'delete-outline', label: 'Binned', color: colors.expired, onPress: onWasted },
    { icon: 'trash-can-outline', label: 'Delete', color: colors.textSecondary, onPress: onDelete },
  ] as const;

  return (
    <Animated.View
      entering={FadeIn.duration(160)}
      exiting={FadeOut.duration(140)}
      style={{
        marginHorizontal: spacing.lg,
        marginBottom: spacing.md,
        padding: spacing.sm,
        borderRadius: radius.lg,
        backgroundColor: colors.surfaceAlt,
        borderWidth: 1,
        borderColor: colors.border,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
      }}>
      <Touchable onPress={onCancel} scaleTo={0.88} style={{ paddingHorizontal: spacing.sm }}>
        <MaterialCommunityIcons name="close" size={20} color={colors.textSecondary} />
      </Touchable>
      <Text variant="label" style={{ flex: 1 }}>
        {count} selected
      </Text>
      {actions.map((action) => (
        <Touchable key={action.label} onPress={action.onPress} scaleTo={0.9} haptic="press">
          <View style={{ alignItems: 'center', paddingHorizontal: spacing.md, gap: 2 }}>
            <MaterialCommunityIcons name={action.icon} size={19} color={action.color} />
            <Text variant="micro" style={{ color: action.color }}>
              {action.label}
            </Text>
          </View>
        </Touchable>
      ))}
    </Animated.View>
  );
}

export default function InventoryScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ urgency?: string; category?: string }>();

  const items = useAppStore((s) => s.items);
  const categories = useAppStore((s) => s.categories);
  const setItemStatus = useAppStore((s) => s.setItemStatus);
  const deleteItem = useAppStore((s) => s.deleteItem);

  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(params.category ?? null);
  const [location, setLocation] = useState<StorageLocation | null>(null);
  const [sort, setSort] = useState<SortId>('expiry');
  // Null means the list is in its normal browsing mode.
  const [selection, setSelection] = useState<Set<string> | null>(null);

  // Only applied on arrival from the dashboard; clearing it is a filter chip away.
  const [urgencyFilter, setUrgencyFilter] = useState<Urgency | null>(
    URGENCY_ORDER.includes(params.urgency as Urgency) ? (params.urgency as Urgency) : null
  );

  const active = useMemo(() => selectActiveSorted(items), [items]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    let list = active.filter((item) => {
      if (categoryId && item.categoryId !== categoryId) return false;
      if (location && item.location !== location) return false;
      if (needle) {
        const hay = `${item.name} ${item.brand ?? ''} ${item.notes ?? ''}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (urgencyFilter) {
        const u = freshnessOf(item.expiryDate).urgency;
        // "This week" is a reasonable superset of everything more urgent.
        if (urgencyFilter === 'week') {
          if (u === 'fresh') return false;
        } else if (u !== urgencyFilter) return false;
      }
      return true;
    });

    if (sort === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === 'added') list = [...list].sort((a, b) => b.addedDate.localeCompare(a.addedDate));
    return list;
  }, [active, categoryId, location, query, sort, urgencyFilter]);

  // Grouping only makes sense while sorted by date; other sorts render flat.
  const rows = useMemo<Row[]>(() => {
    if (sort !== 'expiry') return filtered.map((item) => ({ kind: 'item', key: item.id, item }));
    const buckets = new Map<Urgency, Item[]>();
    for (const item of filtered) {
      const u = freshnessOf(item.expiryDate).urgency;
      const list = buckets.get(u) ?? [];
      list.push(item);
      buckets.set(u, list);
    }
    const out: Row[] = [];
    for (const u of URGENCY_ORDER) {
      const list = buckets.get(u);
      if (!list?.length) continue;
      out.push({ kind: 'header', key: `h_${u}`, label: URGENCY_LABEL[u], count: list.length });
      for (const item of list) out.push({ kind: 'item', key: item.id, item });
    }
    return out;
  }, [filtered, sort]);

  const selecting = selection !== null;

  const toggleSelected = (id: string) => {
    setSelection((current) => {
      const next = new Set(current ?? []);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      // Deselecting the last item drops back to browsing rather than leaving an
      // action bar with nothing to act on.
      return next.size === 0 ? null : next;
    });
  };

  const applyToSelection = async (action: 'consumed' | 'wasted' | 'delete') => {
    const ids = [...(selection ?? [])];
    setSelection(null);
    haptics.success();
    for (const id of ids) {
      if (action === 'delete') await deleteItem(id);
      else await setItemStatus(id, action);
    }
  };

  const activeSort = SORTS.find((s) => s.id === sort)!;
  const hasFilters = Boolean(categoryId || location || urgencyFilter || query);

  return (
    <Screen title="Items" subtitle={`${filtered.length} of ${active.length}`}>
      {selecting ? (
        <SelectionBar
          count={selection.size}
          onCancel={() => setSelection(null)}
          onConsumed={() => void applyToSelection('consumed')}
          onWasted={() => void applyToSelection('wasted')}
          onDelete={() => void applyToSelection('delete')}
        />
      ) : null}

      <View
        style={{
          paddingHorizontal: spacing.lg,
          gap: spacing.md,
          paddingBottom: spacing.md,
          display: selecting ? 'none' : 'flex',
        }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            height: 44,
            paddingHorizontal: spacing.md,
            borderRadius: radius.md,
            backgroundColor: colors.surfaceAlt,
            borderWidth: 1,
            borderColor: colors.border,
          }}>
          <MaterialCommunityIcons name="magnify" size={19} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search items"
            placeholderTextColor={colors.textMuted}
            style={{ flex: 1, color: colors.text, fontSize: 15, fontWeight: '500' }}
            returnKeyType="search"
          />
          {query ? (
            <Touchable onPress={() => setQuery('')} scaleTo={0.85} haptic="tap">
              <MaterialCommunityIcons name="close-circle" size={18} color={colors.textMuted} />
            </Touchable>
          ) : null}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.lg }}>
          <Chip
            label={activeSort.label}
            icon={activeSort.icon}
            size="sm"
            onPress={() => setSort(SORTS[(SORTS.findIndex((s) => s.id === sort) + 1) % SORTS.length].id)}
          />
          {hasFilters ? (
            <Chip
              label="Clear"
              icon="filter-remove-outline"
              size="sm"
              onPress={() => {
                setCategoryId(null);
                setLocation(null);
                setUrgencyFilter(null);
                setQuery('');
              }}
            />
          ) : null}
          {LOCATIONS.map((l) => (
            <Chip
              key={l.id}
              label={l.name}
              icon={l.icon}
              size="sm"
              selected={location === l.id}
              onPress={() => setLocation(location === l.id ? null : l.id)}
            />
          ))}
          {categories.map((c) => (
            <Chip
              key={c.id}
              label={c.name}
              icon={c.icon}
              size="sm"
              color={c.color}
              selected={categoryId === c.id}
              onPress={() => setCategoryId(categoryId === c.id ? null : c.id)}
            />
          ))}
        </ScrollView>
      </View>

      {rows.length === 0 ? (
        <EmptyState
          icon={hasFilters ? 'filter-off-outline' : 'basket-outline'}
          title={hasFilters ? 'Nothing matches' : 'No items yet'}
          body={
            hasFilters
              ? 'Try clearing a filter or searching for something else.'
              : 'Scan a product or add one by hand to get started.'
          }
        />
      ) : (
        <FlashList
          data={rows}
          keyExtractor={(row) => row.key}
          extraData={colors}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: tabBarClearance }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item: row }) => {
            if (row.kind === 'header') {
              return (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.sm,
                    paddingTop: spacing.lg,
                    paddingBottom: spacing.sm,
                  }}>
                  <Text variant="micro" tone="muted" uppercase>
                    {row.label}
                  </Text>
                  <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
                  <Text variant="micro" tone="muted">
                    {row.count}
                  </Text>
                </View>
              );
            }
            return (
              <Animated.View layout={LinearTransition.springify()} style={{ marginBottom: spacing.sm }}>
                <SwipeableRow
                  enabled={!selecting}
                  right={{
                    icon: 'check-circle-outline',
                    label: 'Used it',
                    color: colors.fresh,
                    onTrigger: () => void setItemStatus(row.item.id, 'consumed'),
                  }}
                  left={{
                    icon: 'delete-outline',
                    label: 'Binned it',
                    color: colors.expired,
                    onTrigger: () => void setItemStatus(row.item.id, 'wasted'),
                  }}>
                  <ItemCard
                    item={row.item}
                    categories={categories}
                    selected={selecting ? selection.has(row.item.id) : null}
                    onPress={() =>
                      selecting ? toggleSelected(row.item.id) : router.push(`/item/${row.item.id}`)
                    }
                    onLongPress={() => {
                      haptics.thud();
                      toggleSelected(row.item.id);
                    }}
                  />
                </SwipeableRow>
              </Animated.View>
            );
          }}
        />
      )}
    </Screen>
  );
}
