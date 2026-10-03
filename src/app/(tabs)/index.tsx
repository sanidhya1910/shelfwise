import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Platform, ScrollView, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { freshnessOf, urgencyColor, urgencySoftColor } from '@/domain/freshness';
import { selectActiveSorted, selectUrgencyCounts, useAppStore } from '@/store/useAppStore';
import { Button } from '@/ui/components/Button';
import { Card } from '@/ui/components/Card';
import { ItemCard } from '@/ui/components/ItemCard';
import { Touchable } from '@/ui/components/Pressable';
import { EmptyState, Screen } from '@/ui/components/Screen';
import { Text } from '@/ui/components/Text';
import { radius, spacing, tabBarClearance, type Urgency } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function UrgencyTile({
  urgency,
  count,
  label,
}: {
  urgency: Urgency;
  count: number;
  label: string;
}) {
  const { colors } = useTheme();
  const accent = urgencyColor(urgency, colors);
  return (
    <Touchable
      style={{ flex: 1 }}
      onPress={() => router.push({ pathname: '/inventory', params: { urgency } })}>
      <Card
        style={{
          padding: spacing.md,
          gap: 2,
          backgroundColor: urgencySoftColor(urgency, colors),
        }}
        level={0}>
        <Text variant="title" style={{ color: accent }}>
          {count}
        </Text>
        <Text variant="caption" style={{ color: accent, opacity: 0.85 }}>
          {label}
        </Text>
      </Card>
    </Touchable>
  );
}

export default function HomeScreen() {
  const { colors } = useTheme();
  const items = useAppStore((s) => s.items);
  const categories = useAppStore((s) => s.categories);

  const active = useMemo(() => selectActiveSorted(items), [items]);
  const counts = useMemo(() => selectUrgencyCounts(items), [items]);

  // "Use soon" is anything already urgent, capped so the rail stays scannable.
  const useSoon = useMemo(
    () => active.filter((i) => freshnessOf(i.expiryDate).daysLeft <= 7).slice(0, 12),
    [active]
  );

  const categoryCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of active) map.set(item.categoryId, (map.get(item.categoryId) ?? 0) + 1);
    return categories
      .map((c) => ({ category: c, count: map.get(c.id) ?? 0 }))
      .filter((entry) => entry.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [active, categories]);

  const headerRight = (
    <Touchable onPress={() => router.push('/settings')} scaleTo={0.9}>
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.surfaceAlt,
        }}>
        <MaterialCommunityIcons name="cog-outline" size={20} color={colors.textSecondary} />
      </View>
    </Touchable>
  );

  return (
    <Screen
      title={greeting()}
      subtitle={
        active.length === 0
          ? 'Nothing tracked yet'
          : `${active.length} item${active.length === 1 ? '' : 's'} on the shelf`
      }
      right={headerRight}>
      {active.length === 0 ? (
        <EmptyState
          icon="fridge-outline"
          title="Your shelf is empty"
          body={
            Platform.OS === 'web'
              ? 'This browser view reads a backup exported from the Shelfwise app. Open one to see your shelf.'
              : 'Point the camera at a printed expiry date and Shelfwise will read it for you.'
          }
          action={
            <Button
              label={Platform.OS === 'web' ? 'Open a backup' : 'Scan something'}
              icon={Platform.OS === 'web' ? 'upload-outline' : 'line-scan'}
              onPress={() => router.push('/scan')}
            />
          }
        />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: tabBarClearance, gap: spacing.xl }}
          showsVerticalScrollIndicator={false}>
          <Animated.View
            entering={FadeInDown.duration(340).springify()}
            style={{ flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg }}>
            <UrgencyTile urgency="expired" count={counts.expired} label="Expired" />
            <UrgencyTile urgency="today" count={counts.dueToday} label="Today" />
            <UrgencyTile urgency="week" count={counts.thisWeek} label="This week" />
          </Animated.View>

          {useSoon.length > 0 ? (
            <Animated.View entering={FadeInDown.delay(60).duration(340).springify()} style={{ gap: spacing.md }}>
              <View
                style={{
                  paddingHorizontal: spacing.lg,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                <Text variant="heading">Use soon</Text>
                <Touchable
                  onPress={() => router.push({ pathname: '/inventory', params: { urgency: 'week' } })}
                  scaleTo={0.94}>
                  <Text variant="label" tone="accent">
                    See all
                  </Text>
                </Touchable>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
                {useSoon.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    categories={categories}
                    compact
                    onPress={() => router.push(`/item/${item.id}`)}
                  />
                ))}
              </ScrollView>
            </Animated.View>
          ) : (
            <Animated.View entering={FadeInDown.delay(60).duration(340)} style={{ paddingHorizontal: spacing.lg }}>
              <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }} flat>
                <MaterialCommunityIcons name="check-decagram" size={24} color={colors.fresh} />
                <Text variant="body" tone="secondary" style={{ flex: 1 }}>
                  Nothing needs using this week. Everything is comfortably fresh.
                </Text>
              </Card>
            </Animated.View>
          )}

          {categoryCounts.length > 0 ? (
            <Animated.View entering={FadeInDown.delay(120).duration(340).springify()} style={{ gap: spacing.md }}>
              <Text variant="heading" style={{ paddingHorizontal: spacing.lg }}>
                Categories
              </Text>
              <View
                style={{
                  paddingHorizontal: spacing.lg,
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: spacing.sm,
                }}>
                {categoryCounts.map(({ category, count }) => (
                  <Touchable
                    key={category.id}
                    // Two columns for small sets, three otherwise, and tiles grow
                    // to fill their row, so the grid never ends on a stranded tile.
                    style={{ flexBasis: categoryCounts.length <= 4 ? '47%' : '30%', flexGrow: 1 }}
                    onPress={() =>
                      router.push({ pathname: '/inventory', params: { category: category.id } })
                    }>
                    <Card style={{ padding: spacing.md, gap: spacing.sm, alignItems: 'flex-start' }} flat>
                      <View
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: radius.sm + 2,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: `${category.color}22`,
                        }}>
                        <MaterialCommunityIcons name={category.icon} size={19} color={category.color} />
                      </View>
                      <View>
                        <Text variant="caption" numberOfLines={1}>
                          {category.name}
                        </Text>
                        <Text variant="caption" tone="muted">
                          {count}
                        </Text>
                      </View>
                    </Card>
                  </Touchable>
                ))}
              </View>
            </Animated.View>
          ) : null}
        </ScrollView>
      )}
    </Screen>
  );
}
