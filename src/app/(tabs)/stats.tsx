import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { computeStats, formatMoney } from '@/domain/stats';
import { useAppStore } from '@/store/useAppStore';
import { Card } from '@/ui/components/Card';
import { EmptyState, Screen } from '@/ui/components/Screen';
import { Text } from '@/ui/components/Text';
import { radius, spacing, tabBarClearance } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';
import { MONTHS_SHORT } from '@/utils/dates';

const CHART_HEIGHT = 132;

function StatTile({
  label,
  value,
  sub,
  color,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  color: string;
  icon: 'check-circle-outline' | 'delete-outline' | 'piggy-bank-outline' | 'alert-circle-outline';
}) {
  const { colors } = useTheme();
  return (
    <Card style={{ flex: 1, padding: spacing.md, gap: spacing.xs }} flat>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
        <MaterialCommunityIcons name={icon} size={14} color={color} />
        <Text variant="micro" tone="muted" uppercase>
          {label}
        </Text>
      </View>
      <Text variant="title" style={{ color }}>
        {value}
      </Text>
      {sub ? (
        <Text variant="caption" tone="muted" numberOfLines={1}>
          {sub}
        </Text>
      ) : null}
      <View style={{ height: 0, backgroundColor: colors.border }} />
    </Card>
  );
}

export default function StatsScreen() {
  const { colors } = useTheme();
  const items = useAppStore((s) => s.items);
  const categories = useAppStore((s) => s.categories);
  const currency = useAppStore((s) => s.settings.currency);

  const stats = useMemo(() => computeStats(items, categories), [items, categories]);

  const peak = useMemo(
    () => Math.max(1, ...stats.months.map((m) => m.consumed + m.wasted)),
    [stats.months]
  );

  const resolved = stats.allTime.consumed + stats.allTime.wasted;

  if (resolved === 0) {
    return (
      <Screen title="Stats">
        <EmptyState
          icon="chart-donut"
          title="Nothing to measure yet"
          body="Mark an item as used or binned and Shelfwise starts tracking what you save and what you waste."
        />
      </Screen>
    );
  }

  return (
    <Screen title="Stats" subtitle={`${resolved} items resolved`}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: tabBarClearance, gap: spacing.lg }}
        showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(320).springify()} style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <StatTile
              label="Used"
              value={String(stats.current.consumed)}
              sub="this month"
              color={colors.fresh}
              icon="check-circle-outline"
            />
            <StatTile
              label="Binned"
              value={String(stats.current.wasted)}
              sub="this month"
              color={colors.expired}
              icon="delete-outline"
            />
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <StatTile
              label="Wasted"
              value={formatMoney(stats.allTime.wastedValue, currency)}
              sub="all time, priced items"
              color={colors.today}
              icon="alert-circle-outline"
            />
            <StatTile
              label="Used up"
              value={formatMoney(stats.allTime.savedValue, currency)}
              sub="all time, priced items"
              color={colors.accent}
              icon="piggy-bank-outline"
            />
          </View>
        </Animated.View>

        {stats.wasteRate != null ? (
          <Animated.View entering={FadeInDown.delay(60).duration(320).springify()}>
            <Card style={{ gap: spacing.md }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <Text variant="heading">Waste rate</Text>
                <Text variant="heading" style={{ color: stats.wasteRate > 0.2 ? colors.today : colors.fresh }}>
                  {Math.round(stats.wasteRate * 100)}%
                </Text>
              </View>
              <View
                style={{
                  height: 10,
                  borderRadius: radius.pill,
                  backgroundColor: colors.freshSoft,
                  overflow: 'hidden',
                  flexDirection: 'row',
                }}>
                <View
                  style={{
                    width: `${Math.min(100, stats.wasteRate * 100)}%`,
                    backgroundColor: colors.expired,
                  }}
                />
              </View>
              <Text variant="caption" tone="secondary">
                {stats.wasteRate === 0
                  ? 'You have not binned a single thing. Remarkable.'
                  : `${stats.allTime.wasted} of ${resolved} items went in the bin.`}
              </Text>
            </Card>
          </Animated.View>
        ) : null}

        <Animated.View entering={FadeInDown.delay(120).duration(320).springify()}>
          <Card style={{ gap: spacing.lg }}>
            <Text variant="heading">Last 6 months</Text>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: CHART_HEIGHT, gap: spacing.sm }}>
              {stats.months.map((month) => {
                const total = month.consumed + month.wasted;
                // Leave room for the count above the bar and the month beneath it.
                const scale = (n: number) => (n / peak) * (CHART_HEIGHT - 52);
                return (
                  <View key={month.key} style={{ flex: 1, alignItems: 'center', gap: spacing.xs }}>
                    <Text variant="micro" tone="muted">
                      {total > 0 ? total : ''}
                    </Text>
                    <View style={{ flex: 1, justifyContent: 'flex-end', width: '100%' }}>
                      <View
                        style={{
                          height: Math.max(total > 0 ? 3 : 0, scale(month.wasted)),
                          backgroundColor: colors.expired,
                          borderTopLeftRadius: radius.sm,
                          borderTopRightRadius: radius.sm,
                        }}
                      />
                      <View
                        style={{
                          height: Math.max(month.consumed > 0 ? 3 : 0, scale(month.consumed)),
                          backgroundColor: colors.fresh,
                          borderBottomLeftRadius: radius.sm,
                          borderBottomRightRadius: radius.sm,
                        }}
                      />
                    </View>
                    <Text variant="micro" tone="muted">
                      {MONTHS_SHORT[month.monthIndex]}
                    </Text>
                  </View>
                );
              })}
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.lg }}>
              {[
                { label: 'Used', color: colors.fresh },
                { label: 'Binned', color: colors.expired },
              ].map((legend) => (
                <View key={legend.label} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                  <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: legend.color }} />
                  <Text variant="caption" tone="secondary">
                    {legend.label}
                  </Text>
                </View>
              ))}
            </View>
          </Card>
        </Animated.View>

        {stats.topWasted.length > 0 ? (
          <Animated.View entering={FadeInDown.delay(180).duration(320).springify()}>
            <Card style={{ gap: spacing.md }}>
              <Text variant="heading">Where waste comes from</Text>
              {stats.topWasted.map((entry) => {
                const share = entry.wasted / Math.max(1, stats.allTime.wasted);
                return (
                  <View key={entry.categoryId} style={{ gap: spacing.xs }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text variant="label">{entry.name}</Text>
                      <Text variant="label" tone="secondary">
                        {entry.wasted}
                        {entry.wastedValue > 0 ? ` · ${formatMoney(entry.wastedValue, currency)}` : ''}
                      </Text>
                    </View>
                    <View
                      style={{
                        height: 8,
                        borderRadius: radius.pill,
                        backgroundColor: colors.surfaceSunken,
                        overflow: 'hidden',
                      }}>
                      <View
                        style={{
                          width: `${Math.max(4, share * 100)}%`,
                          height: '100%',
                          backgroundColor: entry.color,
                          borderRadius: radius.pill,
                        }}
                      />
                    </View>
                  </View>
                );
              })}
            </Card>
          </Animated.View>
        ) : null}

        <Animated.View entering={FadeInDown.delay(240).duration(320).springify()}>
          <Card
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}
            flat>
            <MaterialCommunityIcons
              name={stats.streakDays >= 7 ? 'fire' : 'leaf'}
              size={26}
              color={stats.streakDays >= 7 ? colors.today : colors.fresh}
            />
            <View style={{ flex: 1 }}>
              <Text variant="label">
                {stats.allTime.wasted === 0
                  ? 'No waste yet'
                  : `${stats.streakDays} day${stats.streakDays === 1 ? '' : 's'} without binning anything`}
              </Text>
              {stats.atRisk > 0 ? (
                <Text variant="caption" style={{ color: colors.expired }}>
                  {stats.atRisk} item{stats.atRisk === 1 ? '' : 's'} already past the date
                </Text>
              ) : (
                <Text variant="caption" tone="secondary">
                  Nothing on the shelf is overdue.
                </Text>
              )}
            </View>
          </Card>
        </Animated.View>
      </ScrollView>
    </Screen>
  );
}
