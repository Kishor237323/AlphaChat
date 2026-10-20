import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { USE_NATIVE_DRIVER, type Theme } from '../lib/theme';
import type { Message } from '../lib/types';
import { formatTime } from '../lib/utils';
import { Ticks } from './Ticks';

type Props = {
  message: Message;
  mine: boolean;
  first: boolean;
  theme: Theme;
  onRetry: (id: string) => void;
};

export const MessageBubble = React.memo(function MessageBubble({ message, mine, first, theme, onRetry }: Props) {
  // Only messages created in the last few seconds play the pop-in animation.
  const fresh = useRef(Math.abs(Date.now() - Date.parse(message.created_at)) < 5000);
  const anim = useRef(new Animated.Value(fresh.current ? 0 : 1)).current;

  useEffect(() => {
    if (fresh.current) {
      Animated.spring(anim, { toValue: 1, friction: 7, tension: 90, useNativeDriver: USE_NATIVE_DRIVER }).start();
    }
  }, [anim]);

  const spacer = '\u00A0'.repeat(mine ? 18 : 13);

  const bubble = (
    <Animated.View
      style={[
        styles.bubble,
        {
          backgroundColor: mine ? theme.bubbleMine : theme.bubbleTheirs,
          opacity: anim,
          transform: [
            { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
            { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
          ],
        },
        first && (mine ? styles.tailRight : styles.tailLeft),
      ]}
    >
      <Text selectable style={[styles.text, { color: theme.bubbleText }]}>
        {message.content}
        {spacer}
      </Text>
      <View style={styles.footer}>
        <Text style={[styles.time, { color: theme.bubbleTime }]}>{formatTime(message.created_at)}</Text>
        {mine ? (
          <View style={styles.tick}>
            <Ticks message={message} theme={theme} />
          </View>
        ) : null}
      </View>
    </Animated.View>
  );

  return (
    <View
      style={[
        styles.row,
        { alignItems: mine ? 'flex-end' : 'flex-start', marginTop: first ? 8 : 2 },
      ]}
    >
      {message.failed ? (
        <Pressable onPress={() => onRetry(message.id)}>
          {bubble}
          <Text style={[styles.failed, { color: theme.danger }]}>Not sent · tap to retry</Text>
        </Pressable>
      ) : (
        bubble
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  row: { width: '100%', paddingHorizontal: 10 },
  bubble: {
    maxWidth: '82%',
    minWidth: 72,
    paddingHorizontal: 9,
    paddingTop: 6,
    paddingBottom: 6,
    borderRadius: 10,
  },
  tailRight: { borderTopRightRadius: 2 },
  tailLeft: { borderTopLeftRadius: 2 },
  text: { fontSize: 16, lineHeight: 21 },
  footer: {
    position: 'absolute',
    right: 8,
    bottom: 5,
    flexDirection: 'row',
    alignItems: 'center',
  },
  time: { fontSize: 11 },
  tick: { marginLeft: 4 },
  failed: { fontSize: 11, marginTop: 2, textAlign: 'right' },
});