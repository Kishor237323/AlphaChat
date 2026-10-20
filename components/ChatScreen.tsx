import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  ListRenderItemInfo,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useChat } from '../lib/ChatContext';
import { USE_NATIVE_DRIVER, useTheme, type Theme } from '../lib/theme';
import type { Message } from '../lib/types';
import { dayKey, dayLabel, lastSeenLabel } from '../lib/utils';
import { Avatar } from './Avatar';
import { MessageBubble } from './MessageBubble';
import { TypingBubble } from './TypingIndicator';

const EMPTY_LIST: Message[] = [];
const webReset: any = Platform.OS === 'web' ? { outlineStyle: 'none' } : null;

type Row =
  | { kind: 'day'; id: string; label: string }
  | { kind: 'msg'; id: string; message: Message; first: boolean };

function StatusLine({ text, color }: { text: string; color: string }) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    opacity.setValue(0);
    Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: USE_NATIVE_DRIVER }).start();
  }, [text, opacity]);

  return (
    <Animated.Text numberOfLines={1} style={{ opacity, color, fontSize: 12.5 }}>
      {text}
    </Animated.Text>
  );
}

function DayChip({ label, theme }: { label: string; theme: Theme }) {
  return (
    <View style={styles.dayWrap}>
      <View style={[styles.dayChip, { backgroundColor: theme.chipBg }]}>
        <Text style={{ color: theme.chipText, fontSize: 12.5, fontWeight: '600' }}>{label}</Text>
      </View>
    </View>
  );
}

function SendButton({ enabled, onPress, color }: { enabled: boolean; onPress: () => void; color: string }) {
  const scale = useRef(new Animated.Value(enabled ? 1 : 0.85)).current;

  useEffect(() => {
    Animated.spring(scale, { toValue: enabled ? 1 : 0.85, friction: 6, useNativeDriver: USE_NATIVE_DRIVER }).start();
  }, [enabled, scale]);

  return (
    <Pressable onPress={onPress} disabled={!enabled} hitSlop={8}>
      <Animated.View
        style={[styles.sendBtn, { backgroundColor: color, opacity: enabled ? 1 : 0.55, transform: [{ scale }] }]}
      >
        <View style={styles.sendTriangle} />
      </Animated.View>
    </Pressable>
  );
}

function ScrollFab({ visible, count, onPress, theme }: { visible: boolean; count: number; onPress: () => void; theme: Theme }) {
  const scale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(scale, { toValue: visible ? 1 : 0, friction: 7, useNativeDriver: USE_NATIVE_DRIVER }).start();
  }, [visible, scale]);

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[styles.fabWrap, { transform: [{ scale }], opacity: scale }]}
    >
      <Pressable onPress={onPress} style={[styles.fab, { backgroundColor: theme.bubbleTheirs }]}>
        <View style={[styles.fabChevron, { borderColor: theme.subText }]} />
        {count > 0 ? (
          <View style={[styles.fabBadge, { backgroundColor: theme.accent }]}>
            <Text style={styles.fabBadgeText}>{count > 99 ? '99+' : count}</Text>
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

export function ChatScreen({ peerId, onBack }: { peerId: string; onBack: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { me, users, messages, onlineIds, typingIds, sendMessage, retryMessage, notifyTyping, stopTyping, setActivePeer } =
    useChat();

  const peer = users.find((u) => u.id === peerId);
  const list = messages[peerId] ?? EMPTY_LIST;
  const meId = me?.id ?? '';
  const isOnline = onlineIds.has(peerId);
  const isTyping = !!typingIds[peerId];

  const [text, setText] = useState('');
  const [showFab, setShowFab] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const listRef = useRef<FlatList<Row>>(null);
  const showFabRef = useRef(false);
  const lastIdRef = useRef<string | null>(null);

  // Tell the provider which chat is open (drives read receipts).
  useEffect(() => {
    setActivePeer(peerId);
    return () => {
      setActivePeer(null);
      stopTyping(peerId);
    };
  }, [peerId, setActivePeer, stopTyping]);

  // Keyboard visibility decides whether to add the bottom safe-area padding.
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

  // Count incoming messages that arrive while the user has scrolled up.
  useEffect(() => {
    const last = list[list.length - 1];
    if (!last) return;
    if (lastIdRef.current && last.id !== lastIdRef.current && last.sender_id === peerId && showFabRef.current) {
      setNewCount((c) => c + 1);
    }
    lastIdRef.current = last.id;
  }, [list, peerId]);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    let lastDay = '';
    list.forEach((m, i) => {
      const dk = dayKey(m.created_at);
      if (dk !== lastDay) {
        out.push({ kind: 'day', id: `day-${dk}`, label: dayLabel(m.created_at) });
        lastDay = dk;
      }
      const prev = list[i - 1];
      const first = !prev || prev.sender_id !== m.sender_id || dayKey(prev.created_at) !== dk;
      out.push({ kind: 'msg', id: m.id, message: m, first });
    });
    return out.reverse(); // the list is inverted, so newest comes first
  }, [list]);

  const handleRetry = useCallback((id: string) => void retryMessage(peerId, id), [peerId, retryMessage]);

  const scrollToBottom = useCallback(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
    setNewCount(0);
  }, []);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const far = e.nativeEvent.contentOffset.y > 320;
    if (far !== showFabRef.current) {
      showFabRef.current = far;
      setShowFab(far);
      if (!far) setNewCount(0);
    }
  }, []);

  const handleChange = useCallback(
    (value: string) => {
      setText(value);
      if (value.trim().length > 0) notifyTyping(peerId);
      else stopTyping(peerId);
    },
    [peerId, notifyTyping, stopTyping]
  );

  const handleSend = useCallback(() => {
    const value = text.trim();
    if (!value) return;
    setText('');
    stopTyping(peerId);
    void sendMessage(peerId, value);
    requestAnimationFrame(() => listRef.current?.scrollToOffset({ offset: 0, animated: true }));
  }, [text, peerId, sendMessage, stopTyping]);

  const handleBack = useCallback(() => {
    Keyboard.dismiss();
    onBack();
  }, [onBack]);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Row>) => {
      if (item.kind === 'day') return <DayChip label={item.label} theme={theme} />;
      return (
        <MessageBubble
          message={item.message}
          mine={item.message.sender_id === meId}
          first={item.first}
          theme={theme}
          onRetry={handleRetry}
        />
      );
    },
    [theme, meId, handleRetry]
  );

  if (!peer) return null;

  const statusText = isTyping ? 'typing…' : isOnline ? 'online' : lastSeenLabel(peer.last_seen);
  const statusColor = isTyping ? '#9BF2CF' : theme.headerSubText;
  const canSend = text.trim().length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: theme.chatBackground }}>
      <View style={[styles.header, { backgroundColor: theme.header, paddingTop: insets.top + 8 }]}>
        <Pressable onPress={handleBack} hitSlop={14} style={styles.backBtn}>
          <View style={[styles.backChevron, { borderColor: theme.headerText }]} />
        </Pressable>
        <Avatar name={peer.username} size={40} online={isOnline} ringColor={theme.header} onlineColor={theme.online} />
        <View style={styles.headerText}>
          <Text numberOfLines={1} style={[styles.headerName, { color: theme.headerText }]}>
            {peer.username}
          </Text>
          <StatusLine text={statusText} color={statusColor} />
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <View style={{ flex: 1 }}>
          <FlatList
            ref={listRef}
            data={rows}
            inverted
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            onScroll={onScroll}
            scrollEventThrottle={16}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingVertical: 10 }}
            ListHeaderComponent={isTyping ? <TypingBubble theme={theme} /> : null}
          />

          {rows.length === 0 && !isTyping ? (
            <View style={styles.emptyWrap} pointerEvents="none">
              <View style={[styles.emptyChip, { backgroundColor: theme.chipBg }]}>
                <Text style={{ color: theme.chipText, fontSize: 14 }}>No messages yet. Say hi 👋</Text>
              </View>
            </View>
          ) : null}

          <ScrollFab visible={showFab} count={newCount} onPress={scrollToBottom} theme={theme} />
        </View>

        <View style={[styles.inputBar, { paddingBottom: keyboardOpen ? 6 : insets.bottom + 6 }]}>
          <View style={[styles.inputWrap, { backgroundColor: theme.inputBg }]}>
            <TextInput
              style={[styles.input, { color: theme.text }, webReset]}
              placeholder="Message"
              placeholderTextColor={theme.subText}
              value={text}
              onChangeText={handleChange}
              multiline
              maxLength={4000}
              underlineColorAndroid="transparent"
              onKeyPress={(e) => {
                const native = e.nativeEvent as unknown as { key: string; shiftKey?: boolean };
                if (Platform.OS === 'web' && native.key === 'Enter' && !native.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
          </View>
          <SendButton enabled={canSend} onPress={handleSend} color={theme.accent} />
        </View>
      </KeyboardAvoidingView>
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
  headerText: { flex: 1, marginLeft: 12 },
  headerName: { fontSize: 17, fontWeight: '700' },
  dayWrap: { alignItems: 'center', marginVertical: 10 },
  dayChip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8 },
  emptyWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  emptyChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
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
  sendTriangle: {
    width: 0,
    height: 0,
    marginLeft: 3,
    borderTopWidth: 8,
    borderBottomWidth: 8,
    borderLeftWidth: 13,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: '#FFFFFF',
  },
  fabWrap: { position: 'absolute', right: 14, bottom: 12 },
  fab: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  fabChevron: {
    width: 11,
    height: 11,
    borderRightWidth: 2.5,
    borderBottomWidth: 2.5,
    transform: [{ rotate: '45deg' }],
    marginTop: -4,
  },
  fabBadge: {
    position: 'absolute',
    top: -8,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
});