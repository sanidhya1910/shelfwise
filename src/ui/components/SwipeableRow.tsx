import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { type ReactNode } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import type { IconName } from '@/domain/categories';
import { radius, spacing, spring } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';
import { haptics } from '@/utils/haptics';

import { Text } from './Text';

/** Past this many points the release commits the action. */
const COMMIT_AT = 96;
/** Beyond this the row stops following the finger, so it feels bounded. */
const MAX_DRAG = 150;

export interface SwipeAction {
  icon: IconName;
  label: string;
  color: string;
  onTrigger: () => void;
}

export interface SwipeableRowProps {
  children: ReactNode;
  /** Revealed by dragging right. Conventionally the positive action. */
  right?: SwipeAction;
  /** Revealed by dragging left. Conventionally the destructive one. */
  left?: SwipeAction;
  enabled?: boolean;
}

export function SwipeableRow({ children, right, left, enabled = true }: SwipeableRowProps) {
  const { colors } = useTheme();
  const x = useSharedValue(0);
  const armed = useSharedValue(false);

  const buzz = () => haptics.press();
  const commit = (action: SwipeAction) => action.onTrigger();

  const pan = Gesture.Pan()
    .enabled(enabled)
    // Let vertical list scrolling win until the gesture is clearly horizontal.
    .activeOffsetX([-14, 14])
    .failOffsetY([-12, 12])
    .onUpdate((e) => {
      const raw = e.translationX;
      const allowed = (raw > 0 && right) || (raw < 0 && left);
      if (!allowed) {
        x.value = raw * 0.12;
        return;
      }
      // Rubber-band past the commit point rather than tracking 1:1 forever.
      const sign = Math.sign(raw);
      const mag = Math.abs(raw);
      x.value = sign * (mag > MAX_DRAG ? MAX_DRAG + (mag - MAX_DRAG) * 0.15 : mag);

      const nowArmed = Math.abs(x.value) >= COMMIT_AT;
      if (nowArmed !== armed.value) {
        armed.value = nowArmed;
        if (nowArmed) runOnJS(buzz)();
      }
    })
    .onEnd(() => {
      const passed = Math.abs(x.value) >= COMMIT_AT;
      const action = x.value > 0 ? right : left;
      armed.value = false;
      if (passed && action) {
        // Slide the row out from under the finger, then hand off to the store.
        x.value = withTiming(Math.sign(x.value) * 500, { duration: 180 }, (done) => {
          if (done) runOnJS(commit)(action);
        });
        return;
      }
      x.value = withSpring(0, spring.responsive);
    });

  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  const backdropStyle = useAnimatedStyle(() => {
    const action = x.value > 0 ? right : left;
    return {
      backgroundColor: action?.color ?? 'transparent',
      opacity: interpolate(Math.abs(x.value), [0, COMMIT_AT], [0.35, 1], 'clamp'),
    };
  });

  const leadingStyle = useAnimatedStyle(() => ({
    opacity: x.value > 8 ? 1 : 0,
    transform: [{ scale: interpolate(x.value, [0, COMMIT_AT], [0.7, 1], 'clamp') }],
  }));

  const trailingStyle = useAnimatedStyle(() => ({
    opacity: x.value < -8 ? 1 : 0,
    transform: [{ scale: interpolate(-x.value, [0, COMMIT_AT], [0.7, 1], 'clamp') }],
  }));

  return (
    <View style={{ borderRadius: radius.lg, overflow: 'hidden' }}>
      <Animated.View
        style={[
          {
            ...StyleSheetAbsolute,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: spacing.xl,
          },
          backdropStyle,
        ]}>
        <Animated.View style={[{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, leadingStyle]}>
          {right ? (
            <>
              <MaterialCommunityIcons name={right.icon} size={20} color={colors.surface} />
              <Text variant="label" style={{ color: colors.surface }}>
                {right.label}
              </Text>
            </>
          ) : null}
        </Animated.View>
        <Animated.View style={[{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, trailingStyle]}>
          {left ? (
            <>
              <Text variant="label" style={{ color: colors.surface }}>
                {left.label}
              </Text>
              <MaterialCommunityIcons name={left.icon} size={20} color={colors.surface} />
            </>
          ) : null}
        </Animated.View>
      </Animated.View>

      <GestureDetector gesture={pan}>
        <Animated.View style={rowStyle}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
}

const StyleSheetAbsolute = {
  position: 'absolute' as const,
  top: 0,
  bottom: 0,
  left: 0,
  right: 0,
};
