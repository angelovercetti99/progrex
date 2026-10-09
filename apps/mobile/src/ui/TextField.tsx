import { StyleSheet, TextInput, type TextInputProps } from 'react-native';

import { fontFamilyFor } from './fonts';
import { radius, space, touch, typography } from './theme';
import { useTheme } from './useTheme';

/** Single-line text input with the app's look. */
export function TextField(props: TextInputProps) {
  const theme = useTheme();
  return (
    <TextInput
      placeholderTextColor={theme.textMuted}
      {...props}
      style={[
        typography.body,
        { fontFamily: fontFamilyFor('400'), fontWeight: undefined },
        styles.input,
        { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border },
        props.style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: touch.min,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space.lg,
  },
});
