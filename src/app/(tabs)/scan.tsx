import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { router, useIsFocused } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { todayISO } from '@/domain/item';
import { useAppStore } from '@/store/useAppStore';
import { Button } from '@/ui/components/Button';
import { Touchable } from '@/ui/components/Pressable';
import { ScannerFrame, type ScannerState } from '@/ui/components/ScannerFrame';
import { EmptyState, Screen } from '@/ui/components/Screen';
import { Text } from '@/ui/components/Text';
import { radius, spacing } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';
import { buildBackup, isBackupError } from '@/utils/backup';
import { backupIo } from '@/utils/backupIo';
import { addDays } from '@/utils/dates';
import { haptics } from '@/utils/haptics';
import { isPlausibleBarcode, lookupBarcode } from '@/vision/barcode';
import { hasApiKey } from '@/vision/mistral';
import { ocr } from '@/vision/ocr';
import { scanExpiryDate, scanProductPhoto } from '@/vision/scanExpiry';

type Mode = 'barcode' | 'date' | 'product';

const MODES: { id: Mode; label: string; icon: 'barcode-scan' | 'calendar-text' | 'package-variant'; hint: string }[] = [
  { id: 'barcode', label: 'Barcode', icon: 'barcode-scan', hint: 'Line up the barcode' },
  { id: 'date', label: 'Date', icon: 'calendar-text', hint: 'Frame the printed expiry date' },
  { id: 'product', label: 'Product', icon: 'package-variant', hint: 'Show the whole product' },
];

export default function ScanScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();

  const settings = useAppStore((s) => s.settings);
  const categories = useAppStore((s) => s.categories);

  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission, getPermission] = useCameraPermissions();
  const [mode, setMode] = useState<Mode>('date');
  const [state, setState] = useState<ScannerState>('idle');
  const [status, setStatus] = useState<string | null>(null);
  const [torch, setTorch] = useState(false);
  const [aiReady, setAiReady] = useState(false);

  // Barcodes stream in many times a second; this gate keeps one scan to one lookup.
  const busy = useRef(false);

  useEffect(() => {
    void hasApiKey().then(setAiReady);
  }, []);

  // Crossing a focus boundary clears any half-finished scan. Done during render
  // rather than in an effect: this is state derived from navigation, and an
  // effect here would cost an extra render pass every time the tab changes.
  const [wasFocused, setWasFocused] = useState(isFocused);
  if (wasFocused !== isFocused) {
    setWasFocused(isFocused);
    setState('idle');
    setStatus(null);
  }

  useEffect(() => {
    // Releasing the gate belongs here rather than in the render-phase reset
    // above, because a ref must not be written during render.
    busy.current = false;
    // Someone may have granted camera access in system settings while we were
    // away; without this re-check the permission gate stays up until restart.
    if (isFocused) void getPermission();
  }, [getPermission, isFocused]);

  const finish = useCallback(() => {
    busy.current = false;
    setState('idle');
    setStatus(null);
  }, []);

  const handleBarcode = useCallback(
    async (result: BarcodeScanningResult) => {
      if (busy.current || mode !== 'barcode') return;
      const value = result.data?.trim();
      if (!value || !isPlausibleBarcode(value)) return;

      busy.current = true;
      setState('found');
      haptics.success();
      setStatus('Looking it up');

      const product = await lookupBarcode(value);
      const categoryId = product?.categoryId ?? 'other';
      const shelfLife =
        categories.find((c) => c.id === categoryId)?.defaultShelfLifeDays ?? 30;

      router.push({
        pathname: '/add',
        params: {
          barcode: value,
          name: product?.name ?? '',
          brand: product?.brand ?? '',
          categoryId,
          imageUri: product?.imageUrl ?? '',
          expiryDate: addDays(todayISO(), shelfLife),
          source: 'barcode',
          hint: product ? 'Found in Open Food Facts' : 'New barcode. Add the details below.',
        },
      });
      setTimeout(finish, 600);
    },
    [categories, finish, mode]
  );

  const captureAndRead = useCallback(
    async (existingUri?: string) => {
      if (busy.current) return;
      busy.current = true;
      setState('working');

      try {
        let uri = existingUri;
        if (!uri) {
          setStatus('Capturing');
          const photo = await cameraRef.current?.takePictureAsync({ quality: 0.85, skipProcessing: true });
          uri = photo?.uri;
        }
        if (!uri) {
          finish();
          return;
        }

        if (mode === 'product') {
          setStatus('Identifying the product');
          const outcome = await scanProductPhoto(uri, settings.aiModel, settings.dateFormat);
          if (!outcome.product) {
            haptics.error();
            setStatus(outcome.error ?? 'Could not identify that');
            setTimeout(finish, 1800);
            return;
          }
          setState('found');
          haptics.success();
          const shelfLife =
            outcome.product.shelfLifeDays ??
            categories.find((c) => c.id === outcome.product?.categoryId)?.defaultShelfLifeDays ??
            30;
          router.push({
            pathname: '/add',
            params: {
              name: outcome.product.name,
              brand: outcome.product.brand ?? '',
              categoryId: outcome.product.categoryId,
              imageUri: uri,
              expiryDate: outcome.suggestedExpiry ?? addDays(todayISO(), shelfLife),
              source: 'photo-ai',
              confidence: String(outcome.product.confidence ?? ''),
              hint: outcome.suggestedExpiry ? 'Date read from the pack' : 'Estimated shelf life. Check the date.',
            },
          });
          setTimeout(finish, 600);
          return;
        }

        setStatus(ocr.available ? 'Reading the label' : 'Asking the AI');
        const outcome = await scanExpiryDate(uri, {
          dateFormat: settings.dateFormat,
          autoFallback: settings.aiAutoFallback,
        });

        if (!outcome.best) {
          haptics.warning();
          setStatus(
            outcome.error ??
              (outcome.needsFallback && !aiReady
                ? 'No date found. Add an AI key in settings to try harder.'
                : 'No date found. Try again or add it by hand.')
          );
          setTimeout(finish, 2400);
          return;
        }

        setState('found');
        haptics.success();
        router.push({
          pathname: '/add',
          params: {
            expiryDate: outcome.best.date,
            imageUri: uri,
            source: 'date-scan',
            confidence: String(outcome.best.confidence),
            hint:
              outcome.engine === 'mistral'
                ? `AI read "${outcome.best.raw}"`
                : `Read "${outcome.best.raw}" from the label`,
          },
        });
        setTimeout(finish, 600);
      } catch {
        haptics.error();
        setStatus('Something went wrong. Try again.');
        setTimeout(finish, 1800);
      }
    },
    [aiReady, categories, finish, mode, settings.aiAutoFallback, settings.aiModel, settings.dateFormat]
  );

  const pickFromGallery = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.9,
    });
    if (result.canceled || !result.assets[0]) return;
    void captureAndRead(result.assets[0].uri);
  }, [captureAndRead]);

  if (Platform.OS === 'web') return <WebBackupPanel />;

  if (!permission) {
    return (
      <Screen title="Scan">
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </Screen>
    );
  }

  if (!permission.granted) {
    return (
      <Screen title="Scan">
        <EmptyState
          icon="camera-off-outline"
          title="Camera access needed"
          body="Shelfwise reads expiry dates and barcodes straight from the camera. Nothing leaves your phone unless you use an AI scan."
          action={<Button label="Allow camera" icon="camera" onPress={() => void requestPermission()} />}
        />
      </Screen>
    );
  }

  const activeMode = MODES.find((m) => m.id === mode)!;

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {isFocused ? (
        <CameraView
          ref={cameraRef}
          style={{ flex: 1 }}
          facing="back"
          enableTorch={torch}
          barcodeScannerSettings={{
            barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128'],
          }}
          onBarcodeScanned={mode === 'barcode' ? (r) => void handleBarcode(r) : undefined}
        />
      ) : null}

      <View style={{ ...StyleSheetFill, justifyContent: 'space-between' }} pointerEvents="box-none">
        <View style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg, alignItems: 'flex-end' }}>
          <Touchable onPress={() => setTorch((t) => !t)} scaleTo={0.9}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: torch ? colors.accent : 'rgba(0,0,0,0.45)',
              }}>
              <MaterialCommunityIcons
                name={torch ? 'flashlight' : 'flashlight-off'}
                size={21}
                color="#fff"
              />
            </View>
          </Touchable>
        </View>

        <View style={{ gap: spacing.lg }} pointerEvents="none">
          <ScannerFrame
            state={state}
            aspect={mode === 'barcode' ? 'wide' : 'square'}
            accent="#FFFFFF"
            successColor={colors.fresh}
          />
          <View style={{ alignItems: 'center', minHeight: 26 }}>
            {status ? (
              <Animated.View
                entering={FadeIn.duration(160)}
                exiting={FadeOut.duration(160)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.sm,
                  borderRadius: radius.pill,
                  backgroundColor: 'rgba(0,0,0,0.6)',
                }}>
                {state === 'working' ? <ActivityIndicator size="small" color="#fff" /> : null}
                <Text variant="caption" style={{ color: '#fff' }}>
                  {status}
                </Text>
              </Animated.View>
            ) : (
              <Text variant="caption" style={{ color: 'rgba(255,255,255,0.85)' }}>
                {activeMode.hint}
              </Text>
            )}
          </View>
        </View>

        <View
          style={{
            paddingBottom: insets.bottom + spacing.lg,
            paddingHorizontal: spacing.lg,
            gap: spacing.lg,
          }}>
          <View
            style={{
              flexDirection: 'row',
              alignSelf: 'center',
              padding: 4,
              borderRadius: radius.pill,
              backgroundColor: 'rgba(0,0,0,0.55)',
            }}>
            {MODES.map((m) => (
              <Touchable
                key={m.id}
                onPress={() => {
                  setMode(m.id);
                  setStatus(null);
                  setState('idle');
                }}
                haptic="select"
                scaleTo={0.94}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.xs + 2,
                    paddingHorizontal: spacing.lg - 2,
                    paddingVertical: spacing.sm + 1,
                    borderRadius: radius.pill,
                    backgroundColor: mode === m.id ? '#fff' : 'transparent',
                  }}>
                  <MaterialCommunityIcons
                    name={m.icon}
                    size={16}
                    color={mode === m.id ? '#111' : 'rgba(255,255,255,0.9)'}
                  />
                  <Text variant="caption" style={{ color: mode === m.id ? '#111' : 'rgba(255,255,255,0.9)' }}>
                    {m.label}
                  </Text>
                </View>
              </Touchable>
            ))}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Touchable onPress={() => void pickFromGallery()} scaleTo={0.9}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(0,0,0,0.45)',
                }}>
                <MaterialCommunityIcons name="image-outline" size={21} color="#fff" />
              </View>
            </Touchable>

            {mode === 'barcode' ? (
              <View style={{ width: 76, height: 76 }} />
            ) : (
              <Touchable onPress={() => void captureAndRead()} scaleTo={0.92} haptic="press">
                <View
                  style={{
                    width: 76,
                    height: 76,
                    borderRadius: 38,
                    borderWidth: 4,
                    borderColor: 'rgba(255,255,255,0.55)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <View
                    style={{
                      width: 58,
                      height: 58,
                      borderRadius: 29,
                      backgroundColor: state === 'working' ? colors.accent : '#fff',
                    }}
                  />
                </View>
              </Touchable>
            )}

            <Touchable onPress={() => router.push('/add')} scaleTo={0.9}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(0,0,0,0.45)',
                }}>
                <MaterialCommunityIcons name="pencil-outline" size={20} color="#fff" />
              </View>
            </Touchable>
          </View>
        </View>
      </View>
    </View>
  );
}

const StyleSheetFill = {
  position: 'absolute' as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};

/**
 * What the scan tab becomes in a browser. The web build cannot use the camera
 * meaningfully without the on-device reader, so this slot does the job the web
 * viewer actually exists for: opening the backup the phone exported.
 */
function WebBackupPanel() {
  const items = useAppStore((s) => s.items);
  const shopping = useAppStore((s) => s.shopping);
  const categories = useAppStore((s) => s.categories);
  const replaceAll = useAppStore((s) => s.replaceAll);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = async () => {
    setBusy(true);
    setError(null);
    try {
      const backup = await backupIo.open();
      if (backup) {
        await replaceAll({
          items: backup.items,
          shopping: backup.shoppingList,
          categories: backup.categories,
        });
      }
    } catch (e) {
      console.error('Backup import failed', e);
      setError(isBackupError(e) ? e.message : 'That file could not be read.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Backup" subtitle={items.length > 0 ? `${items.length} items loaded` : 'Nothing loaded yet'}>
      <View style={{ padding: spacing.lg, gap: spacing.lg }}>
        <Text variant="body" tone="secondary">
          This browser view reads a backup exported from the Shelfwise app. Scanning, reminders and the
          camera all live on the phone.
        </Text>
        <Button
          label="Open a backup file"
          icon="upload-outline"
          loading={busy}
          onPress={() => void open()}
        />
        {items.length > 0 ? (
          <Button
            label="Download the edited copy"
            icon="download-outline"
            variant="secondary"
            onPress={() => void backupIo.save(buildBackup(items, shopping, categories))}
          />
        ) : null}
        {error ? (
          <Text variant="caption" tone="expired">
            {error}
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}
