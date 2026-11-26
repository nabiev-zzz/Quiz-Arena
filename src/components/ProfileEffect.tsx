import React, { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

const PALETTES: Record<string, { glow: string; secondary: string; line: string }> = {
  neon3d: { glow: '#A855F7', secondary: '#22D3EE', line: '#E9D5FF' },
  inferno3d: { glow: '#F97316', secondary: '#EF4444', line: '#FED7AA' },
  frost3d: { glow: '#38BDF8', secondary: '#A5F3FC', line: '#E0F2FE' },
  galaxy3d: { glow: '#8B5CF6', secondary: '#EC4899', line: '#DDD6FE' },
};

interface ProfileEffectProps {
  value?: string | null;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

export default function ProfileEffect({ value, style, children }: ProfileEffectProps) {
  const palette = value ? PALETTES[value] : undefined;
  const progress = useSharedValue(0);
  const orbit = useSharedValue(0);

  useEffect(() => {
    if (!palette) return;
    progress.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1750, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1750, easing: Easing.inOut(Easing.ease) }),
      ), -1, false,
    );
    orbit.value = withRepeat(withTiming(360, { duration: 14000, easing: Easing.linear }), -1, false);
  }, [palette, progress, orbit]);

  const auraStyle = useAnimatedStyle(() => ({
    opacity: 0.22 + progress.value * 0.28,
    transform: [{ scale: 0.97 + progress.value * 0.035 }],
  }));
  const orbitStyle = useAnimatedStyle(() => ({ transform: [{ rotate: orbit.value + 'deg' }] }));
  const sparkleStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + progress.value * 0.65,
    transform: [{ scale: 0.75 + progress.value * 0.5 }],
  }));

  return (
    <View style={[styles.root, style]}>
      {palette ? (
        <View pointerEvents="none" style={styles.effectLayer}>
          <Animated.View style={[styles.aura, { shadowColor: palette.glow, borderColor: palette.glow }, auraStyle]} />
          <Animated.View style={[styles.orbit, { borderColor: palette.line }, orbitStyle]} />
          <LinearGradient
            colors={[palette.glow + '35', palette.secondary + '18', 'transparent']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.wash}
          />
          <Animated.View style={[styles.sparkle, styles.sparkleOne, { backgroundColor: palette.line, shadowColor: palette.glow }, sparkleStyle]} />
          <Animated.View style={[styles.sparkle, styles.sparkleTwo, { backgroundColor: palette.secondary, shadowColor: palette.secondary }, sparkleStyle]} />
          <Animated.View style={[styles.sparkle, styles.sparkleThree, { backgroundColor: palette.line, shadowColor: palette.glow }, sparkleStyle]} />
        </View>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'relative', overflow: 'visible' },
  effectLayer: { ...StyleSheet.absoluteFillObject, zIndex: 0, overflow: 'visible', borderRadius: 28 },
  aura: { ...StyleSheet.absoluteFillObject, borderWidth: 1.5, borderRadius: 28, shadowOpacity: 0.95, shadowRadius: 24, shadowOffset: { width: 0, height: 0 }, elevation: 12 },
  orbit: { position: 'absolute', top: -9, right: 12, width: 48, height: 48, borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 24, opacity: 0.8 },
  wash: { ...StyleSheet.absoluteFillObject, borderRadius: 28, opacity: 0.8 },
  sparkle: { position: 'absolute', width: 6, height: 6, borderRadius: 3, shadowOpacity: 1, shadowRadius: 12, elevation: 8 },
  sparkleOne: { top: 15, left: 22 },
  sparkleTwo: { top: 52, right: 16, width: 8, height: 8, borderRadius: 4 },
  sparkleThree: { bottom: 18, right: 38, width: 4, height: 4, borderRadius: 2 },
});
