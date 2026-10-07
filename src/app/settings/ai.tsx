import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect, useState } from 'react';
import { Linking, ScrollView, View } from 'react-native';

import { AI_MODELS } from '@/domain/settings';
import { useAppStore } from '@/store/useAppStore';
import { Button } from '@/ui/components/Button';
import { Card } from '@/ui/components/Card';
import { Touchable } from '@/ui/components/Pressable';
import { Screen } from '@/ui/components/Screen';
import { Text } from '@/ui/components/Text';
import { TextField } from '@/ui/components/TextField';
import { radius, spacing } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';
import { haptics } from '@/utils/haptics';
import { goBack } from '@/utils/nav';
import { getApiKey, setApiKey, verifyApiKey } from '@/vision/mistral';

type Check = 'idle' | 'checking' | 'valid' | 'invalid';

export default function AiSettingsScreen() {
  const { colors } = useTheme();
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);

  const [key, setKey] = useState('');
  const [saved, setSaved] = useState(false);
  const [check, setCheck] = useState<Check>('idle');

  useEffect(() => {
    void getApiKey().then((existing) => setSaved(existing != null));
  }, []);

  const save = async () => {
    setCheck('checking');
    const valid = await verifyApiKey(key);
    if (!valid) {
      setCheck('invalid');
      haptics.error();
      return;
    }
    await setApiKey(key);
    setSaved(true);
    setKey('');
    setCheck('valid');
    haptics.success();
  };

  const remove = async () => {
    await setApiKey('');
    setSaved(false);
    setCheck('idle');
    haptics.warning();
  };

  return (
    <Screen
      title="AI scanning"
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
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.lg }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <Card style={{ gap: spacing.md }} flat>
          <Text variant="body" tone="secondary">
            Shelfwise reads expiry dates on the phone, for free and offline. A Mistral key adds two things:
            a second opinion when a label is too faint to read, and recognising a product from a photo.
          </Text>
          <Text variant="caption" tone="muted">
            Photos are only sent when one of those runs. The key is stored in the device keystore and
            never written to the database or a backup.
          </Text>
        </Card>

        {saved ? (
          <Card style={{ gap: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <MaterialCommunityIcons name="key-variant" size={18} color={colors.accent} />
              <Text variant="label" style={{ flex: 1 }}>
                A key is saved on this device
              </Text>
            </View>
            <Button label="Remove key" icon="key-remove" variant="danger" onPress={() => void remove()} />
          </Card>
        ) : (
          <View style={{ gap: spacing.md }}>
            <TextField
              label="Mistral API key"
              value={key}
              onChangeText={(next) => {
                setKey(next);
                setCheck('idle');
              }}
              placeholder="Paste your key"
            />
            {check === 'invalid' ? (
              <Text variant="caption" style={{ color: colors.expired }}>
                Mistral rejected that key. Check you copied all of it.
              </Text>
            ) : null}
            <Button
              label={check === 'checking' ? 'Checking' : 'Save key'}
              icon="check"
              loading={check === 'checking'}
              disabled={key.trim().length < 8}
              onPress={() => void save()}
            />
            <Touchable
              onPress={() => void Linking.openURL('https://console.mistral.ai/api-keys')}
              scaleTo={0.97}
              haptic="tap">
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: spacing.xs,
                  paddingVertical: spacing.sm,
                }}>
                <Text variant="caption" tone="accent">
                  Get a key from console.mistral.ai
                </Text>
                <MaterialCommunityIcons name="open-in-new" size={13} color={colors.accent} />
              </View>
            </Touchable>
          </View>
        )}

        <View style={{ gap: spacing.sm }}>
          <Text variant="micro" tone="muted" uppercase style={{ paddingHorizontal: spacing.xs }}>
            Model for product photos
          </Text>
          <Card style={{ gap: spacing.sm, padding: spacing.sm }}>
            {AI_MODELS.map((model) => {
              const selected = settings.aiModel === model.id;
              return (
                <Touchable
                  key={model.id}
                  onPress={() => void updateSettings({ aiModel: model.id })}
                  scaleTo={0.98}
                  haptic="select">
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.md,
                      padding: spacing.md,
                      borderRadius: radius.md,
                      backgroundColor: selected ? colors.accentSoft : 'transparent',
                    }}>
                    <MaterialCommunityIcons
                      name={selected ? 'radiobox-marked' : 'radiobox-blank'}
                      size={19}
                      color={selected ? colors.accent : colors.textMuted}
                    />
                    <View style={{ flex: 1 }}>
                      <Text variant="label">{model.label}</Text>
                      <Text variant="caption" tone="muted">
                        {model.hint}
                      </Text>
                    </View>
                  </View>
                </Touchable>
              );
            })}
          </Card>
          <Text variant="caption" tone="muted" style={{ paddingHorizontal: spacing.xs }}>
            Date fallback always uses Mistral&apos;s dedicated OCR model, which costs a fraction of a
            cent per scan.
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}
