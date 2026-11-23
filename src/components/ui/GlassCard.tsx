import React from 'react';
import {
  StyleProp,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import GlassSurface from './GlassSurface';
import { useTheme } from '../../theme/ThemeContext';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padding?: number;
  radius?: number;
  intensity?: number;
};

export default function GlassCard({
  children,
  style,
  padding = 16,
  radius,
  intensity,
}: Props) {
  const { tokens } = useTheme();

  return (
    <GlassSurface
      intensity={intensity}
      style={[
        styles.card,
        {
          padding,
          borderRadius: radius ?? tokens.radius.lg,
          shadowColor: tokens.shadows.card.color,
          shadowOpacity: tokens.shadows.card.opacity,
          shadowRadius: tokens.shadows.card.radius,
          shadowOffset: tokens.shadows.card.offset,
          elevation: tokens.shadows.card.elevation,
        },
        style,
      ]}
    >
      {children}
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
  },
});
