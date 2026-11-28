import React, { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

type FlakeConfig = {
  id: number;
  left: string;
  size: number;
  duration: number;
  drift: number;
  phase: number;
  opacity: number;
};

const FLAKES: FlakeConfig[] = [
  { id: 1, left: '4%', size: 3, duration: 12500, drift: 18, phase: 0.2, opacity: 0.62 },
  { id: 2, left: '11%', size: 2, duration: 15800, drift: 12, phase: 1.1, opacity: 0.48 },
  { id: 3, left: '18%', size: 4, duration: 14200, drift: 22, phase: 2.2, opacity: 0.58 },
  { id: 4, left: '26%', size: 2, duration: 17100, drift: 14, phase: 0.8, opacity: 0.45 },
  { id: 5, left: '34%', size: 3, duration: 13200, drift: 19, phase: 2.8, opacity: 0.56 },
  { id: 6, left: '42%', size: 2, duration: 16400, drift: 13, phase: 1.7, opacity: 0.48 },
  { id: 7, left: '50%', size: 4, duration: 14800, drift: 24, phase: 0.4, opacity: 0.60 },
  { id: 8, left: '58%', size: 2, duration: 17800, drift: 15, phase: 2.5, opacity: 0.46 },
  { id: 9, left: '66%', size: 3, duration: 13700, drift: 20, phase: 1.4, opacity: 0.55 },
  { id: 10, left: '73%', size: 2, duration: 16800, drift: 12, phase: 0.9, opacity: 0.45 },
  { id: 11, left: '81%', size: 4, duration: 15100, drift: 21, phase: 2.1, opacity: 0.58 },
  { id: 12, left: '89%', size: 2, duration: 18300, drift: 14, phase: 1.8, opacity: 0.46 },
  { id: 13, left: '96%', size: 3, duration: 14500, drift: 17, phase: 0.6, opacity: 0.54 },
  { id: 14, left: '22%', size: 2, duration: 19000, drift: 16, phase: 2.9, opacity: 0.42 },
  { id: 15, left: '61%', size: 3, duration: 17600, drift: 18, phase: 1.3, opacity: 0.48 },
  { id: 16, left: '92%', size: 2, duration: 16000, drift: 11, phase: 2.4, opacity: 0.43 },
];

const Snowflake = memo(function Snowflake({ flake }: { flake: FlakeConfig }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: flake.duration, easing: Easing.linear }),
      -1,
      false,
    );
    return () => {
      progress.value = 0;
    };
  }, [flake.duration, progress]);

  const animatedStyle = useAnimatedStyle(() => {
    const travel = (progress.value + ((flake.id * 0.618) % 1)) % 1;
    return {
      opacity: flake.opacity * Math.max(0, 1 - Math.abs(travel - 0.5) * 2),
      transform: [
        { translateY: -36 + travel * 980 },
        {
          translateX:
            Math.sin(progress.value * Math.PI * 2 + flake.phase) * flake.drift,
        },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.flake,
        {
          left: flake.left,
          width: flake.size,
          height: flake.size,
          borderRadius: flake.size,
        },
        animatedStyle,
      ]}
    />
  );
});

/**
 * Decorative winter layer. It is deliberately non-interactive and must be
 * rendered before screen content so controls always stay above the snowfall.
 */
export default function Snowfall() {
  return (
    <View pointerEvents="none" accessible={false} style={styles.layer}>
      <View style={styles.garland}>
        <View style={styles.garlandWire} />
        {['#F06B78', '#F4D36B', '#66D5A1', '#8BB8FF', '#F4D36B', '#F06B78', '#66D5A1'].map((color, index) => (
          <View key={index} style={[styles.garlandBulb, { backgroundColor: color, shadowColor: color }]} />
        ))}
      </View>
      {FLAKES.map((flake) => (
        <Snowflake key={flake.id} flake={flake} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
    zIndex: 0,
    elevation: 0,
  },
  garland: {
    position: 'absolute',
    top: 0,
    left: '12%',
    right: '12%',
    height: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    opacity: 0.72,
  },
  garlandWire: {
    position: 'absolute',
    top: 3,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(220, 226, 255, 0.42)',
  },
  garlandBulb: {
    width: 5,
    height: 7,
    borderRadius: 4,
    shadowOpacity: 0.7,
    shadowRadius: 5,
    elevation: 1,
  },
  flake: {
    position: 'absolute',
    top: 0,
    backgroundColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.7,
    shadowRadius: 4,
  },
});
