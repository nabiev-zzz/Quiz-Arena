import React, { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

const PALETTES: Record<string, { glow: string; secondary: string; line: string; deep: string }> = {
  neon3d: { glow: '#B45CFF', secondary: '#28D9F4', line: '#F3E8FF', deep: '#4C1D95' },
  inferno3d: { glow: '#FF7A27', secondary: '#F43F5E', line: '#FFE1C2', deep: '#7C2D12' },
  frost3d: { glow: '#38BDF8', secondary: '#A5F3FC', line: '#F0FDFF', deep: '#075985' },
  galaxy3d: { glow: '#9B6BFF', secondary: '#F472B6', line: '#EDE9FE', deep: '#312E81' },
};

interface ProfileEffectProps {
  value?: string | null;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
  variant?: 'hero' | 'compact';
}

export default function ProfileEffect({ value, style, children, variant = 'hero' }: ProfileEffectProps) {
  const palette = value ? PALETTES[value] : undefined;
  const pulse = useSharedValue(0);
  const rotation = useSharedValue(0);
  const drift = useSharedValue(0);

  useEffect(() => {
    if (!palette) return;
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1900, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1900, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
    rotation.value = withRepeat(withTiming(360, { duration: 18000, easing: Easing.linear }), -1, false);
    drift.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 2600, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [palette, pulse, rotation, drift]);

  const auraStyle = useAnimatedStyle(() => ({
    opacity: 0.24 + pulse.value * 0.42,
    transform: [{ scale: 0.985 + pulse.value * 0.025 }],
  }));
  const orbitStyle = useAnimatedStyle(() => ({ transform: [{ rotate: rotation.value + 'deg' }] }));
  const counterOrbitStyle = useAnimatedStyle(() => ({ transform: [{ rotate: -rotation.value * 0.72 + 'deg' }] }));
  const particleStyle = useAnimatedStyle(() => ({
    opacity: 0.28 + pulse.value * 0.72,
    transform: [{ translateY: drift.value * -5 }, { scale: 0.72 + pulse.value * 0.48 }],
  }));
  const beamStyle = useAnimatedStyle(() => ({
    opacity: 0.08 + pulse.value * 0.17,
    transform: [{ rotate: '-18deg' }, { translateX: drift.value * 18 }],
  }));

  if (!palette) return <View style={style}>{children}</View>;

  const compact = variant === 'compact';
  return (
    <View style={[styles.root, style, compact && styles.compactRoot]}>
      <View pointerEvents="none" style={[styles.effectLayer, compact && styles.compactLayer]}>
        <Animated.View style={[styles.aura, compact && styles.compactAura, { borderColor: palette.glow, shadowColor: palette.glow }, auraStyle]} />
        <Animated.View style={[styles.orbit, compact && styles.compactOrbit, { borderColor: palette.line }, orbitStyle]}>
          <View style={[styles.orbitDot, { backgroundColor: palette.line, shadowColor: palette.glow }]} />
        </Animated.View>
        <Animated.View style={[styles.counterOrbit, compact && styles.compactCounterOrbit, { borderColor: palette.secondary }, counterOrbitStyle]} />
        {!compact && (
          <>
            <LinearGradient
              colors={[palette.deep + '00', palette.glow + '30', palette.secondary + '18', palette.deep + '00']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.energyBeam}
            />
            <LinearGradient
              colors={[palette.glow + '26', palette.secondary + '10', 'transparent']}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={styles.wash}
            />
            <View style={[styles.topSheen, { backgroundColor: palette.line }]} />
          </>
        )}
        <Animated.View style={[styles.particle, styles.particleOne, { backgroundColor: palette.line, shadowColor: palette.glow }, particleStyle]} />
        <Animated.View style={[styles.particle, styles.particleTwo, { backgroundColor: palette.secondary, shadowColor: palette.secondary }, particleStyle]} />
        <Animated.View style={[styles.particle, styles.particleThree, { backgroundColor: palette.line, shadowColor: palette.glow }, particleStyle]} />
        {!compact && (
          <>
            <Animated.View style={[styles.particle, styles.particleFour, { backgroundColor: palette.secondary, shadowColor: palette.glow }, particleStyle]} />
            <Animated.View style={[styles.particle, styles.particleFive, { backgroundColor: palette.line, shadowColor: palette.secondary }, particleStyle]} />
            <Animated.View style={[styles.beam, { backgroundColor: palette.line }, beamStyle]} />
          </>
        )}
      </View>
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'relative', overflow: 'visible' },
  compactRoot: { alignItems: 'center', justifyContent: 'center' },
  effectLayer: { ...StyleSheet.absoluteFill, zIndex: 0, overflow: 'visible', borderRadius: 28 },
  compactLayer: { borderRadius: 999 },
  aura: {
    ...StyleSheet.absoluteFill,
    borderWidth: 1.2,
    borderRadius: 28,
    shadowOpacity: 0.95,
    shadowRadius: 27,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  compactAura: { borderRadius: 999, borderWidth: 1.5, shadowRadius: 14 },
  orbit: {
    position: 'absolute',
    top: -15,
    right: 16,
    width: 62,
    height: 62,
    borderWidth: 1.3,
    borderStyle: 'dashed',
    borderRadius: 31,
    opacity: 0.78,
  },
  compactOrbit: { top: -5, right: -5, width: '112%', height: '112%', borderRadius: 999, borderWidth: 1.2 },
  orbitDot: { position: 'absolute', top: 3, left: '50%', width: 5, height: 5, borderRadius: 3, shadowOpacity: 1, shadowRadius: 8, elevation: 6 },
  counterOrbit: {
    position: 'absolute',
    left: 10,
    bottom: -12,
    width: 54,
    height: 54,
    borderWidth: 1,
    borderRadius: 27,
    borderStyle: 'dotted',
    opacity: 0.58,
  },
  compactCounterOrbit: { left: -4, bottom: -4, width: '112%', height: '112%', borderRadius: 999, borderWidth: 1 },
  energyBeam: { position: 'absolute', left: -18, right: -18, top: '43%', height: 26, borderRadius: 18 },
  wash: { ...StyleSheet.absoluteFill, borderRadius: 28 },
  topSheen: { position: 'absolute', top: 0, left: 24, right: 24, height: 1, opacity: 0.32 },
  particle: { position: 'absolute', width: 5, height: 5, borderRadius: 3, shadowOpacity: 1, shadowRadius: 10, elevation: 8 },
  particleOne: { top: 13, left: 20 },
  particleTwo: { top: '48%', right: 9, width: 7, height: 7, borderRadius: 4 },
  particleThree: { bottom: 15, right: 34, width: 4, height: 4 },
  particleFour: { top: 24, right: 42, width: 3, height: 3 },
  particleFive: { bottom: 28, left: 48, width: 6, height: 6 },
  beam: { position: 'absolute', width: 1, height: '74%', top: '13%', left: '51%', opacity: 0.16 },
  content: { position: 'relative', zIndex: 1 },
});
