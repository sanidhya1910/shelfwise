import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, Switch, View } from 'react-native';

import { scheduler } from '@/notifications/scheduler';
import { useAppStore } from '@/store/useAppStore';
import { Button } from '@/ui/components/Button';
import { Card } from '@/ui/components/Card';
import { Chip } from '@/ui/components/Chip';
import { Touchable } from '@/ui/components/Pressable';
import { Screen } from '@/ui/components/Screen';
import { Text } from '@/ui/components/Text';
import { spacing } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';
import { goBack } from '@/utils/nav';

const LEAD_OPTIONS = [14, 7, 3, 1, 0];
const HOURS = [7, 8, 9, 12, 18, 20];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="micro" tone="muted" uppercase style={{ paddingHorizontal: spacing.xs }}>
        {title}
      </Text>
      <Card style={{ gap: spacing.lg }}>{children}</Card>
    </View>
  );
}

function NavRow({
  icon,
  label,
  hint,
  onPress,
}: {
  icon: 'key-variant' | 'folder-download-outline';
  label: string;
  hint: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Touchable onPress={onPress} scaleTo={0.98}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <MaterialCommunityIcons name={icon} size={20} color={colors.textSecondary} />
        <View style={{ flex: 1 }}>
          <Text variant="label">{label}</Text>
          <Text variant="caption" tone="muted">
            {hint}
          </Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
      </View>
    </Touchable>
  );
}

function leadLabel(days: number): string {
  if (days === 0) return 'On the day';
  if (days === 1) return '1 day before';
  return `${days} days before`;
}

export default function SettingsScreen() {
  const { colors } = useTheme();
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const clearContent = useAppStore((s) => s.clearContent);
  const itemCount = useAppStore((s) => s.items.length);

  // Platforms without a scheduler can never be granted, so start there rather
  // than flipping the value inside an effect.
  const [permission, setPermission] = useState<boolean | null>(scheduler.supported ? null : false);

  useEffect(() => {
    if (!scheduler.supported) return;
    void scheduler.hasPermission().then(setPermission);
  }, []);

  const toggleLead = (days: number) => {
    const current = settings.reminderLeadDays;
    const next = current.includes(days)
      ? current.filter((d) => d !== days)
      : [...current, days].sort((a, b) => b - a);
    void updateSettings({ reminderLeadDays: next });
  };

  const requestPermission = async () => {
    const granted = await scheduler.requestPermission();
    setPermission(granted);
    if (!granted) {
      Alert.alert(
        'Notifications are off',
        'Shelfwise can still track everything, but it cannot nudge you. You can turn notifications on in your system settings.'
      );
      return;
    }
    // Permission arriving late means existing items were never scheduled.
    void updateSettings({ reminderLeadDays: settings.reminderLeadDays });
  };

  const confirmClear = () => {
    Alert.alert(
      'Delete everything?',
      `This removes all ${itemCount} items and your shopping list from this device. It cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete all', style: 'destructive', onPress: () => void clearContent() },
      ]
    );
  };

  return (
    <Screen
      title="Settings"
      right={
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
      }>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.xl }}
        showsVerticalScrollIndicator={false}>
        <Section title="Reminders">
          {!scheduler.supported ? (
            <Text variant="caption" tone="secondary">
              This build runs in a browser, which cannot wake itself to deliver a reminder. Reminders work
              on the phone app.
            </Text>
          ) : permission === false ? (
            <View style={{ gap: spacing.md }}>
              <Text variant="body" tone="secondary">
                Shelfwise needs permission to send you expiry reminders.
              </Text>
              <Button label="Turn on notifications" icon="bell-outline" onPress={() => void requestPermission()} />
            </View>
          ) : null}

          <View style={{ gap: spacing.sm }}>
            <Text variant="label">Nudge me</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {LEAD_OPTIONS.map((days) => (
                <Chip
                  key={days}
                  label={leadLabel(days)}
                  size="sm"
                  selected={settings.reminderLeadDays.includes(days)}
                  onPress={() => toggleLead(days)}
                />
              ))}
            </View>
            {settings.reminderLeadDays.length === 0 ? (
              <Text variant="caption" tone="muted">
                No reminders will be sent.
              </Text>
            ) : null}
          </View>

          <View style={{ gap: spacing.sm }}>
            <Text variant="label">At what time</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {HOURS.map((hour) => (
                <Chip
                  key={hour}
                  label={`${hour}:00`}
                  size="sm"
                  selected={settings.notificationHour === hour}
                  onPress={() => void updateSettings({ notificationHour: hour })}
                />
              ))}
            </View>
          </View>

          {scheduler.supported && permission ? (
            <Button
              label="Send a test reminder"
              icon="bell-ring-outline"
              variant="secondary"
              onPress={() => void scheduler.sendTestNotification()}
            />
          ) : null}
        </Section>

        <Section title="Display">
          <View style={{ gap: spacing.sm }}>
            <Text variant="label">Date order</Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Chip
                label="31/12/2027"
                size="sm"
                selected={settings.dateFormat === 'DMY'}
                onPress={() => void updateSettings({ dateFormat: 'DMY' })}
              />
              <Chip
                label="12/31/2027"
                size="sm"
                selected={settings.dateFormat === 'MDY'}
                onPress={() => void updateSettings({ dateFormat: 'MDY' })}
              />
            </View>
            <Text variant="caption" tone="muted">
              Also decides how an ambiguous scanned date like 03/04/27 is read.
            </Text>
          </View>

          <View style={{ gap: spacing.sm }}>
            <Text variant="label">Appearance</Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {(
                [
                  { id: 'system', label: 'System', icon: 'theme-light-dark' },
                  { id: 'light', label: 'Light', icon: 'white-balance-sunny' },
                  { id: 'dark', label: 'Dark', icon: 'weather-night' },
                ] as const
              ).map((option) => (
                <Chip
                  key={option.id}
                  label={option.label}
                  icon={option.icon}
                  size="sm"
                  selected={settings.theme === option.id}
                  onPress={() => void updateSettings({ theme: option.id })}
                />
              ))}
            </View>
          </View>

          <View style={{ gap: spacing.sm }}>
            <Text variant="label">Currency</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {['$', '£', '€', '₹', '¥'].map((symbol) => (
                <Chip
                  key={symbol}
                  label={symbol}
                  size="sm"
                  selected={settings.currency === symbol}
                  onPress={() => void updateSettings({ currency: symbol })}
                />
              ))}
            </View>
          </View>
        </Section>

        <Section title="Scanning">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="label">Ask the AI when unsure</Text>
              <Text variant="caption" tone="secondary">
                If the on-device reader cannot find a confident date, send the photo to Mistral.
              </Text>
            </View>
            <Switch
              value={settings.aiAutoFallback}
              onValueChange={(aiAutoFallback) => void updateSettings({ aiAutoFallback })}
              trackColor={{ true: colors.accent, false: colors.borderStrong }}
            />
          </View>
          <NavRow
            icon="key-variant"
            label="AI key and model"
            hint="Mistral, stored in the device keystore"
            onPress={() => router.push('/settings/ai')}
          />
        </Section>

        <Section title="Data">
          <NavRow
            icon="folder-download-outline"
            label="Backup and restore"
            hint={`${itemCount} items on this device`}
            onPress={() => router.push('/settings/data')}
          />
          <Button label="Delete everything" icon="trash-can-outline" variant="danger" onPress={confirmClear} />
          <Text variant="caption" tone="muted">
            Everything is stored on this device only. Nothing is uploaded unless you use an AI scan.
          </Text>
        </Section>
      </ScrollView>
    </Screen>
  );
}
