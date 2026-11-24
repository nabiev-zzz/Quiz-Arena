import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

type AnimatedSplashProps = {
  onFinish: () => void;
};

const APP_NAME = 'QUIZ ARENA';
const LETTERS = Array.from(APP_NAME);

function PulseRing({ delay }: { delay: number }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, {
            duration: 1700,
            easing: Easing.out(Easing.quad),
          }),
          withTiming(0, { duration: 0 }),
        ),
        -1,
        false,
      ),
    );
  }, [delay, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [0, 0.12, 1],
      [0.42, 0.3, 0],
      Extrapolation.CLAMP,
    ),
    transform: [
      { scale: interpolate(progress.value, [0, 1], [0.6, 2.4]) },
    ],
  }));

  return <Animated.View pointerEvents="none" style={[styles.ring, animatedStyle]} />;
}

function AnimatedLetter({
  letter,
  index,
}: {
  letter: string;
  index: number;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      index * 70,
      withSpring(1, { damping: 13, stiffness: 150 }),
    );
  }, [index, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 24 }],
  }));

  return (
    <Animated.Text style={[styles.appLetter, animatedStyle]}>
      {letter === ' ' ? '\u00A0' : letter}
    </Animated.Text>
  );
}

export default function AnimatedSplash({ onFinish }: AnimatedSplashProps) {
  const logoProgress = useSharedValue(0);
  const glowProgress = useSharedValue(0);
  const exitProgress = useSharedValue(0);

  useEffect(() => {
    logoProgress.value = withSpring(1, {
      damping: 11,
      stiffness: 125,
      mass: 0.8,
    });
    glowProgress.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 950, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 950, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );

    exitProgress.value = withDelay(
      2800,
      withTiming(
        1,
        { duration: 550, easing: Easing.in(Easing.cubic) },
        (finished) => {
          if (finished) {
            runOnJS(onFinish)();
          }
        },
      ),
    );
  }, [exitProgress, glowProgress, logoProgress, onFinish]);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoProgress.value,
    transform: [
      { scale: logoProgress.value },
      { rotate: `${interpolate(logoProgress.value, [0, 1], [-120, 0])}deg` },
    ],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glowProgress.value, [0, 1], [0.28, 0.62]),
    transform: [{ scale: interpolate(glowProgress.value, [0, 1], [0.9, 1.18]) }],
  }));

  const exitStyle = useAnimatedStyle(() => ({
    opacity: 1 - exitProgress.value,
    transform: [{ scale: 1 + exitProgress.value * 0.15 }],
  }));

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Animated.View style={[styles.content, exitStyle]}>
        <View style={styles.logoStage}>
          <Animated.View style={[styles.glow, glowStyle]} />
          <PulseRing delay={0} />
          <PulseRing delay={600} />
          <PulseRing delay={1200} />

          <Animated.View style={[styles.logoMark, logoStyle]}>
            <View style={styles.logoBack} />
            <View style={styles.logoFront} />
          </Animated.View>
        </View>

        <View style={styles.nameRow}>
          {LETTERS.map((letter, index) => (
            <AnimatedLetter
              key={`${letter}-${index}`}
              letter={letter}
              index={index}
            />
          ))}
        </View>
        <Text style={styles.tagline}>O'RGAN. RIVOJLAN. G'ALABA QOZON.</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    elevation: 1000,
    backgroundColor: '#0B0B14',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoStage: {
    width: 190,
    height: 190,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  glow: {
    position: 'absolute',
    width: 112,
    height: 112,
    borderRadius: 36,
    backgroundColor: '#7C5CFF',
    shadowColor: '#7C5CFF',
    shadowOpacity: 0.95,
    shadowRadius: 42,
    shadowOffset: { width: 0, height: 0 },
    elevation: 22,
  },
  ring: {
    position: 'absolute',
    width: 78,
    height: 78,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: '#22D3EE',
  },
  logoMark: {
    width: 92,
    height: 92,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoBack: {
    position: 'absolute',
    width: 68,
    height: 68,
    borderRadius: 21,
    backgroundColor: '#22D3EE',
    transform: [{ translateX: 12 }, { translateY: -10 }, { rotate: '12deg' }],
  },
  logoFront: {
    position: 'absolute',
    width: 68,
    height: 68,
    borderRadius: 21,
    backgroundColor: '#7C5CFF',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.18)',
    transform: [{ translateX: -10 }, { translateY: 9 }, { rotate: '-10deg' }],
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 34,
  },
  appLetter: {
    color: '#FFFFFF',
    fontSize: 25,
    lineHeight: 32,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  tagline: {
    color: '#8D8BA5',
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 2.2,
    marginTop: 12,
  },
});
