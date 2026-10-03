import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Tabs } from 'expo-router';
import { Platform, View, type ColorValue } from 'react-native';

import type { IconName } from '@/domain/categories';
import { elevation, radius } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

/** The scan tab is the point of the app, so it gets a raised puck, not a glyph. */
function ScanTabIcon({ focused }: { focused: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        {
          width: 52,
          height: 40,
          borderRadius: radius.md + 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: focused ? colors.accentPressed : colors.accent,
        },
        elevation(colors, 2),
      ]}>
      <MaterialCommunityIcons name="line-scan" size={24} color={colors.onAccent} />
    </View>
  );
}

function icon(name: IconName, focusedName?: IconName) {
  function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
    return (
      <MaterialCommunityIcons
        name={focused ? (focusedName ?? name) : name}
        size={24}
        color={color as string}
      />
    );
  }
  TabIcon.displayName = `TabIcon(${name})`;
  return TabIcon;
}

export default function TabsLayout() {
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Tabs slide rather than snap, so moving between them reads as one
        // surface shifting instead of five unrelated screens.
        animation: 'shift',
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: Platform.select({ android: 64, default: 84 }),
          paddingTop: 6,
          paddingBottom: Platform.select({ android: 8, default: 26 }),
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}>
      <Tabs.Screen
        name="index"
        options={{ title: 'Home', tabBarIcon: icon('home-outline', 'home-variant') }}
      />
      <Tabs.Screen
        name="inventory"
        options={{ title: 'Items', tabBarIcon: icon('format-list-bulleted', 'format-list-checkbox') }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scan',
          tabBarLabel: () => null,
          tabBarIcon: ({ focused }) => <ScanTabIcon focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="list"
        options={{ title: 'List', tabBarIcon: icon('cart-outline', 'cart') }}
      />
      <Tabs.Screen
        name="stats"
        options={{ title: 'Stats', tabBarIcon: icon('chart-donut', 'chart-donut-variant') }}
      />
    </Tabs>
  );
}
