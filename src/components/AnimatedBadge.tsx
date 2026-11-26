import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

type BadgeTheme = {
  icon: keyof typeof Ionicons.glyphMap;
  colors: readonly [string, string, string];
  rim: string;
  glow: string;
  shine: string;
};

const THEMES: Record<string, BadgeTheme> = {
  legend: { icon: 'ribbon', colors: ['#FFF1A8', '#D99B22', '#70420C'], rim: '#FFE9A0', glow: '#FBBF24', shine: '#FFFBE8' },
  champion: { icon: 'trophy', colors: ['#FFE3A3', '#E18A18', '#71320D'], rim: '#FFD58A', glow: '#F59E0B', shine: '#FFFFFF' },
  scholar: { icon: 'book', colors: ['#BDEBFF', '#3188D8', '#153B78'], rim: '#B9E7FF', glow: '#38BDF8', shine: '#FFFFFF' },
  streak: { icon: 'flame', colors: ['#FFD0A1', '#E64B36', '#721D27'], rim: '#FFC09A', glow: '#FB654B', shine: '#FFF5E8' },
  mythic: { icon: 'diamond', colors: ['#E8D5FF', '#9656E8', '#35115F'], rim: '#E9D5FF', glow: '#A855F7', shine: '#FFFFFF' },
  phoenix: { icon: 'flame', colors: ['#FFE0A3', '#F05A28', '#741D16'], rim: '#FFD28A', glow: '#F97316', shine: '#FFF9E8' },
  cyber: { icon: 'hardware-chip', colors: ['#B7FBFF', '#16A6B8', '#06445B'], rim: '#A5F3FC', glow: '#22D3EE', shine: '#FFFFFF' },
  celestial: { icon: 'sparkles', colors: ['#FCE7FF', '#C05BCE', '#54156E'], rim: '#F5D0FE', glow: '#E879F9', shine: '#FFFFFF' },
};

interface AnimatedBadgeProps {
  value: string;
  size?: number;
  animated?: boolean;
}

export default function AnimatedBadge({ value, size = 64, animated = true }: AnimatedBadgeProps) {
  const theme = THEMES[value] ?? THEMES.legend;
  const rotation = useSharedValue(0);
  const pulse = useSharedValue(0);
  const shimmer = useSharedValue(-1);

  useEffect(() => {
    if (!animated) return;
    rotation.value = withRepeat(withTiming(360, { duration: 18000, easing: Easing.linear }), -1, false);
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
    shimmer.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
        withTiming(-1, { duration: 900 }),
      ),
      -1,
      false,
    );
  }, [animated, pulse, rotation, shimmer]);

  const auraStyle = useAnimatedStyle(() => ({
    opacity: animated ? 0.22 + pulse.value * 0.32 : 0.18,
    transform: [{ scale: animated ? 0.92 + pulse.value * 0.12 : 1 }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: (animated ? rotation.value : 0) + 'deg' }],
  }));
  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: animated ? 0.08 + pulse.value * 0.24 : 0.1,
    transform: [{ translateX: animated ? shimmer.value * size * 0.72 : -size }],
  }));

  const compact = size < 48;
  const medalSize = size * 0.82;
  const iconSize = size * 0.43;

  return (
    <View style={[styles.root, { width: size, height: size }]}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.aura,
          { width: medalSize * 1.1, height: medalSize * 1.1, borderRadius: medalSize, borderColor: theme.glow },
          auraStyle,
        ]}
      />
      {!compact ? (
        <>
          <View style={[styles.ribbon, styles.ribbonLeft, { borderBottomColor: theme.colors[2] }]} />
          <View style={[styles.ribbon, styles.ribbonRight, { borderBottomColor: theme.colors[1] }]} />
        </>
      ) : null}
      <View style={[styles.medalShadow, { width: medalSize, height: medalSize, borderRadius: medalSize * 0.34, shadowColor: theme.glow }]}>
        <LinearGradient
          colors={[theme.rim, theme.colors[1], theme.colors[2]]}
          start={{ x: 0.08, y: 0.05 }}
          end={{ x: 0.9, y: 1 }}
          style={[styles.medalOuter, { borderRadius: medalSize * 0.34, padding: Math.max(2, size * 0.045) }]}
        >
          <LinearGradient
            colors={theme.colors}
            start={{ x: 0.15, y: 0 }}
            end={{ x: 0.85, y: 1 }}
            style={[styles.medalFace, { borderRadius: medalSize * 0.29 }]}
          >
            <View style={[styles.innerRim, { borderColor: theme.rim, borderRadius: medalSize * 0.26 }]} />
            <Animated.View
              pointerEvents="none"
              style={[
                styles.shimmer,
                { width: medalSize * 0.32, height: medalSize * 1.5, backgroundColor: theme.shine },
                shimmerStyle,
              ]}
            />
            <Ionicons
              name={theme.icon}
              size={iconSize}
              color="#FFF9E8"
              style={{ zIndex: 3, textShadowColor: theme.colors[2], textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 }}
            />
            {!compact ? <View style={[styles.stud, styles.studTop, { backgroundColor: theme.rim }]} /> : null}
            {!compact ? <View style={[styles.stud, styles.studBottom, { backgroundColor: theme.rim }]} /> : null}
          </LinearGradient>
        </LinearGradient>
      </View>
      {!compact ? (
        <>
          <Animated.View style={[styles.orbit, { width: medalSize * 1.02, height: medalSize * 1.02, borderColor: theme.rim }, ringStyle]} />
          <View style={[styles.spark, styles.sparkTop, { backgroundColor: theme.shine }]} />
          <View style={[styles.spark, styles.sparkSide, { backgroundColor: theme.rim }]} />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'visible' },
  aura: { position: 'absolute', borderWidth: 2 },
  ribbon: { position: 'absolute', bottom: 0, width: '20%', height: '34%', borderLeftWidth: 2, borderRightWidth: 2, borderBottomWidth: 8, borderLeftColor: 'rgba(255,255,255,0.18)', borderRightColor: 'rgba(0,0,0,0.2)', zIndex: 0 },
  ribbonLeft: { left: '29%', transform: [{ rotate: '12deg' }] },
  ribbonRight: { right: '29%', transform: [{ rotate: '-12deg' }] },
  medalShadow: { alignItems: 'center', justifyContent: 'center', shadowOpacity: 0.7, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 9, zIndex: 2 },
  medalOuter: { width: '100%', height: '100%', borderWidth: 1.2, borderTopColor: 'rgba(255,255,255,0.9)', borderLeftColor: 'rgba(255,255,255,0.55)', borderRightColor: 'rgba(0,0,0,0.42)', borderBottomColor: 'rgba(0,0,0,0.48)' },
  medalFace: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' },
  innerRim: { ...StyleSheet.absoluteFillObject, borderWidth: 1.1, opacity: 0.8, margin: 3 },
  shimmer: { position: 'absolute', top: '-20%', left: '36%', transform: [{ rotate: '24deg' }], borderRadius: 99 },
  stud: { position: 'absolute', width: 4, height: 4, borderRadius: 2, opacity: 0.9 },
  studTop: { top: 5, left: '50%', marginLeft: -2 },
  studBottom: { bottom: 5, left: '50%', marginLeft: -2 },
  orbit: { position: 'absolute', borderWidth: 1, borderStyle: 'dashed', borderRadius: 999, opacity: 0.65 },
  spark: { position: 'absolute', width: 4, height: 4, borderRadius: 2, zIndex: 4 },
  sparkTop: { top: '9%', right: '20%' },
  sparkSide: { bottom: '18%', left: '13%', width: 3, height: 3 },
});
