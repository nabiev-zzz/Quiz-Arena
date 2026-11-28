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
  const { isDark, isLiquidGlass, tokens } = useTheme();
  const inactive = disabled || loading;

  const contentColor = isLiquidGlass
    ? '#172638'
    : variant === 'primary' ? '#FFFFFF' : tokens.colors.text;

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
          backgroundColor: isLiquidGlass
            ? '#FFFFFF'
            : variant === 'secondary' ? tokens.colors.surfaceElevated : 'transparent',
          borderColor: isLiquidGlass ? 'rgba(255,255,255,0.96)' : tokens.colors.borderStrong,
          shadowColor: isLiquidGlass ? '#6C8BA8' : 'transparent',
          shadowOpacity: isLiquidGlass ? 0.20 : 0,
          shadowRadius: isLiquidGlass ? 16 : 0,
          shadowOffset: { width: 0, height: isLiquidGlass ? 7 : 0 },
          elevation: isLiquidGlass ? 4 : 0,
        },
        style,
      ]}
    >
      {variant === 'primary' && !isLiquidGlass ? (
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
