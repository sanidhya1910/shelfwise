import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import { type, type ThemeColors, type Urgency } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

type Variant = keyof typeof type;
type Tone = 'default' | 'secondary' | 'muted' | 'accent' | 'onAccent' | Urgency;

export interface TextProps extends RNTextProps {
  variant?: Variant;
  tone?: Tone;
  /** Small caps-ish treatment used for section labels. */
  uppercase?: boolean;
  center?: boolean;
}

function toneColor(tone: Tone, colors: ThemeColors): string {
  switch (tone) {
    case 'secondary':
      return colors.textSecondary;
    case 'muted':
      return colors.textMuted;
    case 'accent':
      return colors.accent;
    case 'onAccent':
      return colors.onAccent;
    case 'default':
      return colors.text;
    default:
      return colors[tone];
  }
}

export function Text({
  variant = 'body',
  tone = 'default',
  uppercase,
  center,
  style,
  ...rest
}: TextProps) {
  const { colors } = useTheme();
  const base = type[variant] as TextStyle;
  return (
    <RNText
      {...rest}
      style={[
        base,
        { color: toneColor(tone, colors) },
        uppercase && { textTransform: 'uppercase', letterSpacing: 0.7 },
        center && { textAlign: 'center' },
        style,
      ]}
    />
  );
}
