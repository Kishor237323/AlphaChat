import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Theme } from '../lib/theme';
import type { GroupMessage } from '../lib/groupApi';
import { colorFromString, formatTime } from '../lib/utils';

export type ReactionChip = { emoji: string; count: number; mine: boolean };

type Props = {
  message: GroupMessage;
  mine: boolean;
  showName: boolean;
  memberNames: string[];
  reactions: ReactionChip[];
  theme: Theme;
  onOpenActions: (message: GroupMessage) => void;
  onToggleReaction: (messageId: string, emoji: string) => void;
};

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Highlights "@name" for every member name. */
function renderContent(content: string, names: string[], color: string): React.ReactNode {
  if (names.length === 0) return content;
  const pattern = [...names]
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join('|');
  const parts = content.split(new RegExp(`(@(?:${pattern}))`, 'g'));
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <Text key={i} style={{ color, fontWeight: '700' }}>
        {part}
      </Text>
    ) : (
      part
    )
  );
}

export const GroupMessageBubble = React.memo(function GroupMessageBubble({
  message,
  mine,
  showName,
  memberNames,
  reactions,
  theme,
  onOpenActions,
  onToggleReaction,
}: Props) {
  if (message.kind === 'system') {
    return (
      <View style={styles.sysWrap}>
        <View style={[styles.sysChip, { backgroundColor: theme.chipBg }]}>
          <Text style={{ color: theme.chipText, fontSize: 12.5, textAlign: 'center' }}>{message.content}</Text>
        </View>
      </View>
    );
  }

  const deleted = !!message.deleted_at;

  return (
    <View style={[styles.row, { alignItems: mine ? 'flex-end' : 'flex-start', marginTop: showName ? 8 : 2 }]}>
      <Pressable
        onPress={() => !deleted && onOpenActions(message)}
        onLongPress={() => !deleted && onOpenActions(message)}
        style={[
          styles.bubble,
          { backgroundColor: mine ? theme.bubbleMine : theme.bubbleTheirs, opacity: message.pending ? 0.7 : 1 },
        ]}
      >
        {!mine && showName ? (
          <Text numberOfLines={1} style={[styles.sender, { color: colorFromString(message.sender_name || '?') }]}>
            {message.sender_name || 'Former member'}
          </Text>
        ) : null}

        {message.reply_to && !deleted ? (
          <View style={[styles.quote, { borderLeftColor: theme.accent, backgroundColor: theme.dark ? '#FFFFFF14' : '#0000000D' }]}>
            <Text numberOfLines={1} style={{ color: theme.accent, fontSize: 12.5, fontWeight: '700' }}>
              {message.reply_sender || 'Message'}
            </Text>
            <Text numberOfLines={2} style={{ color: theme.subText, fontSize: 13 }}>
              {message.reply_preview || 'Original message'}
            </Text>
          </View>
        ) : null}

        {deleted ? (
          <Text style={{ color: theme.subText, fontSize: 15, fontStyle: 'italic' }}>This message was deleted</Text>
        ) : (
          <Text selectable style={[styles.text, { color: theme.bubbleText }]}>
            {renderContent(message.content, memberNames, theme.accent)}
          </Text>
        )}

        <View style={styles.footer}>
          {message.pinned_at && !deleted ? (
            <Ionicons name="pin" size={11} color={theme.bubbleTime} style={{ marginRight: 4 }} />
          ) : null}
          <Text style={{ color: theme.bubbleTime, fontSize: 11 }}>{formatTime(message.created_at)}</Text>
          {message.pending ? (
            <Ionicons name="time-outline" size={12} color={theme.bubbleTime} style={{ marginLeft: 4 }} />
          ) : null}
        </View>
      </Pressable>

      {reactions.length > 0 && !deleted ? (
        <View style={[styles.reactions, { justifyContent: mine ? 'flex-end' : 'flex-start' }]}>
          {reactions.map((r) => (
            <Pressable
              key={r.emoji}
              onPress={() => onToggleReaction(message.id, r.emoji)}
              style={[
                styles.chip,
                {
                  backgroundColor: r.mine ? theme.accent : theme.chipBg,
                  borderColor: r.mine ? theme.accent : theme.divider,
                },
              ]}
            >
              <Text style={{ fontSize: 13 }}>{r.emoji}</Text>
              <Text style={{ fontSize: 12, fontWeight: '700', marginLeft: 4, color: r.mine ? '#FFFFFF' : theme.chipText }}>
                {r.count}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  row: { width: '100%', paddingHorizontal: 10 },
  bubble: { maxWidth: '84%', minWidth: 84, paddingHorizontal: 10, paddingTop: 6, paddingBottom: 5, borderRadius: 10 },
  sender: { fontSize: 13, fontWeight: '700', marginBottom: 2 },
  quote: { borderLeftWidth: 3, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5, marginBottom: 5 },
  text: { fontSize: 16, lineHeight: 21 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 2 },
  reactions: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 3, maxWidth: '84%' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginRight: 4,
    marginBottom: 2,
  },
  sysWrap: { alignItems: 'center', marginVertical: 6, paddingHorizontal: 24 },
  sysChip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10 },
});
