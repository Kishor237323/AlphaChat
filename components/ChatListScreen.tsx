import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View, ListRenderItemInfo, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useChat } from '../lib/ChatContext';
import { useTheme, type Theme } from '../lib/theme';
import type { Message, Profile } from '../lib/types';
import { listTimeLabel } from '../lib/utils';
import { Avatar } from './Avatar';
import { FadeIn } from './FadeIn';
import { Ticks } from './Ticks';

const webReset: any = Platform.OS === 'web' ? { outlineStyle: 'none' } : null;

type RowItem = { user: Profile; last: Message | null; unread: number };

type RowProps = {
  item: RowItem;
  meId: string;
  online: boolean;
  typing: boolean;
  theme: Theme;
  onPress: (id: string) => void;
};

const ChatRow = React.memo(function ChatRow({ item, meId, online, typing, theme, onPress }: RowProps) {
  const { user, last, unread } = item;
  const mine = !!last && last.sender_id === meId;

  return (
    <Pressable
      onPress={() => onPress(user.id)}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.pressed }]}
    >
      <Avatar name={user.username} size={52} online={online} ringColor={theme.background} onlineColor={theme.online} />
      <View style={[styles.rowBody, { borderBottomColor: theme.divider }]}>
        <View style={styles.rowTop}>
          <Text numberOfLines={1} style={[styles.name, { color: theme.text }]}>
            {user.username}
          </Text>
          {last ? (
            <Text style={[styles.time, { color: unread > 0 ? theme.accent : theme.subText }]}>
              {listTimeLabel(last.created_at)}
            </Text>
          ) : null}
        </View>
        <View style={styles.rowBottom}>
          <View style={styles.previewWrap}>
            {typing ? (
              <Text numberOfLines={1} style={{ color: theme.accent, fontSize: 14.5 }}>
                typing…
              </Text>
            ) : (
              <>
                {mine && last ? (
                  <View style={styles.tickBox}>
                    <Ticks message={last} theme={theme} />
                  </View>
                ) : null}
                <Text numberOfLines={1} style={[styles.preview, { color: theme.subText }]}>
                  {last ? last.content : online ? 'online' : 'Tap to start chatting'}
                </Text>
              </>
            )}
          </View>
          {unread > 0 ? (
            <View style={[styles.badge, { backgroundColor: theme.accent }]}>
              <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
});

export function ChatListScreen({ onOpen }: { onOpen: (peerId: string) => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { me, users, messages, onlineIds, typingIds, signOut, error, reload } = useChat();
  const [query, setQuery] = useState('');

  const rows = useMemo<RowItem[]>(() => {
    const q = query.trim().toLowerCase();
    const items = users
      .filter((u) => u.username.toLowerCase().includes(q))
      .map((u) => {
        const list = messages[u.id] ?? [];
        const last = list.length > 0 ? list[list.length - 1] : null;
        const unread = list.reduce((n, m) => n + (m.sender_id === u.id && !m.read_at ? 1 : 0), 0);
        return { user: u, last, unread };
      });
    items.sort((a, b) => {
      const ta = a.last ? Date.parse(a.last.created_at) : 0;
      const tb = b.last ? Date.parse(b.last.created_at) : 0;
      if (ta !== tb) return tb - ta;
      return a.user.username.localeCompare(b.user.username);
    });
    return items;
  }, [users, messages, query]);

  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<RowItem>) => (
      <FadeIn delay={Math.min(index, 8) * 40}>
        <ChatRow
          item={item}
          meId={me?.id ?? ''}
          online={onlineIds.has(item.user.id)}
          typing={!!typingIds[item.user.id]}
          theme={theme}
          onPress={onOpen}
        />
      </FadeIn>
    ),
    [me?.id, onlineIds, typingIds, theme, onOpen]
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={[styles.header, { backgroundColor: theme.header, paddingTop: insets.top + 10 }]}>
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: theme.headerText }]}>AlphaChat</Text>
          <View style={styles.headerRight}>
            {me ? (
              <Avatar name={me.username} size={32} online ringColor={theme.header} onlineColor={theme.online} />
            ) : null}
            <Pressable onPress={() => void signOut()} hitSlop={10} style={styles.logout}>
              <Text style={{ color: theme.headerText, fontWeight: '600' }}>Log out</Text>
            </Pressable>
          </View>
        </View>
        <TextInput
          style={[styles.search, { backgroundColor: theme.dark ? theme.searchBg : '#FFFFFF22', color: theme.headerText }, webReset]}
          placeholder="Search chats"
          placeholderTextColor={theme.headerSubText}
          value={query}
          onChangeText={setQuery}
        />
      </View>

      {error ? (
        <Pressable onPress={() => void reload()} style={[styles.banner, { backgroundColor: theme.danger }]}>
          <Text style={styles.bannerText}>Connection problem · tap to retry</Text>
        </Pressable>
      ) : null}

      <FlatList
        data={rows}
        keyExtractor={(item) => item.user.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: insets.bottom + 12 }}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>
              {query ? 'No matches' : 'No contacts yet'}
            </Text>
            <Text style={[styles.emptyText, { color: theme.subText }]}>
              {query
                ? 'Try a different name.'
                : 'Create another account on a second device or browser tab. Every registered user shows up here.'}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingBottom: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  logout: { marginLeft: 14 },
  title: { fontSize: 22, fontWeight: '800' },
  search: { height: 40, borderRadius: 20, paddingHorizontal: 16, fontSize: 15 },
  banner: { paddingVertical: 8, alignItems: 'center' },
  bannerText: { color: '#FFFFFF', fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', paddingLeft: 16 },
  rowBody: { flex: 1, marginLeft: 14, paddingVertical: 14, paddingRight: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 3 },
  previewWrap: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  tickBox: { marginRight: 4 },
  name: { flex: 1, fontSize: 17, fontWeight: '600', marginRight: 8 },
  time: { fontSize: 12 },
  preview: { flex: 1, fontSize: 14.5 },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  badgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  empty: { paddingTop: 80, paddingHorizontal: 40, alignItems: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptyText: { fontSize: 14.5, textAlign: 'center', lineHeight: 21 },
});