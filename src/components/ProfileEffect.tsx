import React, { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

const PALETTES: Record<string, { glow: string; secondary: string; line: string }> = {
  neon3d: { glow: '#B45CFF', secondary: '#28D9F4', line: '#F3E8FF' },
  inferno3d: { glow: '#FF7A27', secondary: '#F43F5E', line: '#FFE1C2' },
  frost3d: { glow: '#38BDF8', secondary: '#A5F3FC', line: '#F0FDFF' },
  galaxy3d: { glow: '#9B6BFF', secondary: '#F472B6', line: '#EDE9FE' },
};
interface Props { value?: string | null; style?: StyleProp<ViewStyle>; children: React.ReactNode; variant?: 'hero' | 'compact' }

export default function ProfileEffect({ value, style, children, variant = 'hero' }: Props) {
  const palette = value ? PALETTES[value] : undefined;
  const compact = variant === 'compact';
  const pulse = useSharedValue(0);
  const rotate = useSharedValue(0);
  const counter = useSharedValue(0);
  const float = useSharedValue(0);
  useEffect(() => {
    if (!palette) return;
    pulse.value = withRepeat(withSequence(withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.ease) }), withTiming(0, { duration: 2200, easing: Easing.inOut(Easing.ease) })), -1, false);
    rotate.value = withRepeat(withTiming(360, { duration: 17000, easing: Easing.linear }), -1, false);
    if (!compact) counter.value = withRepeat(withTiming(-360, { duration: 24000, easing: Easing.linear }), -1, false);
    if (!compact) float.value = withRepeat(withSequence(withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.ease) }), withTiming(0, { duration: 2600, easing: Easing.inOut(Easing.ease) })), -1, false);
    return () => { pulse.value = 0; rotate.value = 0; counter.value = 0; float.value = 0; };
  }, [palette, compact, pulse, rotate, counter, float]);
  const aura = useAnimatedStyle(() => ({ opacity: 0.24 + pulse.value * 0.48, transform: [{ scale: 0.9 + pulse.value * 0.1 }] }));
  const spin = useAnimatedStyle(() => ({ transform: [{ rotate: rotate.value + 'deg' }] }));
  const reverseSpin = useAnimatedStyle(() => ({ transform: [{ rotate: counter.value + 'deg' }] }));
  const particle = useAnimatedStyle(() => ({ opacity: 0.28 + pulse.value * 0.72, transform: [{ translateY: float.value * -7 }, { scale: 0.7 + pulse.value * 0.4 }] }));
  if (!palette) return <View style={style}>{children}</View>;
  return (
    <View style={[styles.root, compact ? styles.compact : styles.avatar, style]}>
      <View pointerEvents="none" style={styles.effects}>
        <Animated.View style={[styles.halo, { borderColor: palette.glow, shadowColor: palette.glow }, aura]} />
        <Animated.View style={[styles.ringOuter, { borderColor: palette.line }, spin]}>
          <View style={[styles.orbitDot, { backgroundColor: palette.line, shadowColor: palette.glow }]} />
          <View style={[styles.orbitDotSmall, { backgroundColor: palette.secondary }]} />
        </Animated.View>
        {!compact && <Animated.View style={[styles.ringInner, { borderColor: palette.secondary }, reverseSpin]}>
          <View style={[styles.satellite, { backgroundColor: palette.line, shadowColor: palette.secondary }]} />
        </Animated.View>}
        {!compact && <>
          <Animated.View style={[styles.spark, styles.sparkOne, { backgroundColor: palette.line, shadowColor: palette.glow }, particle]} />
          <Animated.View style={[styles.spark, styles.sparkTwo, { backgroundColor: palette.secondary, shadowColor: palette.secondary }, particle]} />
          <Animated.View style={[styles.spark, styles.sparkThree, { backgroundColor: palette.line, shadowColor: palette.glow }, particle]} />
          <Animated.View style={[styles.spark, styles.sparkFour, { backgroundColor: palette.secondary, shadowColor: palette.glow }, particle]} />
        </>}
      </View>
      <View style={styles.content}>{children}</View>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { position: 'relative', alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  avatar: { width: 154, height: 154 },
  compact: { width: 56, height: 56 },
  effects: { ...StyleSheet.absoluteFill, zIndex: 0, alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  halo: { position: 'absolute', width: '82%', height: '82%', borderRadius: 999, borderWidth: 1.5, shadowOpacity: 0.9, shadowRadius: 25, shadowOffset: { width: 0, height: 0 }, elevation: 10 },
  ringOuter: { position: 'absolute', width: '98%', height: '98%', borderRadius: 999, borderWidth: 1.2, borderStyle: 'dashed', opacity: 0.78 },
  ringInner: { position: 'absolute', width: '76%', height: '76%', borderRadius: 999, borderWidth: 1, borderStyle: 'dotted', opacity: 0.64 },
  orbitDot: { position: 'absolute', top: 8, left: '50%', width: 7, height: 7, borderRadius: 4, shadowOpacity: 1, shadowRadius: 9, elevation: 8 },
  orbitDotSmall: { position: 'absolute', bottom: 12, right: 18, width: 4, height: 4, borderRadius: 2 },
  satellite: { position: 'absolute', bottom: 6, left: '50%', width: 5, height: 5, borderRadius: 3, shadowOpacity: 1, shadowRadius: 8 },
  spark: { position: 'absolute', width: 4, height: 4, borderRadius: 3, shadowOpacity: 1, shadowRadius: 9, elevation: 7 },
  sparkOne: { top: '15%', left: '19%' },
  sparkTwo: { top: '48%', right: '5%', width: 6, height: 6 },
  sparkThree: { bottom: '13%', right: '25%', width: 3, height: 3 },
  sparkFour: { top: '28%', right: '18%', width: 3, height: 3 },
  content: { position: 'relative', zIndex: 1 },
});
