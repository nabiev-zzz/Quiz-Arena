import React, { memo, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeContext';

type FlakeConfig = {
  id: number;
  left: string;
  size: number;
  duration: number;
  drift: number;
  phase: number;
  opacity: number;
  glyph: string;
  rotation: number;
};

// Different six-armed crystal forms keep the snowfall natural rather than dot-like.
const CRYSTALS = ['❄', '❅', '❆'];
const FLAKES: FlakeConfig[] = Array.from({ length: 24 }, (_, index) => ({
  id: index + 1,
  left: `${(index * 37 + 5) % 97}%`,
  size: 17 + ((index * 11) % 19),
  duration: 12500 + ((index * 1379) % 8500),
  drift: 10 + ((index * 7) % 19),
  phase: (index * 0.73) % (Math.PI * 2),
  opacity: 0.48 + ((index * 13) % 34) / 100,
  glyph: CRYSTALS[index % CRYSTALS.length],
  rotation: (index * 29) % 360,
}));

const Snowflake = memo(function Snowflake({
  flake,
  color,
}: {
  flake: FlakeConfig;
  color: string;
}) {
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
      opacity: flake.opacity * Math.max(0.16, 1 - Math.abs(travel - 0.5) * 1.35),
      transform: [
        { translateY: -48 + travel * 1040 },
        { translateX: Math.sin(progress.value * Math.PI * 2 + flake.phase) * flake.drift },
        { rotate: `${flake.rotation + progress.value * 115}deg` },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.flake, { left: flake.left }, animatedStyle]}
    >
      <Text
        allowFontScaling={false}
        style={[
          styles.crystal,
          {
            color,
            fontSize: flake.size,
            textShadowColor: color,
          },
        ]}
      >
        {flake.glyph}
      </Text>
    </Animated.View>
  );
});

/** Theme-aware, non-interactive winter layer. Keep it behind screen content. */
export default function Snowfall() {
  const { isDark } = useTheme();
  // Dark surfaces get icy white crystals; light surfaces get slate-blue crystals.
  const crystalColor = isDark ? '#F4F8FF' : '#71839D';
  return (
    <View pointerEvents="none" accessible={false} style={styles.layer}>
      {FLAKES.map((flake) => (
        <Snowflake key={flake.id} flake={flake} color={crystalColor} />
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
  flake: {
    position: 'absolute',
    top: 0,
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crystal: {
    includeFontPadding: false,
    fontWeight: '400',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
});
