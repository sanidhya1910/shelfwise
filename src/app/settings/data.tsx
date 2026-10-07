import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';

import { useAppStore } from '@/store/useAppStore';
import { Button } from '@/ui/components/Button';
import { Card } from '@/ui/components/Card';
import { Touchable } from '@/ui/components/Pressable';
import { Screen } from '@/ui/components/Screen';
import { Text } from '@/ui/components/Text';
import { spacing } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';
import { buildBackup, isBackupError } from '@/utils/backup';
import { backupIo } from '@/utils/backupIo';
import { haptics } from '@/utils/haptics';
import { goBack } from '@/utils/nav';

export default function DataSettingsScreen() {
  const { colors } = useTheme();
  const items = useAppStore((s) => s.items);
  const shopping = useAppStore((s) => s.shopping);
  const categories = useAppStore((s) => s.categories);
  const replaceAll = useAppStore((s) => s.replaceAll);

  const [busy, setBusy] = useState<'export' | 'import' | null>(null);

  const doExport = async () => {
    setBusy('export');
    try {
      await backupIo.save(buildBackup(items, shopping, categories));
      haptics.success();
    } catch {
      Alert.alert('Export failed', 'The backup file could not be written.');
    } finally {
      setBusy(null);
    }
  };

  const doImport = async () => {
    setBusy('import');
    try {
      const backup = await backupIo.open();
      if (!backup) return;

      Alert.alert(
        'Replace everything?',
        `This backup holds ${backup.items.length} items. Importing replaces the ${items.length} items currently on this device.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Replace',
            style: 'destructive',
            onPress: () => {
              void replaceAll({
                items: backup.items,
                shopping: backup.shoppingList,
                categories: backup.categories,
              }).then(() => {
                haptics.success();
                goBack();
              });
            },
          },
        ]
      );
    } catch (error) {
      console.error('Backup import failed', error);
      Alert.alert(
        'Could not read that file',
        isBackupError(error) ? error.message : 'The file could not be opened.'
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen
      title="Backup"
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
        showsVerticalScrollIndicator={false}>
        <Card style={{ gap: spacing.md }} flat>
          <Text variant="body" tone="secondary">
            Everything lives on this device. A backup file is how you move to a new phone, keep a
            safety copy, or open your shelf in a browser.
          </Text>
        </Card>

        <Card style={{ gap: spacing.md }}>
          <View style={{ gap: 2 }}>
            <Text variant="heading">Export</Text>
            <Text variant="caption" tone="secondary">
              {items.length} items and {shopping.length} shopping entries.
            </Text>
          </View>
          <Button
            label="Save a backup file"
            icon="download-outline"
            loading={busy === 'export'}
            onPress={() => void doExport()}
          />
        </Card>

        <Card style={{ gap: spacing.md }}>
          <View style={{ gap: 2 }}>
            <Text variant="heading">Import</Text>
            <Text variant="caption" tone="secondary">
              Replaces everything currently on this device.
            </Text>
          </View>
          <Button
            label="Open a backup file"
            icon="upload-outline"
            variant="secondary"
            loading={busy === 'import'}
            onPress={() => void doImport()}
          />
        </Card>

        <Text variant="caption" tone="muted">
          Reminders are rebuilt from the imported dates, so nothing is lost. The AI key is never
          included in a backup.
        </Text>
      </ScrollView>
    </Screen>
  );
}
