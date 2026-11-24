import { LocalizedText } from '../../i18n/LocalizedText';
﻿import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text as NativeText,
  View,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import GlassSurface from './GlassSurface';

type Props = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
};

export default function GlassModal({
  visible,
  onClose,
  children,
  title,
}: Props) {
  const { tokens } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
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
        <GlassSurface style={styles.content} intensity={35}>
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
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    width: '100%',
    maxWidth: 480,
    padding: 20,
    borderRadius: 28,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
});
