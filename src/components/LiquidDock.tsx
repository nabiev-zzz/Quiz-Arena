import { LocalizedText } from '../i18n/LocalizedText';
import React, { useEffect, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text as NativeText,
  View,
} from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';

import { useTheme } from '../theme/ThemeContext';

export type LiquidDockItem = {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
};

type Props = {
  items: readonly LiquidDockItem[];
  activeKey: string;
  onSelect: (key: string) => void;
  bottomInset: number;
  scrollStretch: SharedValue<number>;
};

const SPRING = { damping: 11, stiffness: 160, mass: 0.7 };

function DockItem({
  item,
  active,
  width,
  onPress,
  scrollStretch,
  colors,
}: {
  item: LiquidDockItem;
  active: boolean;
  width: number;
  onPress: () => void;
  scrollStretch: SharedValue<number>;
  colors: ReturnType<typeof useTheme>['tokens']['colors'];
}) {
  const bounce = useSharedValue(1);

  useEffect(() => {
    if (active) {
      bounce.value = withSequence(
        withSpring(1.14, SPRING),
        withSpring(1, SPRING),
      );
    }
  }, [active, bounce]);

  const animatedStyle = useAnimatedStyle(() => {
    const movement = Math.min(1, Math.abs(scrollStretch.value));
    return {
      transform: [
        { translateY: -scrollStretch.value * 5 },
        { scaleY: bounce.value * (1 + movement * 0.16) },
        { scaleX: bounce.value * (1 - movement * 0.08) },
      ],
    };
  });

  return (
    <Pressable
      onPress={onPress}
      style={[styles.item, { width }]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={item.label}
      hitSlop={2}
    >
      <Animated.View style={[styles.itemInner, animatedStyle]}>
        <Ionicons
          name={active ? item.activeIcon : item.icon}
          size={24}
          color={active ? colors.primary : colors.textMuted}
        />
        <LocalizedText
          numberOfLines={1}
          style={[
            styles.label,
            { color: active ? colors.text : colors.textMuted },
            active && styles.activeLabel,
          ]}
        >
          {item.label}
        </LocalizedText>
      </Animated.View>
    </Pressable>
  );
}

export default function LiquidDock({
  items,
  activeKey,
  onSelect,
  bottomInset,
  scrollStretch,
}: Props) {
  const { isDark, tokens } = useTheme();
  const [dockWidth, setDockWidth] = useState(0);
  const indicatorX = useSharedValue(0);
  const itemWidth = items.length > 0 ? dockWidth / items.length : 0;
  const activeIndex = Math.max(0, items.findIndex((item) => item.id === activeKey));

  useEffect(() => {
    if (itemWidth > 0) {
      indicatorX.value = withSpring(activeIndex * itemWidth, SPRING);
    }
  }, [activeIndex, indicatorX, itemWidth]);

  const indicatorStyle = useAnimatedStyle(() => ({
    width: Math.max(0, itemWidth - 8),
    transform: [{ translateX: indicatorX.value }],
  }));

  const handleLayout = (event: LayoutChangeEvent) => {
    setDockWidth(event.nativeEvent.layout.width);
  };

  return (
    <View
      pointerEvents="box-none"
      style={[styles.position, { bottom: Math.max(bottomInset, 8) }]}
    >
      <View
        onLayout={handleLayout}
        style={[
          styles.dock,
          {
            borderColor: tokens.colors.borderStrong,
            backgroundColor: tokens.colors.surfaceGlass,
          },
        ]}
      >
        {itemWidth > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.liquidPill,
              {
                backgroundColor: isDark
                  ? 'rgba(229,185,92,0.20)'
                  : 'rgba(168,50,75,0.10)',
                borderColor: isDark
                  ? 'rgba(244,217,143,0.38)'
                  : 'rgba(168,50,75,0.22)',
              },
              indicatorStyle,
            ]}
          />
        )}
        <View style={styles.itemsRow}>
          {items.map((item) => (
            <DockItem
              key={item.id}
              item={item}
              active={item.id === activeKey}
              width={itemWidth}
              onPress={() => onSelect(item.id)}
              scrollStretch={scrollStretch}
              colors={tokens.colors}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  position: {
    position: 'absolute',
    left: 18,
    right: 18,
    zIndex: 100,
  },
  dock: {
    height: 76,
    borderRadius: 28,
    borderWidth: 1,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.20,
    shadowRadius: 26,
    elevation: 14,
  },
  itemsRow: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 2,
  },
  liquidPill: {
    position: 'absolute',
    top: 6,
    bottom: 6,
    left: 4,
    borderRadius: 21,
    borderWidth: 1,
    zIndex: 1,
  },
  item: {
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  itemInner: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
    gap: 3,
  },
  label: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  activeLabel: {
    fontWeight: '800',
  },
});
