import { LocalizedText } from '../../i18n/LocalizedText';
﻿import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text as NativeText,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../theme/ThemeContext';

type Props = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

export default function GlassButton({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
}: Props) {
  const { isDark, tokens } = useTheme();
  const inactive = disabled || loading;

  const contentColor =
    variant === 'primary'
      ? '#FFFFFF'
      : tokens.colors.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.wrapper,
        {
          minHeight: tokens.component.buttonHeight,
          borderRadius: tokens.radius.lg,
          opacity: inactive ? tokens.opacity.disabled : 1,
          transform: [{ scale: pressed && !inactive ? 0.985 : 1 }],
          borderWidth: variant === 'outline' ? 1 : 0,
          borderColor: tokens.colors.borderStrong,
          backgroundColor:
            variant === 'secondary'
              ? tokens.colors.surfaceElevated
              : 'transparent',
        },
        style,
      ]}
    >
      {variant === 'primary' ? (
        <LinearGradient
          colors={[...tokens.gradients.primary]}
          style={styles.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <LocalizedText style={[styles.label, { color: contentColor }]}>
              {title}
            </LocalizedText>
          )}
        </LinearGradient>
      ) : loading ? (
        <ActivityIndicator color={tokens.colors.primary} />
      ) : (
        <LocalizedText style={[styles.label, { color: contentColor }]}>
          {title}
        </LocalizedText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    overflow: 'hidden',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 15,
    letterSpacing: 0.15,
    fontWeight: '800',
  },
});
