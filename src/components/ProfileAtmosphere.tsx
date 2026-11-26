import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

const COLORS: Record<string, { a: string; b: string; c: string }> = {
  neon3d: { a: '#A855F7', b: '#22D3EE', c: '#7C3AED' },
  inferno3d: { a: '#F97316', b: '#F43F5E', c: '#FBBF24' },
  frost3d: { a: '#38BDF8', b: '#A5F3FC', c: '#2563EB' },
  galaxy3d: { a: '#8B5CF6', b: '#EC4899', c: '#6366F1' },
};

export default function ProfileAtmosphere({ value }: { value?: string | null }) {
  const colors = value ? COLORS[value] : undefined;
  const drift = useSharedValue(0);
  const turn = useSharedValue(0);
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (!colors) return;
    drift.value = withRepeat(withSequence(withTiming(1, { duration: 8500, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration: 8500, easing: Easing.inOut(Easing.sin) })), -1, false);
    turn.value = withRepeat(withTiming(360, { duration: 52000, easing: Easing.linear }), -1, false);
    pulse.value = withRepeat(withSequence(withTiming(1, { duration: 5000 }), withTiming(0, { duration: 5000 })), -1, false);
    return () => { drift.value = 0; turn.value = 0; pulse.value = 0; };
  }, [colors, drift, turn, pulse]);
  const cloudA = useAnimatedStyle(() => ({ opacity: 0.09 + pulse.value * 0.09, transform: [{ translateX: drift.value * 34 }, { translateY: drift.value * -22 }, { scale: 0.92 + pulse.value * 0.12 }] }));
  const cloudB = useAnimatedStyle(() => ({ opacity: 0.06 + pulse.value * 0.08, transform: [{ translateX: drift.value * -28 }, { translateY: drift.value * 30 }, { scale: 1.08 - pulse.value * 0.1 }] }));
  const orbit = useAnimatedStyle(() => ({ transform: [{ rotate: turn.value + 'deg' }] }));
  if (!colors) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View style={[styles.cloud, styles.cloudA, { backgroundColor: colors.a, shadowColor: colors.a }, cloudA]} />
      <Animated.View style={[styles.cloud, styles.cloudB, { backgroundColor: colors.b, shadowColor: colors.b }, cloudB]} />
      <Animated.View style={[styles.cloud, styles.cloudC, { backgroundColor: colors.c, shadowColor: colors.c }, cloudB]} />
      <Animated.View style={[styles.orbit, orbit]}>
        <View style={[styles.orbitTrace, { borderColor: colors.a }]} />
        <View style={[styles.orbitTrace, styles.traceSecond, { borderColor: colors.b }]} />
        <View style={[styles.star, styles.starOne, { backgroundColor: colors.a, shadowColor: colors.a }]} />
        <View style={[styles.star, styles.starTwo, { backgroundColor: colors.b, shadowColor: colors.b }]} />
        <View style={[styles.star, styles.starThree, { backgroundColor: colors.c, shadowColor: colors.c }]} />
      </Animated.View>
      <View style={[styles.edgeGlow, styles.edgeTop, { backgroundColor: colors.a }]} />
      <View style={[styles.edgeGlow, styles.edgeBottom, { backgroundColor: colors.b }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  cloud: { position: 'absolute', width: 230, height: 230, borderRadius: 130, opacity: 0.1, shadowOpacity: 0.8, shadowRadius: 65, elevation: 8 },
  cloudA: { top: 70, left: -125 },
  cloudB: { top: '38%', right: -145 },
  cloudC: { bottom: 65, left: '20%', width: 180, height: 180, opacity: 0.07 },
  orbit: { position: 'absolute', width: 310, height: 510, top: '15%', left: '50%', marginLeft: -155, alignItems: 'center', justifyContent: 'center', opacity: 0.16 },
  orbitTrace: { position: 'absolute', width: 285, height: 430, borderWidth: 1, borderRadius: 220, transform: [{ rotate: '32deg' }] },
  traceSecond: { width: 210, height: 510, transform: [{ rotate: '-38deg' }], opacity: 0.7 },
  star: { position: 'absolute', width: 4, height: 4, borderRadius: 3, shadowOpacity: 1, shadowRadius: 9, elevation: 5 },
  starOne: { top: 35, left: 66 },
  starTwo: { right: 16, top: '48%', width: 5, height: 5 },
  starThree: { bottom: 45, left: 30, width: 3, height: 3 },
  edgeGlow: { position: 'absolute', left: '12%', right: '12%', height: 1, opacity: 0.14 },
  edgeTop: { top: '19%' },
  edgeBottom: { bottom: '17%' },
});
