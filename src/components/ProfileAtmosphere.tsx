import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

const COLORS: Record<string, { a: string; b: string; c: string }> = {
  neon3d: { a: '#C084FC', b: '#22D3EE', c: '#7C3AED' },
  inferno3d: { a: '#FB923C', b: '#FB365D', c: '#FDE047' },
  frost3d: { a: '#38BDF8', b: '#CFFAFE', c: '#2563EB' },
  galaxy3d: { a: '#A78BFA', b: '#F472B6', c: '#6366F1' },
};

export default function ProfileAtmosphere({ value }: { value?: string | null }) {
  const colors = value ? COLORS[value] : undefined;
  const reveal = useSharedValue(0);
  const rotation = useSharedValue(0);
  const surge = useSharedValue(0);
  const drift = useSharedValue(0);

  useEffect(() => {
    if (!colors) return;
    // 0.55s entrance + 3.45s hold + 0.5s exit + 1.5s pause = 6s loop.
    reveal.value = withRepeat(withSequence(
      withTiming(1, { duration: 550, easing: Easing.out(Easing.back(1.7)) }),
      withTiming(1, { duration: 3450 }),
      withTiming(0, { duration: 500, easing: Easing.in(Easing.cubic) }),
      withTiming(0, { duration: 1500 }),
    ), -1, false);
    rotation.value = withRepeat(withTiming(360, { duration: 6000, easing: Easing.linear }), -1, false);
    surge.value = withRepeat(withSequence(withTiming(1, { duration: 650 }), withTiming(0.18, { duration: 3350 }), withTiming(0, { duration: 500 }), withTiming(0, { duration: 1500 })), -1, false);
    drift.value = withRepeat(withSequence(withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration: 3000, easing: Easing.inOut(Easing.sin) })), -1, false);
    return () => { reveal.value = 0; rotation.value = 0; surge.value = 0; drift.value = 0; };
  }, [colors, reveal, rotation, surge, drift]);

  const stage = useAnimatedStyle(() => ({
    opacity: reveal.value,
    transform: [{ scale: 0.72 + reveal.value * 0.34 }, { translateY: (1 - reveal.value) * 42 }],
  }));
  const spin = useAnimatedStyle(() => ({ transform: [{ rotate: rotation.value + 'deg' }, { scale: 0.88 + surge.value * 0.18 }] }));
  const reverse = useAnimatedStyle(() => ({ transform: [{ rotate: -rotation.value + 'deg' }, { translateX: drift.value * 24 }] }));
  const flash = useAnimatedStyle(() => ({ opacity: surge.value * 0.75, transform: [{ scaleX: 0.35 + surge.value * 1.25 }] }));
  const leftBeam = useAnimatedStyle(() => ({ opacity: surge.value * 0.85, transform: [{ translateX: (1 - reveal.value) * -180 }, { rotate: '-18deg' }] }));
  const rightBeam = useAnimatedStyle(() => ({ opacity: surge.value * 0.85, transform: [{ translateX: (1 - reveal.value) * 180 }, { rotate: '18deg' }] }));

  if (!colors) return null;
  return (
    <View pointerEvents="none" style={styles.overlay}>
      <Animated.View style={[styles.fullStage, stage]}>
        <Animated.View style={[styles.halo, { backgroundColor: colors.a, shadowColor: colors.a }, flash]} />
        <Animated.View style={[styles.orbit, spin]}>
          <View style={[styles.orbitLine, { borderColor: colors.a }]} />
          <View style={[styles.orbitLine, styles.orbitLineTwo, { borderColor: colors.b }]} />
          <View style={[styles.orbitLine, styles.orbitLineThree, { borderColor: colors.c }]} />
          {[0, 1, 2, 3, 4, 5].map((item) => (
            <View key={item} style={[styles.orbitSpark, { backgroundColor: item % 2 ? colors.b : colors.a, shadowColor: item % 2 ? colors.b : colors.a }, item === 0 ? styles.sparkTop : item === 1 ? styles.sparkRight : item === 2 ? styles.sparkBottom : item === 3 ? styles.sparkLeft : item === 4 ? styles.sparkUpper : styles.sparkLower]} />
          ))}
        </Animated.View>
        <Animated.View style={[styles.energySweep, { backgroundColor: colors.b, shadowColor: colors.b }, leftBeam]} />
        <Animated.View style={[styles.energySweep, styles.energySweepRight, { backgroundColor: colors.a, shadowColor: colors.a }, rightBeam]} />
        <Animated.View style={[styles.energyCore, { borderColor: colors.b, shadowColor: colors.a }, reverse]}>
          <View style={[styles.coreDot, { backgroundColor: colors.a }]} />
          <View style={[styles.coreDot, styles.coreDotTwo, { backgroundColor: colors.b }]} />
          <View style={[styles.coreDot, styles.coreDotThree, { backgroundColor: colors.c }]} />
        </Animated.View>
        <Animated.View style={[styles.lightColumn, { backgroundColor: colors.a, shadowColor: colors.a }, flash]} />
        <Animated.View style={[styles.lightColumn, styles.lightColumnTwo, { backgroundColor: colors.b, shadowColor: colors.b }, flash]} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 80, elevation: 80, overflow: 'hidden' },
  fullStage: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', width: '135%', height: '48%', borderRadius: 999, opacity: 0.28, shadowOpacity: 1, shadowRadius: 100, elevation: 20 },
  orbit: { position: 'absolute', width: '145%', height: '82%', alignItems: 'center', justifyContent: 'center' },
  orbitLine: { position: 'absolute', width: '92%', height: '66%', borderWidth: 2, borderRadius: 999, opacity: 0.45, transform: [{ rotate: '18deg' }] },
  orbitLineTwo: { width: '110%', height: '42%', borderWidth: 1.5, opacity: 0.55, transform: [{ rotate: '-24deg' }] },
  orbitLineThree: { width: '75%', height: '92%', borderWidth: 1, opacity: 0.35, transform: [{ rotate: '55deg' }] },
  orbitSpark: { position: 'absolute', width: 9, height: 9, borderRadius: 8, shadowOpacity: 1, shadowRadius: 18, elevation: 16 },
  sparkTop: { top: '7%', left: '48%' },
  sparkRight: { top: '49%', right: '5%', width: 6, height: 6 },
  sparkBottom: { bottom: '8%', left: '43%', width: 5, height: 5 },
  sparkLeft: { top: '42%', left: '4%', width: 7, height: 7 },
  sparkUpper: { top: '20%', right: '22%', width: 4, height: 4 },
  sparkLower: { bottom: '20%', left: '23%', width: 4, height: 4 },
  energySweep: { position: 'absolute', width: '150%', height: 5, borderRadius: 8, opacity: 0.6, shadowOpacity: 1, shadowRadius: 25, elevation: 18 },
  energySweepRight: { height: 3 },
  energyCore: { position: 'absolute', width: '66%', height: '45%', borderWidth: 1, borderRadius: 999, opacity: 0.24, alignItems: 'center', justifyContent: 'center' },
  coreDot: { position: 'absolute', top: 0, width: 7, height: 7, borderRadius: 5, shadowOpacity: 1, shadowRadius: 10 },
  coreDotTwo: { top: undefined, bottom: 0, left: '25%' },
  coreDotThree: { top: '50%', left: 0, width: 4, height: 4 },
  lightColumn: { position: 'absolute', width: 3, height: '120%', opacity: 0.18, shadowOpacity: 1, shadowRadius: 20 },
  lightColumnTwo: { width: 2, transform: [{ rotate: '32deg' }] },
});
