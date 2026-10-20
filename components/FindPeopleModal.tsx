import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
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
import { useConnections, type Relation, type SearchResult } from '../lib/connections';
import { useTheme } from '../lib/theme';
import { Avatar } from './Avatar';

const webReset: any = Platform.OS === 'web' ? { outlineStyle: 'none' } : null;

const SUBTITLE: Record<Relation, string> = {
  none: 'Not in your chats yet',
  connected: 'In your chats',
  pending_out: 'Request sent',
  pending_in: 'Wants to message you',
};

const BUTTON: Record<Relation, string> = {
  none: 'Message',
  connected: 'Open',
  pending_out: 'Open',
  pending_in: 'Accept',
};

export function FindPeopleModal({
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
  const { searchUsers, requestChat, respond } = useConnections();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Start fresh every time it opens.
  useEffect(() => {
    if (visible) {
      setQuery('');
      setResults([]);
      setSearched(false);
      setError(null);
    }
  }, [visible]);

  // Search as you type (after a short pause).
  useEffect(() => {
    if (!visible) return;
    const q = query.trim();
    if (q.length < 3) {
      setResults([]);
      setSearched(false);
      return;
    }
    let alive = true;
    const t = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await searchUsers(q);
        if (alive) {
          setResults(r ?? []);
          setSearched(true);
        }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : 'Search failed.');
      } finally {
        if (alive) setLoading(false);
      }
    }, 350);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [query, visible, searchUsers]);

  const act = async (r: SearchResult) => {
    setBusyId(r.id);
    setError(null);
    try {
      if (r.relation === 'none') await requestChat(r.id);
      else if (r.relation === 'pending_in') await respond(r.id, true);
      onClose();
      onOpenChat(r.id);
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
          <TextInput
            autoFocus
            value={query}
            onChangeText={setQuery}
            placeholder="Search by username"
            placeholderTextColor={theme.headerSubText}
            autoCapitalize="none"
            autoCorrect={false}
            style={[
              styles.input,
              { backgroundColor: theme.dark ? theme.searchBg : '#FFFFFF22', color: theme.headerText },
              webReset,
            ]}
          />
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
          {query.trim().length < 3 ? (
            <View style={styles.hintBox}>
              <Ionicons name="shield-checkmark-outline" size={34} color={theme.accent} />
              <Text style={[styles.hintTitle, { color: theme.text }]}>Find people by username</Text>
              <Text style={[styles.hintText, { color: theme.subText }]}>
                Type at least 3 letters. Only people you chat with can see your profile, and nobody can browse a full
                list of users.
              </Text>
            </View>
          ) : null}

          {loading ? <ActivityIndicator style={{ marginTop: 24 }} color={theme.accent} /> : null}

          {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}

          {searched && !loading && results.length === 0 && !error ? (
            <View style={styles.hintBox}>
              <Text style={[styles.hintTitle, { color: theme.text }]}>No one found</Text>
              <Text style={[styles.hintText, { color: theme.subText }]}>Check the spelling of the username.</Text>
            </View>
          ) : null}

          {results.map((r) => (
            <View key={r.id} style={styles.row}>
              <Avatar name={r.username} size={48} ringColor={theme.background} onlineColor={theme.online} />
              <View style={styles.rowText}>
                <Text numberOfLines={1} style={[styles.name, { color: theme.text }]}>
                  {r.username}
                </Text>
                <Text numberOfLines={1} style={{ color: theme.subText, fontSize: 13, marginTop: 2 }}>
                  {SUBTITLE[r.relation]}
                </Text>
              </View>
              <Pressable
                onPress={() => void act(r)}
                disabled={busyId !== null}
                style={[
                  styles.btn,
                  r.relation === 'none' || r.relation === 'pending_in'
                    ? { backgroundColor: theme.accent }
                    : { backgroundColor: theme.searchBg },
                  busyId === r.id && { opacity: 0.6 },
                ]}
              >
                {busyId === r.id ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text
                    style={{
                      color: r.relation === 'none' || r.relation === 'pending_in' ? '#FFFFFF' : theme.text,
                      fontWeight: '700',
                      fontSize: 14,
                    }}
                  >
                    {BUTTON[r.relation]}
                  </Text>
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
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 12 },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, height: 40, borderRadius: 20, paddingHorizontal: 16, fontSize: 15, marginLeft: 4 },
  hintBox: { alignItems: 'center', paddingTop: 70, paddingHorizontal: 36 },
  hintTitle: { fontSize: 18, fontWeight: '700', marginTop: 14, marginBottom: 8 },
  hintText: { fontSize: 14.5, textAlign: 'center', lineHeight: 21 },
  error: { textAlign: 'center', marginTop: 18, paddingHorizontal: 24 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  rowText: { flex: 1, marginLeft: 14, marginRight: 10 },
  name: { fontSize: 16.5, fontWeight: '600' },
  btn: { minWidth: 84, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
});