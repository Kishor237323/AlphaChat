import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useChat } from '../lib/ChatContext';
import { useConnections } from '../lib/connections';
import { useTheme } from '../lib/theme';
import { lastSeenLabel } from '../lib/utils';
import { Avatar } from './Avatar';
import { PeerActionsModal } from './PeeractionsModal'; // file is PeeractionsModal.tsx

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function memberSince(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function PeerProfileModal({
  visible,
  peerId,
  onClose,
  onBlocked,
}: {
  visible: boolean;
  peerId: string;
  onClose: () => void;
  /** called after you blocked this person, so the chat can close */
  onBlocked: () => void;
}) {
  const theme = useTheme();
  const { users, onlineIds } = useChat();
  const { byPeer } = useConnections();
  const [actionsOpen, setActionsOpen] = useState(false);

  // Always start with the actions sheet closed.
  useEffect(() => {
    if (!visible) setActionsOpen(false);
  }, [visible]);

  const user = users.find((u) => u.id === peerId);
  const online = onlineIds.has(peerId);
  const connection = byPeer[peerId];

  const relation =
    connection?.status === 'accepted'
      ? 'In your chats'
      : connection?.status === 'pending'
        ? connection.iRequested
          ? 'Request sent'
          : 'Wants to message you'
        : '';

  const name = user?.username ?? 'Unknown user';

  return (
    <>
      <Modal visible={visible && !actionsOpen} transparent animationType="fade" onRequestClose={onClose}>
        <View style={styles.wrap}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
          <View style={[styles.card, { backgroundColor: theme.background }]}>
            <Pressable onPress={onClose} hitSlop={12} style={styles.close} accessibilityLabel="Close">
              <Ionicons name="close" size={24} color={theme.subText} />
            </Pressable>

            <View style={styles.avatarWrap}>
              <Avatar
                name={name}
                size={110}
                online={online}
                ringColor={theme.background}
                onlineColor={theme.online}
              />
            </View>

            <Text numberOfLines={2} style={[styles.name, { color: theme.text }]}>
              {name}
            </Text>
            <Text style={[styles.status, { color: online ? theme.accent : theme.subText }]}>
              {online ? 'online' : lastSeenLabel(user?.last_seen ?? null)}
            </Text>

            <View style={[styles.infoBox, { backgroundColor: theme.searchBg }]}>
              {user?.created_at ? (
                <View style={styles.infoRow}>
                  <Ionicons name="calendar-outline" size={20} color={theme.subText} />
                  <Text style={[styles.infoText, { color: theme.text }]}>
                    Member since {memberSince(user.created_at)}
                  </Text>
                </View>
              ) : null}
              {relation ? (
                <View style={styles.infoRow}>
                  <Ionicons name="chatbubbles-outline" size={20} color={theme.subText} />
                  <Text style={[styles.infoText, { color: theme.text }]}>{relation}</Text>
                </View>
              ) : null}
            </View>

            <Pressable
              onPress={() => setActionsOpen(true)}
              style={({ pressed }) => [styles.dangerRow, pressed && { backgroundColor: theme.pressed }]}
            >
              <Ionicons name="ban-outline" size={22} color={theme.danger} />
              <Text style={[styles.dangerText, { color: theme.danger }]}>Block or report {name}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <PeerActionsModal
        visible={visible && actionsOpen}
        peerId={peerId}
        peerName={name}
        onClose={() => {
          setActionsOpen(false);
          onClose();
        }}
        onBlocked={onBlocked}
      />
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.55)', padding: 20 },
  card: { width: '100%', maxWidth: 380, borderRadius: 20, padding: 22, alignItems: 'center' },
  close: { position: 'absolute', top: 14, right: 14, zIndex: 2 },
  avatarWrap: { marginTop: 10, marginBottom: 16 },
  name: { fontSize: 22, fontWeight: '700', textAlign: 'center' },
  status: { fontSize: 14, marginTop: 4, marginBottom: 18 },
  infoBox: { alignSelf: 'stretch', borderRadius: 14, paddingVertical: 6, paddingHorizontal: 14 },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  infoText: { fontSize: 15, marginLeft: 12 },
  dangerRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  dangerText: { fontSize: 15.5, fontWeight: '600', marginLeft: 14 },
});