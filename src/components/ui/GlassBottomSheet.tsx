import { LocalizedText } from '../../i18n/LocalizedText';
﻿import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text as NativeText,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import GlassSurface from './GlassSurface';

type Props = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
};

export default function GlassBottomSheet({
  visible,
  onClose,
  children,
  title,
}: Props) {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, { backgroundColor: tokens.colors.overlay }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Oynani yopish"
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />
        <GlassSurface
          intensity={35}
          style={[
            styles.sheet,
            {
              paddingBottom: Math.max(insets.bottom, 20),
              borderColor: tokens.colors.glassBorder,
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: tokens.colors.textMuted }]} />
          {title ? (
            <LocalizedText style={[styles.title, { color: tokens.colors.text }]}>
              {title}
            </LocalizedText>
          ) : null}
          {children}
        </GlassSurface>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    width: '100%',
    maxHeight: '88%',
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    overflow: 'hidden',
  },
  handle: {
    width: 42,
    height: 5,
    borderRadius: 10,
    alignSelf: 'center',
    marginBottom: 18,
    opacity: 0.45,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
});
