import React from 'react';
import {
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  bordered?: boolean;
};

export default function GlassSurface({
  children,
  style,
  intensity,
  bordered = true,
}: Props) {
  const { tokens } = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: tokens.colors.surfaceGlass,
          borderColor: bordered
            ? tokens.colors.glassBorder
            : 'transparent',
          borderWidth: bordered ? 1 : 0,
        },
        style,
      ]}
    >
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderRadius: 22,
  },
  content: {
    zIndex: 1,
  },
});
