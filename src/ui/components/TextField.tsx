import { TextInput, View, type KeyboardTypeOptions } from 'react-native';

import { radius, spacing } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

import { Text } from './Text';

export interface TextFieldProps {
  label: string;
  value: string;
  onChangeText: (next: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
  autoFocus?: boolean;
  /** Rendered inside the field on the left, e.g. a currency symbol. */
  prefix?: string;
}

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline,
  autoFocus,
  prefix,
}: TextFieldProps) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="micro" tone="muted" uppercase>
        {label}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: multiline ? 'flex-start' : 'center',
          gap: spacing.sm,
          minHeight: 48,
          paddingHorizontal: spacing.md,
          paddingVertical: multiline ? spacing.md : 0,
          borderRadius: radius.md,
          backgroundColor: colors.surfaceAlt,
          borderWidth: 1,
          borderColor: colors.border,
        }}>
        {prefix ? (
          <Text variant="body" tone="muted">
            {prefix}
          </Text>
        ) : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          keyboardType={keyboardType}
          multiline={multiline}
          autoFocus={autoFocus}
          style={{
            flex: 1,
            color: colors.text,
            fontSize: 16,
            fontWeight: '500',
            minHeight: multiline ? 72 : 48,
            textAlignVertical: multiline ? 'top' : 'center',
          }}
        />
      </View>
    </View>
  );
}
