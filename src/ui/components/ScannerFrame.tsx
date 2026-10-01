import { useEffect, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { radius, spring } from '@/ui/theme';

export type ScannerState = 'idle' | 'working' | 'found';

export interface ScannerFrameProps {
  state: ScannerState;
  /** Wider and shorter for barcodes, taller for a date printed on a pack. */
  aspect: 'wide' | 'square';
  accent: string;
  successColor: string;
}

const CORNER = 30;
const THICKNESS = 3.5;
const LINE_HEIGHT = 2;
/** Idle is a slow search; working speeds up to show the app is busy. */
const SWEEP_IDLE_MS = 2000;
const SWEEP_WORKING_MS = 850;

function Corner({ position, color }: { position: 'tl' | 'tr' | 'bl' | 'br'; color: string }) {
  const vertical = position.startsWith('t') ? { top: 0 } : { bottom: 0 };
  const horizontal = position.endsWith('l') ? { left: 0 } : { right: 0 };
  const borders = {
    tl: { borderTopWidth: THICKNESS, borderLeftWidth: THICKNESS, borderTopLeftRadius: radius.md },
    tr: { borderTopWidth: THICKNESS, borderRightWidth: THICKNESS, borderTopRightRadius: radius.md },
    bl: { borderBottomWidth: THICKNESS, borderLeftWidth: THICKNESS, borderBottomLeftRadius: radius.md },
    br: { borderBottomWidth: THICKNESS, borderRightWidth: THICKNESS, borderBottomRightRadius: radius.md },
  }[position];

  return (
    <View
      style={{
        position: 'absolute',
        width: CORNER,
        height: CORNER,
        borderColor: color,
        ...vertical,
        ...horizontal,
        ...borders,
      }}
    />
  );
}

/**
 * The viewfinder: corner brackets rather than a full box, so the label stays
 * visible, plus a line that sweeps the full height while the camera is looking.
 *
 * The sweep is driven by `translateY` against a measured height rather than an
 * animated `top: '%'`. Percentage positions resolve against the parent box,
 * which this frame sizes with `aspectRatio` — so the percentage base is read
 * before the height settles and the line only ever covers part of the frame.
 * A measured transform also keeps the animation on the compositor instead of
 * forcing a layout pass every frame.
 */
export function ScannerFrame({ state, aspect, accent, successColor }: ScannerFrameProps) {
  const [height, setHeight] = useState(0);
  const reduceMotion = useReducedMotion();

  const progress = useSharedValue(0);
  const scale = useSharedValue(1);

  const travel = Math.max(0, height - LINE_HEIGHT);

  useEffect(() => {
    if (state === 'found') {
      cancelAnimation(progress);
      progress.set(withTiming(0, { duration: 140 }));
      scale.set(withSequence(withSpring(1.06, spring.bouncy), withSpring(1, spring.gentle)));
      return;
    }

    // Nothing to sweep across until the frame has been measured.
    if (travel === 0) return;

    if (reduceMotion) return;

    progress.set(0);
    progress.set(
      withRepeat(
        withTiming(1, {
          duration: state === 'working' ? SWEEP_WORKING_MS : SWEEP_IDLE_MS,
          easing: Easing.inOut(Easing.quad),
        }),
        -1,
        true
      )
    );

    return () => cancelAnimation(progress);
  }, [progress, reduceMotion, scale, state, travel]);

  const color = state === 'found' ? successColor : accent;

  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: progress.get() * travel }],
  }));

  const frameStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  const onLayout = (event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.height);
    if (next !== height) setHeight(next);
  };

  return (
    <Animated.View
      style={[
        {
          width: '82%',
          aspectRatio: aspect === 'wide' ? 1.9 : 1.15,
          alignSelf: 'center',
        },
        frameStyle,
      ]}>
      <View
        onLayout={onLayout}
        style={{ flex: 1, overflow: 'hidden', borderRadius: radius.md }}>
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: 0,
              left: '6%',
              right: '6%',
              height: LINE_HEIGHT,
              backgroundColor: color,
              borderRadius: LINE_HEIGHT,
              // A motionless line across the frame reads as a rendering fault,
              // so reduced motion drops it and leaves the brackets to aim with.
              opacity: state === 'found' || reduceMotion ? 0 : 0.9,
            },
            sweepStyle,
          ]}
        />
      </View>
      <Corner position="tl" color={color} />
      <Corner position="tr" color={color} />
      <Corner position="bl" color={color} />
      <Corner position="br" color={color} />
    </Animated.View>
  );
}
