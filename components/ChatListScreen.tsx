import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  ListRenderItemInfo,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useChat } from '../lib/ChatContext';
import { useTheme, type Theme } from '../lib/theme';
import type { Message, Profile } from '../lib/types';
import { listTimeLabel } from '../lib/utils';
import { Avatar } from './Avatar';
import { FadeIn } from './FadeIn';
import { ProfileModal } from './ProfileModal';
import { Sidebar } from './Sidebar';
import { Ticks } from './Ticks';

const webReset: any = Platform.OS === 'web' ? { outlineStyle: 'none' } : null;

type Filter = 'all' | 'unread' | 'online';
type RowItem = { user: Profile; last: Message | null; unread: number };

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'online', label: 'Online' },
];

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

/** Horizontal strip of everyone who is online right now. */
function OnlineStrip({ users, theme, onPress }: { users: Profile[]; theme: Theme; onPress: (id: string) => void }) {
  return (
    <View style={[styles.strip, { borderBottomColor: theme.divider }]}>
      <Text style={[styles.stripTitle, { color: theme.subText }]}>ONLINE NOW</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stripContent}>
        {users.map((u) => (
          <Pressable key={u.id} onPress={() => onPress(u.id)} style={styles.stripItem}>
            <Avatar name={u.username} size={54} online ringColor={theme.background} onlineColor={theme.online} />
            <Text numberOfLines={1} style={[styles.stripName, { color: theme.text }]}>
              {u.username.split(' ')[0]}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

export function ChatListScreen({ onOpen }: { onOpen: (peerId: string) => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { me, users, messages, onlineIds, typingIds, error, reload } = useChat();

  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const openProfile = useCallback(() => setProfileOpen(true), []);
  const closeProfile = useCallback(() => setProfileOpen(false), []);

  const closeSearch = useCallback(() => {
    setSearching(false);
    setQuery('');
  }, []);

  // Every contact with their last message and unread count, newest chat first.
  const allRows = useMemo<RowItem[]>(() => {
    const items = users.map((u) => {
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
  }, [users, messages]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allRows.filter((r) => {
      if (q && !r.user.username.toLowerCase().includes(q)) return false;
      if (filter === 'unread') return r.unread > 0;
      if (filter === 'online') return onlineIds.has(r.user.id);
      return true;
    });
  }, [allRows, query, filter, onlineIds]);

  const unreadTotal = useMemo(() => allRows.reduce((n, r) => n + r.unread, 0), [allRows]);
  const onlineUsers = useMemo(() => users.filter((u) => onlineIds.has(u.id)), [users, onlineIds]);

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

  const showStrip = filter === 'all' && !query && onlineUsers.length > 0;

  const emptyTitle = query
    ? 'No matches'
    : filter === 'unread'
    ? 'No unread chats'
    : filter === 'online'
    ? 'Nobody is online'
    : 'No contacts yet';
  const emptyText = query
    ? 'Try a different name.'
    : filter === 'unread'
    ? 'You are all caught up.'
    : filter === 'online'
    ? 'People who are online right now will show up here.'
    : 'Create another account on a second device or browser tab. Every registered user shows up here.';

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {/* ------------------------------ header ------------------------------ */}
      <View style={[styles.header, { backgroundColor: theme.header, paddingTop: insets.top + 10 }]}>
        <View style={styles.headerRow}>
          {searching ? (
            <>
              <Pressable onPress={closeSearch} hitSlop={10} style={styles.iconBtn}>
                <Ionicons name="arrow-back" size={24} color={theme.headerText} />
              </Pressable>
              <TextInput
                autoFocus
                style={[
                  styles.searchInput,
                  { backgroundColor: theme.dark ? theme.searchBg : '#FFFFFF22', color: theme.headerText },
                  webReset,
                ]}
                placeholder="Search chats"
                placeholderTextColor={theme.headerSubText}
                value={query}
                onChangeText={setQuery}
              />
              {query ? (
                <Pressable onPress={() => setQuery('')} hitSlop={10} style={styles.iconBtn}>
                  <Ionicons name="close" size={22} color={theme.headerText} />
                </Pressable>
              ) : null}
            </>
          ) : (
            <>
              <Pressable onPress={() => setDrawerOpen(true)} hitSlop={10} style={styles.iconBtn}>
                <Ionicons name="menu" size={28} color={theme.headerText} />
                {unreadTotal > 0 ? <View style={[styles.menuDot, { backgroundColor: theme.online, borderColor: theme.header }]} /> : null}
              </Pressable>
              <Text style={[styles.title, { color: theme.headerText }]}>AlphaChat</Text>
              <Pressable onPress={() => setSearching(true)} hitSlop={10} style={styles.iconBtn}>
                <Ionicons name="search" size={22} color={theme.headerText} />
              </Pressable>
              <Pressable onPress={openProfile} hitSlop={6} style={styles.avatarBtn}>
                {me ? (
                  <Avatar name={me.username} size={34} online ringColor={theme.header} onlineColor={theme.online} />
                ) : null}
              </Pressable>
            </>
          )}
        </View>
      </View>

      {/* ---------------------------- filter chips --------------------------- */}
      <View style={styles.chips}>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          const count = f.key === 'unread' ? unreadTotal : f.key === 'online' ? onlineUsers.length : 0;
          return (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[styles.chip, { backgroundColor: active ? theme.accent : theme.searchBg }]}
            >
              <Text style={{ color: active ? '#FFFFFF' : theme.subText, fontSize: 14, fontWeight: '600' }}>
                {f.label}
                {count > 0 ? `  ${count}` : ''}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {error ? (
        <Pressable onPress={() => void reload()} style={[styles.banner, { backgroundColor: theme.danger }]}>
          <Text style={styles.bannerText}>Connection problem · tap to retry</Text>
        </Pressable>
      ) : null}

      {/* ------------------------------- list -------------------------------- */}
      <FlatList
        data={rows}
        keyExtractor={(item) => item.user.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: insets.bottom + 12 }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={showStrip ? <OnlineStrip users={onlineUsers} theme={theme} onPress={onOpen} /> : undefined}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>{emptyTitle}</Text>
            <Text style={[styles.emptyText, { color: theme.subText }]}>{emptyText}</Text>
          </View>
        }
      />

      {/* sidebar + profile sit on top of everything */}
      <Sidebar visible={drawerOpen} onClose={closeDrawer} onOpenProfile={openProfile} />
      <ProfileModal visible={profileOpen} onClose={closeProfile} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 12, paddingBottom: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', height: 44 },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  avatarBtn: { marginLeft: 6 },
  title: { flex: 1, fontSize: 22, fontWeight: '800', marginLeft: 6 },
  searchInput: { flex: 1, height: 40, borderRadius: 20, paddingHorizontal: 16, fontSize: 15, marginLeft: 4 },
  menuDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 2,
  },
  chips: { flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 10 },
  chip: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 18, marginRight: 8 },
  banner: { paddingVertical: 8, alignItems: 'center' },
  bannerText: { color: '#FFFFFF', fontWeight: '600' },
  strip: { paddingTop: 4, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  stripTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, marginLeft: 16, marginBottom: 10 },
  stripContent: { paddingHorizontal: 12 },
  stripItem: { width: 68, alignItems: 'center', marginHorizontal: 2 },
  stripName: { fontSize: 12.5, marginTop: 6, maxWidth: 64 },
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