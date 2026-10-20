import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Theme } from '../lib/theme';
import type { Message } from '../lib/types';

function Check({ color }: { color: string }) {
  return (
    <View
      style={{
        width: 6,
        height: 11,
        borderRightWidth: 1.8,
        borderBottomWidth: 1.8,
        borderColor: color,
        transform: [{ rotate: '45deg' }],
      }}
    />
  );
}

export function Ticks({ message, theme }: { message: Message; theme: Theme }) {
  if (message.failed) {
    return <Text style={{ color: theme.danger, fontSize: 12, fontWeight: '800' }}>!</Text>;
  }
  if (message.pending) {
    return <View style={[styles.clock, { borderColor: theme.bubbleTime }]} />;
  }
  if (message.read_at || message.delivered_at) {
    const color = message.read_at ? theme.tickRead : theme.bubbleTime;
    return (
      <View style={styles.box}>
        <View style={{ position: 'absolute', left: 2, top: 0 }}>
          <Check color={color} />
        </View>
        <View style={{ position: 'absolute', left: 7, top: 0 }}>
          <Check color={color} />
        </View>
      </View>
    );
  }
  return (
    <View style={styles.box}>
      <View style={{ position: 'absolute', left: 4, top: 0 }}>
        <Check color={theme.bubbleTime} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: 17, height: 12 },
  clock: { width: 10, height: 10, borderRadius: 5, borderWidth: 1.4 },
});