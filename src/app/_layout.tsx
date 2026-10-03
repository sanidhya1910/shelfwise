import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useAppStore } from '@/store/useAppStore';
import { getColors } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

function navTheme(scheme: 'light' | 'dark') {
  const colors = getColors(scheme);
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.accent,
      background: colors.bg,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
    },
  };
}

export default function RootLayout() {
  const { colors, scheme } = useTheme();
  const hydrate = useAppStore((s) => s.hydrate);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    hydrate()
      .catch((error) => {
        // Starting with an empty store beats a white screen; the user can still
        // add items, and the next launch retries the read.
        console.error('Failed to load the local database', error);
      })
      .finally(() => {
        if (!cancelled) {
          setReady(true);
          SplashScreen.hideAsync().catch(() => undefined);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [hydrate]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      {/*
        Motion policy: Reanimated defaults every animation to ReduceMotion.System,
        so timings, springs and layout animations already defer to the device's
        Reduce Motion setting. The looping scanner sweep opts out explicitly in
        ScannerFrame, because a disabled repeat would strand it mid-frame.
      */}
      <SafeAreaProvider>
        <ThemeProvider value={navTheme(scheme)}>
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.bg },
              animation: 'slide_from_right',
            }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="item/[id]" />
            <Stack.Screen name="add" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="settings/index" />
            <Stack.Screen name="settings/ai" />
            <Stack.Screen name="settings/data" />
          </Stack>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
