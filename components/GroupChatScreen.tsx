import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  ListRenderItemInfo,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
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
import {
  groupApi,
  type GroupMember,
  type GroupMessage,
  type GroupReaction,
  type GroupReportReason,
} from '../lib/groupApi';
import { useGroups } from '../lib/groups';
import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/theme';
import { dayKey, dayLabel, uuidv4 } from '../lib/utils';
import { GroupAvatar } from './GroupAvatar';
import { GroupInfoScreen } from './GroupInfoScreen';
import { GroupMessageBubble, type ReactionChip } from './GroupMessageBubble';
import { MessageActionsModal } from './MessageActionsModal';

const webReset: any = Platform.OS === 'web' ? { outlineStyle: 'none' } : null;
const PAGE = 40;

type Row =
  | { kind: 'day'; id: string; label: string }
  | { kind: 'msg'; id: string; message: GroupMessage; showName: boolean };

function sortNewestFirst(list: GroupMessage[]): GroupMessage[] {
  return [...list].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
}

export function GroupChatScreen({ groupId, onBack }: { groupId: string; onBack: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { me } = useChat();
  const { groups, loading: groupsLoading, refresh } = useGroups();

  const group = groups.find((g) => g.id === groupId);
  const meId = me?.id ?? '';
  const isAdmin = group?.role === 'owner' || group?.role === 'admin';
  const canPost = !!group && (!group.onlyAdminsPost || isAdmin);

  const [messages, setMessages] = useState<GroupMessage[]>([]); // newest first
  const [pinned, setPinned] = useState<GroupMessage[]>([]);
  const [reactions, setReactions] = useState<GroupReaction[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);

  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<GroupMessage | null>(null);
  const [mentionIds, setMentionIds] = useState<Record<string, string>>({});
  const [sendError, setSendError] = useState<string | null>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  const [actionMsg, setActionMsg] = useState<GroupMessage | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [pinnedOpen, setPinnedOpen] = useState(false);

  const listRef = useRef<FlatList<Row>>(null);

  /* ------------------------------- loading ------------------------------- */

  const loadPinned = useCallback(async () => {
    const { data } = await supabase
      .from('group_messages')
      .select('*')
      .eq('group_id', groupId)
      .not('pinned_at', 'is', null)
      .is('deleted_at', null)
      .order('pinned_at', { ascending: false });
    if (data) setPinned(data as GroupMessage[]);
  }, [groupId]);

  const loadMembers = useCallback(async () => {
    try {
      setMembers(await groupApi.members(groupId));
    } catch {
      /* keep the old list */
    }
  }, [groupId]);

  const loadInitial = useCallback(async () => {
    const { data } = await supabase
      .from('group_messages')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })
      .limit(PAGE);
    if (data) {
      setMessages(data as GroupMessage[]);
      setHasMore(data.length === PAGE);
    }
    const r = await supabase.from('group_reactions').select('message_id, user_id, emoji').eq('group_id', groupId);
    if (r.data) setReactions(r.data as GroupReaction[]);
    void loadPinned();
    void loadMembers();
  }, [groupId, loadPinned, loadMembers]);

  useEffect(() => {
    void loadInitial();

    const channel = supabase
      .channel(`group-chat:${groupId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'group_messages', filter: `group_id=eq.${groupId}` },
        (payload) => {
          const m = payload.new as GroupMessage;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev.map((x) => (x.id === m.id ? m : x)) : sortNewestFirst([m, ...prev])));
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'group_messages', filter: `group_id=eq.${groupId}` },
        (payload) => {
          const m = payload.new as GroupMessage;
          setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, ...m } : x)));
          void loadPinned();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'group_reactions', filter: `group_id=eq.${groupId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const r = payload.new as GroupReaction;
            setReactions((prev) =>
              prev.some((x) => x.message_id === r.message_id && x.user_id === r.user_id && x.emoji === r.emoji) ? prev : [...prev, r]
            );
          } else if (payload.eventType === 'DELETE') {
            const r = payload.old as Partial<GroupReaction>;
            setReactions((prev) =>
              prev.filter((x) => !(x.message_id === r.message_id && x.user_id === r.user_id && x.emoji === r.emoji))
            );
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'group_members', filter: `group_id=eq.${groupId}` },
        () => void loadMembers()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [groupId, loadInitial, loadPinned, loadMembers]);

  // If the group disappears from my list (removed, left, deleted), close the chat.
  useEffect(() => {
    if (!groupsLoading && !group) onBack();
  }, [groupsLoading, group, onBack]);

  // Mark as read when I open the chat and whenever something new arrives.
  const newestId = messages[0]?.id;
  useEffect(() => {
    if (!newestId) return;
    const t = setTimeout(() => {
      void groupApi.markRead(groupId).then(() => refresh()).catch(() => undefined);
    }, 400);
    return () => clearTimeout(t);
  }, [newestId, groupId, refresh]);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const a = Keyboard.addListener(showEvt, () => setKeyboardOpen(true));
    const b = Keyboard.addListener(hideEvt, () => setKeyboardOpen(false));
    return () => {
      a.remove();
      b.remove();
    };
  }, []);

  const loadOlder = useCallback(async () => {
    if (!hasMore || loadingOlder || messages.length === 0) return;
    setLoadingOlder(true);
    const oldest = messages[messages.length - 1];
    const { data } = await supabase
      .from('group_messages')
      .select('*')
      .eq('group_id', groupId)
      .lt('created_at', oldest.created_at)
      .order('created_at', { ascending: false })
      .limit(PAGE);
    if (data) {
      setMessages((prev) => {
        const have = new Set(prev.map((m) => m.id));
        return [...prev, ...(data as GroupMessage[]).filter((m) => !have.has(m.id))];
      });
      setHasMore(data.length === PAGE);
    }
    setLoadingOlder(false);
  }, [hasMore, loadingOlder, messages, groupId]);

  /* ------------------------------- derived ------------------------------- */

  const rows = useMemo<Row[]>(() => {
    const chrono = [...messages].reverse();
    const out: Row[] = [];
    let lastDay = '';
    chrono.forEach((m, i) => {
      const dk = dayKey(m.created_at);
      if (dk !== lastDay) {
        out.push({ kind: 'day', id: `day-${dk}`, label: dayLabel(m.created_at) });
        lastDay = dk;
      }
      const prev = chrono[i - 1];
      const showName =
        m.kind === 'text' && (!prev || prev.kind !== 'text' || prev.sender_id !== m.sender_id || dayKey(prev.created_at) !== dk);
      out.push({ kind: 'msg', id: m.id, message: m, showName });
    });
    return out.reverse(); // inverted list: newest first
  }, [messages]);

  const reactionMap = useMemo(() => {
    const map: Record<string, ReactionChip[]> = {};
    for (const r of reactions) {
      const list = (map[r.message_id] ??= []);
      let chip = list.find((c) => c.emoji === r.emoji);
      if (!chip) {
        chip = { emoji: r.emoji, count: 0, mine: false };
        list.push(chip);
      }
      chip.count += 1;
      if (r.user_id === meId) chip.mine = true;
    }
    return map;
  }, [reactions, meId]);

  const memberNames = useMemo(() => members.map((m) => m.username), [members]);

  const mentionQuery = useMemo(() => {
    const m = /(?:^|\s)@([^\s@]*)$/.exec(text);
    return m ? m[1].toLowerCase() : null;
  }, [text]);

  const suggestions = useMemo(() => {
    if (mentionQuery === null) return [];
    return members.filter((m) => m.userId !== meId && m.username.toLowerCase().includes(mentionQuery)).slice(0, 5);
  }, [mentionQuery, members, meId]);

  /* ------------------------------- actions ------------------------------- */

  const pickMention = (m: GroupMember) => {
    setText((t) => t.replace(/@([^\s@]*)$/, `@${m.username} `));
    setMentionIds((prev) => ({ ...prev, [m.userId]: m.username }));
  };

  const send = useCallback(async () => {
    const content = text.trim();
    if (!content || !canPost || !me) return;
    const id = uuidv4();
    const mentionList = Object.keys(mentionIds).filter((uid) => content.includes(`@${mentionIds[uid]}`));
    const reply = replyTo;
    const optimistic: GroupMessage = {
      id,
      group_id: groupId,
      sender_id: meId,
      sender_name: me.username,
      kind: 'text',
      content,
      reply_to: reply?.id ?? null,
      reply_sender: reply?.sender_name ?? null,
      reply_preview: reply ? (reply.deleted_at ? 'Deleted message' : reply.content.slice(0, 120)) : null,
      mentions: mentionList,
      pinned_at: null,
      deleted_at: null,
      created_at: new Date().toISOString(),
      pending: true,
    };
    setMessages((prev) => [optimistic, ...prev]);
    setText('');
    setReplyTo(null);
    setMentionIds({});
    setSendError(null);
    requestAnimationFrame(() => listRef.current?.scrollToOffset({ offset: 0, animated: true }));

    const { error } = await supabase
      .from('group_messages')
      .insert({ id, group_id: groupId, content, reply_to: optimistic.reply_to, mentions: mentionList });

    if (error) {
      setMessages((prev) => prev.filter((m) => m.id !== id));
      setText(content);
      setSendError(error.message);
    } else {
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, pending: false } : m)));
    }
  }, [text, canPost, me, mentionIds, replyTo, groupId, meId]);

  const toggleReaction = useCallback(
    (messageId: string, emoji: string) => {
      // optimistic: flip locally, the realtime event confirms it
      setReactions((prev) => {
        const exists = prev.some((r) => r.message_id === messageId && r.user_id === meId && r.emoji === emoji);
        return exists
          ? prev.filter((r) => !(r.message_id === messageId && r.user_id === meId && r.emoji === emoji))
          : [...prev, { message_id: messageId, user_id: meId, emoji }];
      });
      void groupApi.react(messageId, emoji).catch((e) => {
        setSendError(e instanceof Error ? e.message : 'Could not react.');
        void loadInitial();
      });
    },
    [meId, loadInitial]
  );

  const handleBack = useCallback(() => {
    Keyboard.dismiss();
    void groupApi.markRead(groupId).catch(() => undefined);
    onBack();
  }, [groupId, onBack]);

  const onScrollEnd = useCallback(() => void loadOlder(), [loadOlder]);
  const noop = useCallback((_e: NativeSyntheticEvent<NativeScrollEvent>) => undefined, []);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Row>) => {
      if (item.kind === 'day') {
        return (
          <View style={styles.dayWrap}>
            <View style={[styles.dayChip, { backgroundColor: theme.chipBg }]}>
              <Text style={{ color: theme.chipText, fontSize: 12.5, fontWeight: '600' }}>{item.label}</Text>
            </View>
          </View>
        );
      }
      return (
        <GroupMessageBubble
          message={item.message}
          mine={item.message.sender_id === meId}
          showName={item.showName}
          memberNames={memberNames}
          reactions={reactionMap[item.message.id] ?? []}
          theme={theme}
          onOpenActions={setActionMsg}
          onToggleReaction={toggleReaction}
        />
      );
    },
    [theme, meId, memberNames, reactionMap, toggleReaction]
  );

  if (!group) return null;

  const topPinned = pinned[0];
  const placeholder = !canPost
    ? 'Only admins can send messages'
    : group.slowModeSeconds > 0 && !isAdmin
    ? `Message · slow mode ${group.slowModeSeconds >= 60 ? `${group.slowModeSeconds / 60} min` : `${group.slowModeSeconds}s`}`
    : 'Message';

  return (
    <View style={{ flex: 1, backgroundColor: theme.chatBackground }}>
      {/* header */}
      <View style={[styles.header, { backgroundColor: theme.header, paddingTop: insets.top + 8 }]}>
        <Pressable onPress={handleBack} hitSlop={14} style={styles.backBtn}>
          <View style={[styles.backChevron, { borderColor: theme.headerText }]} />
        </Pressable>
        <Pressable onPress={() => setInfoOpen(true)} style={styles.headerMain}>
          <GroupAvatar name={group.name} size={40} />
          <View style={styles.headerText}>
            <Text numberOfLines={1} style={[styles.headerName, { color: theme.headerText }]}>
              {group.name}
            </Text>
            <Text numberOfLines={1} style={{ color: theme.headerSubText, fontSize: 12.5 }}>
              {group.memberCount} {group.memberCount === 1 ? 'member' : 'members'} · tap for group info
            </Text>
          </View>
        </Pressable>
        <Pressable onPress={() => setInfoOpen(true)} hitSlop={12} style={styles.menuBtn} accessibilityLabel="Group info">
          <Ionicons name="information-circle-outline" size={26} color={theme.headerText} />
        </Pressable>
      </View>

      {/* pinned banner */}
      {topPinned ? (
        <Pressable
          onPress={() => setPinnedOpen(true)}
          style={[styles.pinBar, { backgroundColor: theme.background, borderBottomColor: theme.divider }]}
        >
          <Ionicons name="pin" size={16} color={theme.accent} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text numberOfLines={1} style={{ color: theme.accent, fontSize: 12.5, fontWeight: '700' }}>
              Pinned {pinned.length > 1 ? `· ${pinned.length} messages` : 'message'}
            </Text>
            <Text numberOfLines={1} style={{ color: theme.text, fontSize: 14 }}>
              {topPinned.sender_name}: {topPinned.content}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.subText} />
        </Pressable>
      ) : null}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <View style={{ flex: 1 }}>
          <FlatList
            ref={listRef}
            data={rows}
            inverted
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            onScroll={noop}
            onEndReached={onScrollEnd}
            onEndReachedThreshold={0.3}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingVertical: 10 }}
          />
          {rows.length === 0 ? (
            <View style={styles.emptyWrap} pointerEvents="none">
              <View style={[styles.emptyChip, { backgroundColor: theme.chipBg }]}>
                <Text style={{ color: theme.chipText, fontSize: 14 }}>No messages yet. Say hi 👋</Text>
              </View>
            </View>
          ) : null}
        </View>

        {/* mention suggestions */}
        {suggestions.length > 0 ? (
          <View style={[styles.suggest, { backgroundColor: theme.background, borderTopColor: theme.divider }]}>
            {suggestions.map((m) => (
              <Pressable key={m.userId} onPress={() => pickMention(m)} style={styles.suggestRow}>
                <Text style={{ color: theme.accent, fontWeight: '700' }}>@</Text>
                <Text style={{ color: theme.text, fontSize: 15.5, marginLeft: 4 }}>{m.username}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {/* reply bar */}
        {replyTo ? (
          <View style={[styles.replyBar, { backgroundColor: theme.background, borderTopColor: theme.divider }]}>
            <View style={[styles.replyLine, { backgroundColor: theme.accent }]} />
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ color: theme.accent, fontWeight: '700', fontSize: 13 }}>
                Replying to {replyTo.sender_name}
              </Text>
              <Text numberOfLines={1} style={{ color: theme.subText, fontSize: 13.5 }}>
                {replyTo.deleted_at ? 'Deleted message' : replyTo.content}
              </Text>
            </View>
            <Pressable onPress={() => setReplyTo(null)} hitSlop={10}>
              <Ionicons name="close" size={22} color={theme.subText} />
            </Pressable>
          </View>
        ) : null}

        {sendError ? (
          <Pressable onPress={() => setSendError(null)} style={[styles.errorBar, { backgroundColor: theme.danger }]}>
            <Text style={{ color: '#FFFFFF', fontSize: 13.5, textAlign: 'center' }}>{sendError} (tap to dismiss)</Text>
          </Pressable>
        ) : null}

        {/* input */}
        <View style={[styles.inputBar, { paddingBottom: keyboardOpen ? 6 : insets.bottom + 6 }]}>
          <View style={[styles.inputWrap, { backgroundColor: theme.inputBg }]}>
            <TextInput
              style={[styles.input, { color: theme.text }, webReset]}
              placeholder={placeholder}
              placeholderTextColor={theme.subText}
              value={text}
              onChangeText={setText}
              editable={canPost}
              multiline
              maxLength={4000}
              underlineColorAndroid="transparent"
              onKeyPress={(e) => {
                const native = e.nativeEvent as unknown as { key: string; shiftKey?: boolean };
                if (Platform.OS === 'web' && native.key === 'Enter' && !native.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
          </View>
          <Pressable
            onPress={() => void send()}
            disabled={!canPost || text.trim().length === 0}
            style={[styles.sendBtn, { backgroundColor: theme.accent, opacity: canPost && text.trim().length > 0 ? 1 : 0.55 }]}
          >
            <Ionicons name="send" size={20} color="#FFFFFF" style={{ marginLeft: 2 }} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* message actions */}
      <MessageActionsModal
        message={actionMsg}
        mine={!!actionMsg && actionMsg.sender_id === meId}
        isAdmin={!!isAdmin}
        onClose={() => setActionMsg(null)}
        onReact={(emoji) => actionMsg && toggleReaction(actionMsg.id, emoji)}
        onReply={() => actionMsg && setReplyTo(actionMsg)}
        onPin={async (pin) => {
          if (actionMsg) await groupApi.pin(actionMsg.id, pin);
        }}
        onDelete={async () => {
          if (actionMsg) await groupApi.deleteMessage(actionMsg.id);
        }}
        onReport={async (reason: GroupReportReason) => {
          if (actionMsg) await groupApi.report(groupId, actionMsg.id, reason);
        }}
      />

      {/* pinned list */}
      <Modal visible={pinnedOpen} transparent animationType="fade" onRequestClose={() => setPinnedOpen(false)}>
        <View style={styles.modalWrap}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setPinnedOpen(false)} />
          <View style={[styles.pinSheet, { backgroundColor: theme.background, paddingBottom: insets.bottom + 14 }]}>
            <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700', marginBottom: 10 }}>Pinned messages</Text>
            <ScrollView style={{ maxHeight: 360 }}>
              {pinned.map((m) => (
                <View key={m.id} style={[styles.pinItem, { borderBottomColor: theme.divider }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.accent, fontWeight: '700', fontSize: 13 }}>{m.sender_name}</Text>
                    <Text style={{ color: theme.text, fontSize: 15, marginTop: 2 }}>{m.content}</Text>
                  </View>
                  {isAdmin ? (
                    <Pressable onPress={() => void groupApi.pin(m.id, false).catch(() => undefined)} hitSlop={10}>
                      <Ionicons name="close-circle-outline" size={24} color={theme.subText} />
                    </Pressable>
                  ) : null}
                </View>
              ))}
              {pinned.length === 0 ? <Text style={{ color: theme.subText }}>Nothing is pinned.</Text> : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <GroupInfoScreen
        visible={infoOpen}
        groupId={groupId}
        onClose={() => setInfoOpen(false)}
        onLeft={() => {
          setInfoOpen(false);
          onBack();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingBottom: 10 },
  backBtn: { width: 34, height: 40, alignItems: 'center', justifyContent: 'center' },
  backChevron: {
    width: 12,
    height: 12,
    borderLeftWidth: 2.5,
    borderBottomWidth: 2.5,
    transform: [{ rotate: '45deg' }],
    marginLeft: 4,
  },
  headerMain: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  headerText: { flex: 1, marginLeft: 12 },
  headerName: { fontSize: 17, fontWeight: '700' },
  menuBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  pinBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  dayWrap: { alignItems: 'center', marginVertical: 10 },
  dayChip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8 },
  emptyWrap: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  emptyChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
  suggest: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 4 },
  suggestRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  replyBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth },
  replyLine: { width: 3, alignSelf: 'stretch', borderRadius: 2, marginRight: 10 },
  errorBar: { paddingVertical: 8, paddingHorizontal: 12 },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 8, paddingTop: 6 },
  inputWrap: { flex: 1, borderRadius: 24, paddingHorizontal: 16, marginRight: 8, justifyContent: 'center' },
  input: {
    fontSize: 16,
    maxHeight: 120,
    minHeight: 44,
    paddingTop: Platform.OS === 'ios' ? 12 : 10,
    paddingBottom: Platform.OS === 'ios' ? 12 : 10,
  },
  sendBtn: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  modalWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  pinSheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 20, paddingTop: 18 },
  pinItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
});
