import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colorFromString } from '../lib/utils';

export function GroupAvatar({ name, size = 48 }: { name: string; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colorFromString(name || 'group'),
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name="people" size={Math.round(size * 0.5)} color="#FFFFFF" />
    </View>
  );
}
