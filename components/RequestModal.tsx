import React, { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useChat } from '../lib/ChatContext';
import { useConnections } from '../lib/connections';
import { useTheme } from '../lib/theme';
import { Avatar } from './Avatar';

export function RequestsModal({
  visible,
  onClose,
  onOpenChat,
}: {
  visible: boolean;
  onClose: () => void;
  onOpenChat: (peerId: string) => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { users, messages } = useChat();
  const { incoming, respond, block } = useConnections();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (id: string, fn: () => Promise<void>, then?: () => void) => {
    setBusyId(id);
    setError(null);
    try {
      await fn();
      then?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <View style={[styles.header, { backgroundColor: theme.header, paddingTop: insets.top + 10 }]}>
          <Pressable onPress={onClose} hitSlop={10} style={styles.iconBtn}>
            <Ionicons name="arrow-back" size={24} color={theme.headerText} />
          </Pressable>
          <Text style={[styles.title, { color: theme.headerText }]}>Message requests</Text>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
          <Text style={[styles.note, { color: theme.subText }]}>
            These people are not in your chats yet. They cannot send you more than a few messages until you accept.
          </Text>

          {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}

          {incoming.length === 0 ? (
            <View style={styles.empty}>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No requests</Text>
              <Text style={{ color: theme.subText, fontSize: 14.5 }}>New requests will show up here.</Text>
            </View>
          ) : null}

          {incoming.map((c) => {
            const user = users.find((u) => u.id === c.peerId);
            if (!user) return null;
            const first = (messages[c.peerId] ?? []).find((m) => m.sender_id === c.peerId);
            const busy = busyId === c.peerId;
            return (
              <View key={c.peerId} style={[styles.card, { borderBottomColor: theme.divider }]}>
                <Pressable
                  onPress={() => {
                    onClose();
                    onOpenChat(c.peerId);
                  }}
                  style={styles.top}
                >
                  <Avatar name={user.username} size={48} ringColor={theme.background} onlineColor={theme.online} />
                  <View style={styles.topText}>
                    <Text numberOfLines={1} style={[styles.name, { color: theme.text }]}>
                      {user.username}
                    </Text>
                    <Text numberOfLines={2} style={{ color: theme.subText, fontSize: 14, marginTop: 2 }}>
                      {first ? first.content : 'Wants to start a chat'}
                    </Text>
                  </View>
                </Pressable>

                <View style={styles.actions}>
                  <Pressable
                    disabled={busy}
                    onPress={() => void run(c.peerId, () => respond(c.peerId, true))}
                    style={[styles.btn, { backgroundColor: theme.accent, opacity: busy ? 0.6 : 1 }]}
                  >
                    {busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.btnTextLight}>Accept</Text>}
                  </Pressable>
                  <Pressable
                    disabled={busy}
                    onPress={() => void run(c.peerId, () => respond(c.peerId, false))}
                    style={[styles.btn, { backgroundColor: theme.searchBg, opacity: busy ? 0.6 : 1 }]}
                  >
                    <Text style={[styles.btnText, { color: theme.text }]}>Decline</Text>
                  </Pressable>
                  <Pressable
                    disabled={busy}
                    onPress={() => void run(c.peerId, () => block(c.peerId))}
                    style={[styles.btn, { backgroundColor: theme.searchBg, opacity: busy ? 0.6 : 1 }]}
                  >
                    <Text style={[styles.btnText, { color: theme.danger }]}>Block</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 14 },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '700', marginLeft: 6 },
  note: { fontSize: 13.5, lineHeight: 19, paddingHorizontal: 18, paddingVertical: 14 },
  error: { textAlign: 'center', paddingHorizontal: 24, marginBottom: 10 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
  card: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  top: { flexDirection: 'row', alignItems: 'center' },
  topText: { flex: 1, marginLeft: 14 },
  name: { fontSize: 16.5, fontWeight: '600' },
  actions: { flexDirection: 'row', marginTop: 12 },
  btn: { flex: 1, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  btnTextLight: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  btnText: { fontWeight: '700', fontSize: 14 },
});