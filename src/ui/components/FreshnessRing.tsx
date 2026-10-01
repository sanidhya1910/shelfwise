import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import type { IconName } from '@/domain/categories';
import { ringProgress, urgencyColor } from '@/domain/freshness';
import type { Urgency } from '@/ui/theme';
import { timing } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

import { Text } from './Text';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export interface FreshnessRingProps {
  daysLeft: number;
  urgency: Urgency;
  /** Shown in the middle. An icon reads better at small sizes than a number. */
  icon?: IconName;
  label?: string;
  size?: number;
  strokeWidth?: number;
}

/**
 * A ring that fills as an item approaches its date. Deliberately not a
 * proportion of shelf life — see `ringProgress` for why.
 */
export function FreshnessRing({
  daysLeft,
  urgency,
  icon,
  label,
  size = 52,
  strokeWidth = 4,
}: FreshnessRingProps) {
  const { colors } = useTheme();
  const color = urgencyColor(urgency, colors);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const target = ringProgress(daysLeft);

  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(target, { duration: timing.slow });
  }, [target, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.surfaceSunken}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          // Start the arc at 12 o'clock rather than 3.
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {label ? (
        <Text variant="micro" style={{ color }}>
          {label}
        </Text>
      ) : icon ? (
        <MaterialCommunityIcons name={icon} size={size * 0.42} color={color} />
      ) : null}
    </View>
  );
}
