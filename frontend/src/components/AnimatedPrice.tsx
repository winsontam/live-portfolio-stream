/**
 * AnimatedPrice
 * Shows a price that flashes green on up-tick, red on down-tick.
 * Uses Animated.Value for the background color so we never drop frames.
 * The number itself is rendered as plain Text — React Native reconciles
 * text changes very efficiently without layout thrash.
 */

import React, { useEffect, useRef, memo } from 'react';
import { Animated, StyleSheet, ViewStyle } from 'react-native';

interface Props {
  value: number;
  format?: (v: number) => string;
  style?: ViewStyle;
}

const defaultFormat = (v: number) =>
  v < 0.01 ? v.toFixed(4) : v < 1 ? v.toFixed(3) : v.toFixed(2);

const FLASH_DURATION = 350; // ms

export const AnimatedPrice = memo(({ value, format = defaultFormat, style }: Props) => {
  const prevRef = useRef<number | null>(null);
  const flashAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = value;

    if (prev === null || prev === value) return;

    const direction = value > prev ? 1 : -1; // 1 = up (green), -1 = down (red)

    // Reset then animate
    flashAnim.setValue(direction);
    Animated.timing(flashAnim, {
      toValue: 0,
      duration: FLASH_DURATION,
      useNativeDriver: false,
    }).start();
  }, [value, flashAnim]);

  const backgroundColor = flashAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['rgba(239,68,68,0.35)', 'transparent', 'rgba(34,197,94,0.35)'],
  });

  const textColor = flashAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['#ef4444', '#e2e8f0', '#22c55e'],
  });

  return (
    <Animated.View style={[styles.wrap, { backgroundColor }, style]}>
      <Animated.Text style={[styles.text, { color: textColor }]}>
        {format(value)}
      </Animated.Text>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
    alignItems: 'flex-end',
  },
  text: {
    fontSize: 13,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
  },
});
