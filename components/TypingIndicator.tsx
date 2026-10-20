import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { USE_NATIVE_DRIVER, type Theme } from '../lib/theme';

function Dot({ delay, color }: { delay: number; color: string }) {
  const v = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, { toValue: 1, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(v, { toValue: 0, duration: 320, easing: Easing.in(Easing.quad), useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.delay(400 - delay),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [delay, v]);

  return (
    <Animated.View
      style={[
        styles.dot,
        {
          backgroundColor: color,
          opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }),
          transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }) }],
        },
      ]}
    />
  );
}

export function TypingBubble({ theme }: { theme: Theme }) {
  const appear = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(appear, { toValue: 1, friction: 7, useNativeDriver: USE_NATIVE_DRIVER }).start();
  }, [appear]);

  return (
    <View style={styles.row}>
      <Animated.View
        style={[
          styles.bubble,
          {
            backgroundColor: theme.bubbleTheirs,
            opacity: appear,
            transform: [{ scale: appear.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }],
          },
        ]}
      >
        <Dot delay={0} color={theme.subText} />
        <Dot delay={160} color={theme.subText} />
        <Dot delay={320} color={theme.subText} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 10, marginTop: 8, marginBottom: 4, alignItems: 'flex-start' },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 12,
    borderTopLeftRadius: 2,
    gap: 5,
  },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
});