import React, { useEffect, useMemo } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

interface LaurelWreathAvatarProps {
  imageUri?: string | null;
  initials?: string;
  size?: number;
  frameColor?: string;
}

const CENTER = 150;
const RADIUS = 80;
const START_ANGLE = 195;
const END_ANGLE = 322;
const LEAF_COUNT = 11;

function pointAt(degrees: number, radius: number) {
  const angle = (degrees * Math.PI) / 180;
  return {
    x: CENTER + radius * Math.sin(angle),
    y: CENTER - radius * Math.cos(angle),
  };
}

/** Animated laurel wreath avatar, implemented with native React Native views. */
export default function LaurelWreathAvatar({
  imageUri,
  initials = 'U',
  size = 150,
  frameColor = '#FBBF24',
}: LaurelWreathAvatarProps) {
  const growth = useSharedValue(0);
  const halo = useSharedValue(0);

  useEffect(() => {
    growth.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 3000, easing: Easing.out(Easing.cubic) }),
        withTiming(1, { duration: 1900 }),
        withTiming(0.86, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
    halo.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1500, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 1500, easing: Easing.in(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [growth, halo]);

  const leafStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + growth.value * 0.65,
    transform: [{ scale: 0.72 + growth.value * 0.28 }],
  }));
  const stemStyle = useAnimatedStyle(() => ({
    opacity: 0.5 + growth.value * 0.5,
    transform: [{ scaleX: 0.82 + growth.value * 0.18 }],
  }));
  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.1 + (1 - halo.value) * 0.42,
    transform: [{ scale: 0.96 + halo.value * 0.12 }],
  }));

  const branches = useMemo(() => {
    const result: Array<{
      key: string;
      x: number;
      y: number;
      angle: number;
      side: number;
      color: string;
      length: number;
    }> = [];
    for (let side = 0; side < 2; side += 1) {
      for (let i = 0; i < LEAF_COUNT; i += 1) {
        const t = i / (LEAF_COUNT - 1);
        const degrees = START_ANGLE + t * (END_ANGLE - START_ANGLE);
        const radius = RADIUS + (i % 2 === 0 ? 7 : -7);
        const point = pointAt(degrees, radius);
        const mirroredX = side === 0 ? point.x : CENTER * 2 - point.x;
        result.push({
          key: `${side}-${i}-a`,
          x: mirroredX,
          y: point.y,
          angle: (side === 0 ? degrees : 180 - degrees) + 42,
          side,
          color: i % 2 === 0 ? '#10B981' : '#34D399',
          length: 0.92 + (1 - t) * 0.12,
        });
        result.push({
          key: `${side}-${i}-b`,
          x: mirroredX,
          y: point.y,
          angle: (side === 0 ? degrees : 180 - degrees) - 42,
          side,
          color: i % 2 === 0 ? '#34D399' : '#059669',
          length: 0.92 + (1 - t) * 0.12,
        });
      }
    }
    return result;
  }, []);

  const stems = useMemo(() => {
    const result: Array<{ key: string; x: number; y: number; width: number; angle: number }> = [];
    for (let side = 0; side < 2; side += 1) {
      const points = Array.from({ length: 25 }, (_, index) => {
        const degrees = START_ANGLE + (index / 24) * (END_ANGLE - START_ANGLE);
        const p = pointAt(degrees, RADIUS);
        return { x: side === 0 ? p.x : CENTER * 2 - p.x, y: p.y };
      });
      for (let i = 0; i < points.length - 1; i += 1) {
        const a = points[i];
        const b = points[i + 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        result.push({
          key: `${side}-stem-${i}`,
          x: (a.x + b.x) / 2,
          y: (a.y + b.y) / 2,
          width: Math.sqrt(dx * dx + dy * dy),
          angle: (Math.atan2(dy, dx) * 180) / Math.PI,
        });
      }
    }
    return result;
  }, []);

  const scale = size / 300;
  const avatarSize = size * 0.36;
  const avatarOffset = (size - avatarSize) / 2;

  return (
    <View style={[styles.root, { width: size, height: size }]}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.halo,
          {
            width: avatarSize * 1.12,
            height: avatarSize * 1.12,
            borderRadius: avatarSize,
            left: (size - avatarSize * 1.12) / 2,
            top: (size - avatarSize * 1.12) / 2,
          },
          haloStyle,
        ]}
      />

      {stems.map((stem) => (
        <Animated.View
          key={stem.key}
          pointerEvents="none"
          style={[
            styles.stem,
            {
              left: stem.x * scale - (stem.width * scale) / 2,
              top: stem.y * scale - size * 0.005,
              width: stem.width * scale,
              height: Math.max(1.3, size * 0.012),
              transform: [{ rotate: `${stem.angle}deg` }],
            },
            stemStyle,
          ]}
        />
      ))}

      {branches.map((leaf) => (
        <Animated.View
          key={leaf.key}
          pointerEvents="none"
          style={[
            styles.leaf,
            {
              left: leaf.x * scale - size * 0.018,
              top: leaf.y * scale - size * 0.037,
              width: size * 0.036,
              height: size * 0.074 * leaf.length,
              backgroundColor: leaf.color,
              transform: [{ rotate: `${leaf.angle}deg` }],
            },
            leafStyle,
          ]}
        />
      ))}

      {Array.from({ length: 4 }, (_, i) => {
        const degree = START_ANGLE + (i * 3 + 1) * ((END_ANGLE - START_ANGLE) / 10);
        const p = pointAt(degree, RADIUS + 1);
        const x = i % 2 === 0 ? p.x : CENTER * 2 - p.x;
        return (
          <View
            key={`berry-${i}`}
            pointerEvents="none"
            style={[
              styles.berry,
              {
                left: x * scale - size * 0.012,
                top: p.y * scale - size * 0.012,
                width: size * 0.024,
                height: size * 0.024,
                borderRadius: size * 0.02,
              },
            ]}
          />
        );
      })}

      <View
        style={[
          styles.avatarRing,
          {
            width: avatarSize,
            height: avatarSize,
            borderRadius: avatarSize / 2,
            left: avatarOffset,
            top: avatarOffset,
            borderColor: frameColor,
            padding: size * 0.012,
          },
        ]}
      >
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.avatarImage} />
        ) : (
          <View style={styles.initialFallback}>
            <Animated.Text style={[styles.initials, { fontSize: size * 0.075 }]}>{initials}</Animated.Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'relative', alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  halo: { position: 'absolute', borderWidth: 1.5, borderColor: '#6EE7B7' },
  stem: { position: 'absolute', backgroundColor: '#059669', borderRadius: 99, transformOrigin: 'center' },
  leaf: { position: 'absolute', borderRadius: 999, borderWidth: 0.8, borderColor: '#A7F3D0' },
  berry: { position: 'absolute', backgroundColor: '#FBBF24', borderWidth: 0.6, borderColor: '#92400E' },
  avatarRing: {
    position: 'absolute',
    overflow: 'hidden',
    borderWidth: 3,
    backgroundColor: '#1E1F22',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  avatarImage: { width: '100%', height: '100%', borderRadius: 999 },
  initialFallback: { width: '100%', height: '100%', borderRadius: 999, backgroundColor: '#3730A3', alignItems: 'center', justifyContent: 'center' },
  initials: { color: '#FFFFFF', fontWeight: '900' },
});
