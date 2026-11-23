import React from 'react';
import {
  StyleProp,
  StyleSheet,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

type Props = TextInputProps & {
  containerStyle?: StyleProp<ViewStyle>;
};

export default function GlassInput({
  containerStyle,
  style,
  editable = true,
  ...inputProps
}: Props) {
  const { tokens } = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          minHeight: tokens.component.inputHeight,
          borderRadius: tokens.radius.md,
          backgroundColor: tokens.colors.inputBackground,
          borderColor: tokens.colors.border,
          opacity: editable ? 1 : tokens.opacity.disabled,
        },
        containerStyle,
      ]}
    >
      <TextInput
        {...inputProps}
        editable={editable}
        placeholderTextColor={tokens.colors.textMuted}
        selectionColor={tokens.colors.primary}
        style={[
          styles.input,
          {
            color: tokens.colors.text,
            fontSize: tokens.typography.body,
          },
          style,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  input: {
    minHeight: 48,
    paddingVertical: 10,
  },
});
