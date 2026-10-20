import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useConnections, type BlockedUser } from '../lib/connections';
import { useTheme } from '../lib/theme';
import { Avatar } from './Avatar';

export function BlockedModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { listBlocked, unblock } = useConnections();
  const [items, setItems] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems((await listBlocked()) ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load blocked users.');
    } finally {
      setLoading(false);
    }
  }, [listBlocked]);

  useEffect(() => {
    if (visible) void refresh();
  }, [visible, refresh]);

  const doUnblock = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      await unblock(id);
      setItems((list) => list.filter((u) => u.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not unblock.');
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
          <Text style={[styles.title, { color: theme.headerText }]}>Blocked users</Text>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
          {loading ? <ActivityIndicator style={{ marginTop: 30 }} color={theme.accent} /> : null}
          {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}

          {!loading && items.length === 0 && !error ? (
            <View style={styles.empty}>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>Nobody is blocked</Text>
              <Text style={{ color: theme.subText, fontSize: 14.5, textAlign: 'center', paddingHorizontal: 40 }}>
                Blocked people cannot message you or see your profile.
              </Text>
            </View>
          ) : null}

          {items.map((u) => (
            <View key={u.id} style={styles.row}>
              <Avatar name={u.username} size={46} ringColor={theme.background} onlineColor={theme.online} />
              <Text numberOfLines={1} style={[styles.name, { color: theme.text }]}>
                {u.username}
              </Text>
              <Pressable
                onPress={() => void doUnblock(u.id)}
                disabled={busyId !== null}
                style={[styles.btn, { backgroundColor: theme.searchBg, opacity: busyId === u.id ? 0.6 : 1 }]}
              >
                {busyId === u.id ? (
                  <ActivityIndicator size="small" color={theme.accent} />
                ) : (
                  <Text style={{ color: theme.accent, fontWeight: '700', fontSize: 14 }}>Unblock</Text>
                )}
              </Pressable>
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 14 },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '700', marginLeft: 6 },
  error: { textAlign: 'center', marginTop: 18, paddingHorizontal: 24 },
  empty: { alignItems: 'center', paddingTop: 70 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  name: { flex: 1, fontSize: 16.5, fontWeight: '600', marginHorizontal: 14 },
  btn: { minWidth: 84, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
});