import { LocalizedText } from '../../i18n/LocalizedText';
﻿import React from 'react';
import {
  StyleSheet,
  NativeText,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import GlassSurface from './GlassSurface';

type ToastType = 'success' | 'error' | 'warning' | 'info';

type Props = {
  visible: boolean;
  message: string;
  type?: ToastType;
};

export default function GlassToast({
  visible,
  message,
  type = 'info',
}: Props) {
  const { tokens } = useTheme();

  if (!visible) return null;

  const config = {
    success: {
      color: tokens.colors.success,
      icon: 'checkmark-circle' as const,
    },
    error: {
      color: tokens.colors.danger,
      icon: 'alert-circle' as const,
    },
    warning: {
      color: tokens.colors.warning,
      icon: 'warning' as const,
    },
    info: {
      color: tokens.colors.info,
      icon: 'information-circle' as const,
    },
  }[type];

  return (
    <View
      pointerEvents="none"
      accessibilityRole="alert"
      style={styles.position}
    >
      <GlassSurface intensity={30} style={styles.container}>
        <Ionicons name={config.icon} size={22} color={config.color} />
        <LocalizedText style={[styles.message, { color: tokens.colors.text }]}>
          {message}
        </LocalizedText>
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  position: {
    position: 'absolute',
    top: 54,
    left: 16,
    right: 16,
    zIndex: 200,
  },
  container: {
    minHeight: 54,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  message: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
});
