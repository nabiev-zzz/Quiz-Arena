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
  const compact = variant === 'compact';
  const pulse = useSharedValue(0);
  const rotation = useSharedValue(0);
  const counterRotation = useSharedValue(0);
  const drift = useSharedValue(0);
  const sweep = useSharedValue(-1);

  useEffect(() => {
    if (!palette) return;
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2100, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 2100, easing: Easing.inOut(Easing.ease) }),
      ), -1, false,
    );
    rotation.value = withRepeat(withTiming(360, { duration: 19000, easing: Easing.linear }), -1, false);
    if (!compact) counterRotation.value = withRepeat(withTiming(360, { duration: 27000, easing: Easing.linear }), -1, false);
    if (!compact) drift.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 2800, easing: Easing.inOut(Easing.ease) }),
      ), -1, false,
    );
    if (!compact) sweep.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 3600, easing: Easing.inOut(Easing.ease) }),
        withTiming(-1, { duration: 3600, easing: Easing.inOut(Easing.ease) }),
      ), -1, false,
    );
    return () => {
      pulse.value = 0;
      rotation.value = 0;
      counterRotation.value = 0;
      drift.value = 0;
      sweep.value = -1;
    };
  }, [palette, compact, pulse, rotation, counterRotation, drift, sweep]);

  const auraStyle = useAnimatedStyle(() => ({
    opacity: 0.2 + pulse.value * 0.48,
    transform: [{ scale: 0.94 + pulse.value * 0.06 }],
  }));
  const orbitStyle = useAnimatedStyle(() => ({ transform: [{ rotate: rotation.value + 'deg' }] }));
  const counterOrbitStyle = useAnimatedStyle(() => ({ transform: [{ rotate: -counterRotation.value + 'deg' }] }));
  const particleStyle = useAnimatedStyle(() => ({
    opacity: 0.22 + pulse.value * 0.78,
    transform: [{ translateY: drift.value * -9 }, { scale: 0.68 + pulse.value * 0.52 }],
  }));
  const sweepStyle = useAnimatedStyle(() => ({
    opacity: 0.05 + pulse.value * 0.19,
    transform: [{ translateX: sweep.value * 42 }, { rotate: '-24deg' }],
  }));

  if (!palette) return <View style={style}>{children}</View>;

  return (
    <View style={[styles.root, compact ? styles.compactStage : styles.heroStage, style]}>
      <View pointerEvents="none" style={styles.effectLayer}>
        <Animated.View style={[styles.aura, { borderColor: palette.glow, shadowColor: palette.glow }, auraStyle]} />
        <Animated.View style={[styles.orbit, compact && styles.compactOrbit, { borderColor: palette.line }, orbitStyle]}>
          <View style={[styles.comet, { backgroundColor: palette.line, shadowColor: palette.glow }]} />
          <View style={[styles.orbitSpark, { backgroundColor: palette.secondary }]} />
        </Animated.View>
        <Animated.View style={[styles.counterOrbit, compact && styles.compactCounterOrbit, { borderColor: palette.secondary }, counterOrbitStyle]}>
          <View style={[styles.satellite, { backgroundColor: palette.line, shadowColor: palette.secondary }]} />
        </Animated.View>
        {!compact && (
          <>
            <Animated.View style={[styles.outerOrbit, { borderColor: palette.glow + '75' }, orbitStyle]} />
            <LinearGradient
              colors={[palette.deep + '00', palette.glow + '32', palette.secondary + '22', palette.deep + '00']}
              start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
              style={styles.energyBeam}
            />
            <LinearGradient
              colors={['transparent', palette.glow + '25', palette.secondary + '18', 'transparent']}
              start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
              style={styles.energySweep}
            />
            <Animated.View style={[styles.sweep, { backgroundColor: palette.line }, sweepStyle]} />
            <LinearGradient
              colors={[palette.glow + '20', palette.secondary + '0D', 'transparent']}
              start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
              style={styles.wash}
            />
            <View style={[styles.highlight, { backgroundColor: palette.line }]} />
          </>
        )}
        {!compact && <>
          <Animated.View style={[styles.particle, styles.particleOne, { backgroundColor: palette.line, shadowColor: palette.glow }, particleStyle]} />
          <Animated.View style={[styles.particle, styles.particleTwo, { backgroundColor: palette.secondary, shadowColor: palette.secondary }, particleStyle]} />
          <Animated.View style={[styles.particle, styles.particleThree, { backgroundColor: palette.line, shadowColor: palette.glow }, particleStyle]} />
        </>}
        {!compact && (
          <>
            <Animated.View style={[styles.particle, styles.particleFour, { backgroundColor: palette.secondary, shadowColor: palette.glow }, particleStyle]} />
            <Animated.View style={[styles.particle, styles.particleFive, { backgroundColor: palette.line, shadowColor: palette.secondary }, particleStyle]} />
            <Animated.View style={[styles.particle, styles.crystalOne, { backgroundColor: palette.line, shadowColor: palette.secondary }, particleStyle]} />
            <Animated.View style={[styles.particle, styles.crystalTwo, { backgroundColor: palette.secondary, shadowColor: palette.glow }, particleStyle]} />
          </>
        )}
      </View>
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'relative', alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  heroStage: { width: 184, height: 184 },
  compactStage: { width: 56, height: 56 },
  effectLayer: { ...StyleSheet.absoluteFill, zIndex: 0, overflow: 'visible', alignItems: 'center', justifyContent: 'center' },
  aura: {
    position: 'absolute', width: '91%', height: '91%', borderWidth: 1.3, borderRadius: 999,
    shadowOpacity: 0.95, shadowRadius: 28, shadowOffset: { width: 0, height: 0 }, elevation: 12,
  },
  orbit: { position: 'absolute', width: 150, height: 150, borderWidth: 1.25, borderStyle: 'dashed', borderRadius: 75, opacity: 0.8 },
  compactOrbit: { width: '100%', height: '100%', borderRadius: 999, borderWidth: 1.2 },
  comet: { position: 'absolute', top: 8, left: '50%', width: 7, height: 7, borderRadius: 4, shadowOpacity: 1, shadowRadius: 10, elevation: 8 },
  orbitSpark: { position: 'absolute', bottom: 19, right: 9, width: 4, height: 4, borderRadius: 2, opacity: 0.9 },
  counterOrbit: { position: 'absolute', width: 128, height: 128, borderWidth: 1, borderStyle: 'dotted', borderRadius: 64, opacity: 0.58 },
  compactCounterOrbit: { width: '82%', height: '82%', borderRadius: 999, borderWidth: 1 },
  satellite: { position: 'absolute', bottom: 7, left: '50%', width: 5, height: 5, borderRadius: 3, shadowOpacity: 1, shadowRadius: 8 },
  outerOrbit: { position: 'absolute', width: 174, height: 174, borderWidth: 1, borderRadius: 87, borderStyle: 'solid', opacity: 0.24 },
  energyBeam: { position: 'absolute', width: 190, height: 36, borderRadius: 20, opacity: 0.78 },
  energySweep: { position: 'absolute', width: 210, height: 52, borderRadius: 30, opacity: 0.7 },
  sweep: { position: 'absolute', width: 2, height: 112, borderRadius: 2, opacity: 0.2 },
  wash: { ...StyleSheet.absoluteFill, borderRadius: 999 },
  highlight: { position: 'absolute', top: 13, width: 58, height: 1, opacity: 0.38 },
  particle: { position: 'absolute', width: 5, height: 5, borderRadius: 3, shadowOpacity: 1, shadowRadius: 10, elevation: 8 },
  particleOne: { top: 23, left: 25 },
  particleTwo: { top: '47%', right: 16, width: 7, height: 7, borderRadius: 4 },
  particleThree: { bottom: 25, right: 39, width: 4, height: 4 },
  particleFour: { top: 35, right: 45, width: 3, height: 3 },
  particleFive: { bottom: 39, left: 47, width: 6, height: 6 },
  crystalOne: { top: 61, left: 13, width: 4, height: 4, borderRadius: 0, transform: [{ rotate: '45deg' }] },
  crystalTwo: { bottom: 61, right: 15, width: 4, height: 4, borderRadius: 0, transform: [{ rotate: '45deg' }] },
  content: { position: 'relative', zIndex: 1 },
});
