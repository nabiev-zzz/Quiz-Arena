import { LocalizedText } from '../../i18n/LocalizedText';
﻿import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  NativeText,
  View,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

type Props = {
  visible?: boolean;
  message?: string;
  fullScreen?: boolean;
};

export default function GlassLoader({
  visible = true,
  message,
  fullScreen = false,
}: Props) {
  const { tokens } = useTheme();

  if (!visible) return null;

  return (
    <View
      style={[
        styles.container,
        fullScreen && styles.fullScreen,
        fullScreen && { backgroundColor: tokens.colors.overlay },
      ]}
    >
      <ActivityIndicator size="large" color={tokens.colors.primary} />
      {message ? (
        <LocalizedText style={[styles.message, { color: tokens.colors.text }]}>
          {message}
        </LocalizedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 20,
  },
  fullScreen: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 200,
  },
  message: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
