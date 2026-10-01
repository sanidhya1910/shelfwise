import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ScrollView, View } from 'react-native';

import { freshnessOf, urgencyColor, urgencySoftColor } from '@/domain/freshness';
import { todayISO, type DateOnly } from '@/domain/item';
import type { DateFormat } from '@/domain/settings';
import { radius, spacing } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';
import { addDays, addMonths, formatDateLong } from '@/utils/dates';

import { Chip } from './Chip';
import { Touchable } from './Pressable';
import { Text } from './Text';

const PRESETS = [
  { label: '3 days', days: 3 },
  { label: '1 week', days: 7 },
  { label: '2 weeks', days: 14 },
  { label: '1 month', months: 1 },
  { label: '3 months', months: 3 },
  { label: '6 months', months: 6 },
  { label: '1 year', months: 12 },
] as const;

export interface DateFieldProps {
  value: DateOnly;
  onChange: (next: DateOnly) => void;
  dateFormat: DateFormat;
  /** Shown above the date, e.g. "Read from the label". */
  hint?: string;
}

function Stepper({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Touchable onPress={onPress} scaleTo={0.9} haptic="select">
      <View
        style={{
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderRadius: radius.sm,
          backgroundColor: colors.surfaceAlt,
          borderWidth: 1,
          borderColor: colors.border,
          minWidth: 52,
          alignItems: 'center',
        }}>
        <Text variant="caption" tone="secondary">
          {label}
        </Text>
      </View>
    </Touchable>
  );
}

/**
 * A date control tuned for expiry entry rather than general date picking:
 * durations from today are how people actually think about shelf life, so the
 * presets are relative and the fine adjustment is a nudge, not a calendar.
 */
export function DateField({ value, onChange, dateFormat, hint }: DateFieldProps) {
  const { colors } = useTheme();
  const freshness = freshnessOf(value);
  const accent = urgencyColor(freshness.urgency, colors);

  return (
    <View style={{ gap: spacing.md }}>
      <View
        style={{
          borderRadius: radius.lg,
          padding: spacing.lg,
          backgroundColor: urgencySoftColor(freshness.urgency, colors),
          gap: spacing.xs,
        }}>
        {hint ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <MaterialCommunityIcons name="auto-fix" size={13} color={accent} />
            <Text variant="micro" style={{ color: accent }} uppercase>
              {hint}
            </Text>
          </View>
        ) : null}
        <Text variant="title" style={{ color: accent }}>
          {formatDateLong(value, dateFormat)}
        </Text>
        <Text variant="caption" style={{ color: accent, opacity: 0.8 }}>
          {freshness.long}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' }}>
        <Stepper label="−1 mo" onPress={() => onChange(addMonths(value, -1))} />
        <Stepper label="−1 d" onPress={() => onChange(addDays(value, -1))} />
        <Stepper label="Today" onPress={() => onChange(todayISO())} />
        <Stepper label="+1 d" onPress={() => onChange(addDays(value, 1))} />
        <Stepper label="+1 mo" onPress={() => onChange(addMonths(value, 1))} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
        {PRESETS.map((preset) => (
          <Chip
            key={preset.label}
            label={preset.label}
            size="sm"
            onPress={() =>
              onChange(
                'days' in preset ? addDays(todayISO(), preset.days) : addMonths(todayISO(), preset.months)
              )
            }
          />
        ))}
      </ScrollView>
    </View>
  );
}
