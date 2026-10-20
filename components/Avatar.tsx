import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { USE_NATIVE_DRIVER } from '../lib/theme';
import { colorFromString, initials } from '../lib/utils';

type Props = {
  name: string;
  size?: number;
  online?: boolean;
  ringColor?: string;
  onlineColor?: string;
};

function OnlineDot({ size, ringColor, color }: { size: number; ringColor: string; color: string }) {
  const scale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(scale, { toValue: 1, friction: 5, useNativeDriver: USE_NATIVE_DRIVER }).start();
  }, [scale]);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        right: -1,
        bottom: -1,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        borderWidth: 2,
        borderColor: ringColor,
        transform: [{ scale }],
      }}
    />
  );
}

export function Avatar({ name, size = 48, online = false, ringColor = '#FFFFFF', onlineColor = '#25D366' }: Props) {
  const dot = Math.max(11, Math.round(size * 0.3));
  return (
    <View style={{ width: size, height: size }}>
      <View
        style={[
          styles.circle,
          { width: size, height: size, borderRadius: size / 2, backgroundColor: colorFromString(name) },
        ]}
      >
        <Text style={[styles.letters, { fontSize: size * 0.4 }]}>{initials(name)}</Text>
      </View>
      {online ? <OnlineDot size={dot} ringColor={ringColor} color={onlineColor} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
  letters: { color: '#FFFFFF', fontWeight: '700' },
});