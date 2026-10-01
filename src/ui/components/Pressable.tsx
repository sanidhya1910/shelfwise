import { type ReactNode } from 'react';
import { Pressable as RNPressable, type PressableProps, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { spring } from '@/ui/theme';
import { haptics } from '@/utils/haptics';

const AnimatedPressable = Animated.createAnimatedComponent(RNPressable);

export interface TouchableProps extends Omit<PressableProps, 'style' | 'children'> {
  children?: ReactNode;
  style?: ViewStyle | ViewStyle[];
  /** How far it dips on press. Bigger targets want a subtler dip. */
  scaleTo?: number;
  haptic?: 'none' | 'tap' | 'press' | 'select';
}

/**
 * Every tappable surface in the app. The spring scale is what makes the UI feel
 * responsive on a mid-range Android where a ripple alone lands a frame late.
 */
export function Touchable({
  children,
  style,
  scaleTo = 0.97,
  haptic = 'tap',
  onPressIn,
  onPress,
  disabled,
  ...rest
}: TouchableProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={(e) => {
        scale.set(withSpring(scaleTo, spring.responsive));
        if (haptic !== 'none') haptics[haptic]();
        onPressIn?.(e);
      }}
      onPressOut={() => {
        scale.set(withSpring(1, spring.bouncy));
      }}
      onPress={onPress}
      style={[animatedStyle, { opacity: disabled ? 0.45 : 1 }, style as ViewStyle]}>
      {children}
    </AnimatedPressable>
  );
}
