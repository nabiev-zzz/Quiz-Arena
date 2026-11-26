import React, { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

interface BookWingsAvatarProps {
  imageUri?: string | null;
  initials?: string;
  size?: number;
  frameColor?: string;
}

/**
 * Native React Native version of the animated "book wings" avatar.
 * Uses the user's existing avatar image and keeps the motion lightweight.
 */
export default function BookWingsAvatar({
  imageUri,
  initials = 'U',
  size = 112,
  frameColor = '#FBBF24',
}: BookWingsAvatarProps) {
  const wingMotion = useSharedValue(0);
  const capMotion = useSharedValue(0);
  const haloMotion = useSharedValue(0);
  const starMotion = useSharedValue(0);

  useEffect(() => {
    const smooth = Easing.inOut(Easing.ease);
    wingMotion.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1900, easing: smooth }),
        withTiming(0, { duration: 1900, easing: smooth }),
      ),
      -1,
      false,
    );
    capMotion.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1200, easing: smooth }),
        withTiming(0, { duration: 1200, easing: smooth }),
      ),
      -1,
      false,
    );
    haloMotion.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1700, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 0 }),
      ),
      -1,
      false,
    );
    starMotion.value = withRepeat(
      withSequence(
        withDelay(250, withTiming(1, { duration: 650 })),
        withTiming(0.18, { duration: 850 }),
      ),
      -1,
      false,
    );
  }, [capMotion, haloMotion, starMotion, wingMotion]);

  const wingStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-7 + wingMotion.value * 16}deg` }],
  }));
  const rightWingStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: -1 }, { rotate: `${-7 + wingMotion.value * 16}deg` }],
  }));
  const capStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: -capMotion.value * size * 0.035 },
      { rotate: `${-4 * capMotion.value}deg` },
    ],
  }));
  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.65 * (1 - haloMotion.value),
    transform: [{ scale: 0.92 + haloMotion.value * 0.48 }],
  }));
  const starStyle = useAnimatedStyle(() => ({
    opacity: 0.18 + starMotion.value * 0.82,
    transform: [{ scale: 0.55 + starMotion.value * 0.55 }],
  }));

  const wingWidth = size * 0.48;
  const wingHeight = size * 0.72;
  const leafWidth = size * 0.16;
  const leafHeight = size * 0.58;
  const leaves = [-50, -34, -18, -2, 14];

  return (
    <View style={[styles.root, { width: size, height: size }]}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.halo,
          {
            width: size * 0.57,
            height: size * 0.57,
            borderRadius: size * 0.285,
            top: size * 0.285,
            left: size * 0.215,
          },
          haloStyle,
        ]}
      />

      <Animated.View
        pointerEvents="none"
        style={[
          styles.wing,
          { width: wingWidth, height: wingHeight, top: size * 0.22, left: size * 0.015 },
          wingStyle,
        ]}
      >
        {leaves.map((angle, index) => (
          <LinearGradient
            key={angle}
            colors={['#C7D2FE', '#7568E8', '#4338CA']}
            start={{ x: 0.25, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            style={[
              styles.leaf,
              {
                width: leafWidth,
                height: leafHeight * (index === 3 ? 1 : 0.78 + index * 0.045),
                left: index * size * 0.064,
                bottom: 0,
                transform: [{ rotate: `${angle}deg` }],
              },
            ]}
          />
        ))}
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.wing,
          { width: wingWidth, height: wingHeight, top: size * 0.22, right: size * 0.015 },
          rightWingStyle,
        ]}
      >
        {leaves.map((angle, index) => (
          <LinearGradient
            key={angle}
            colors={['#C7D2FE', '#7568E8', '#4338CA']}
            start={{ x: 0.25, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            style={[
              styles.leaf,
              {
                width: leafWidth,
                height: leafHeight * (index === 3 ? 1 : 0.78 + index * 0.045),
                left: index * size * 0.064,
                bottom: 0,
                transform: [{ rotate: `${angle}deg` }],
              },
            ]}
          />
        ))}
      </Animated.View>

      <View
        style={[
          styles.avatarRing,
          {
            width: size * 0.55,
            height: size * 0.55,
            borderRadius: size * 0.275,
            top: size * 0.29,
            left: size * 0.225,
            padding: size * 0.035,
            borderColor: frameColor,
          },
        ]}
      >
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.avatarImage} />
        ) : (
          <View style={styles.initialFallback}>
            <Animated.Text style={[styles.initials, { fontSize: size * 0.2 }]}>{initials}</Animated.Text>
          </View>
        )}
      </View>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.cap,
          {
            width: size * 0.43,
            height: size * 0.27,
            top: size * 0.005,
            left: size * 0.285,
          },
          capStyle,
        ]}
      >
        <View style={[styles.capDiamond, { width: size * 0.43, height: size * 0.15 }]} />
        <View style={[styles.capBase, { width: size * 0.25, height: size * 0.105, top: size * 0.105 }]} />
        <View style={[styles.tassel, { right: size * 0.045, top: size * 0.13, height: size * 0.14 }]} />
        <View style={[styles.tasselDot, { right: size * 0.025, top: size * 0.255, width: size * 0.045, height: size * 0.045, borderRadius: size * 0.03 }]} />
      </Animated.View>

      {[
        { left: size * 0.1, top: size * 0.28, scale: 0.8 },
        { right: size * 0.08, top: size * 0.38, scale: 1 },
        { left: size * 0.05, bottom: size * 0.12, scale: 0.65 },
        { right: size * 0.04, bottom: size * 0.1, scale: 0.7 },
      ].map((position, index) => (
        <Animated.View
          key={index}
          pointerEvents="none"
          style={[styles.star, position, { width: size * 0.055, height: size * 0.055 }, starStyle]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'relative', alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  halo: { position: 'absolute', borderWidth: 1.5, borderColor: '#A5B4FC' },
  wing: { position: 'absolute', overflow: 'visible' },
  leaf: { position: 'absolute', borderRadius: 999, borderWidth: 1, borderColor: '#E0E7FF', opacity: 0.96 },
  avatarRing: {
    position: 'absolute',
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#FBBF24',
    backgroundColor: '#1E1F22',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  avatarImage: { width: '100%', height: '100%', borderRadius: 999 },
  initialFallback: { width: '100%', height: '100%', borderRadius: 999, backgroundColor: '#3730A3', alignItems: 'center', justifyContent: 'center' },
  initials: { color: '#FFFFFF', fontWeight: '900' },
  cap: { position: 'absolute', zIndex: 4, alignItems: 'center' },
  capDiamond: { position: 'absolute', top: 0, left: 0, backgroundColor: '#FBBF24', borderColor: '#92400E', borderWidth: 1, transform: [{ rotate: '45deg' }] },
  capBase: { position: 'absolute', backgroundColor: '#D97706', borderBottomLeftRadius: 9, borderBottomRightRadius: 9, borderColor: '#92400E', borderWidth: 1 },
  tassel: { position: 'absolute', width: 2, backgroundColor: '#92400E' },
  tasselDot: { position: 'absolute', backgroundColor: '#FBBF24' },
  star: { position: 'absolute', backgroundColor: '#FDE68A', borderRadius: 3, zIndex: 5 },
});
