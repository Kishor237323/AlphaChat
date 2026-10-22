import React, { useEffect, useMemo, useState } from 'react';
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
import { useChat } from '../lib/ChatContext';
import { useConnections, type SearchResult } from '../lib/connections';
import { groupApi, type GroupPreview } from '../lib/groupApi';
import { useGroups } from '../lib/groups';
import { useTheme } from '../lib/theme';
import { Avatar } from './Avatar';
import { GroupAvatar } from './GroupAvatar';

const webReset: any = Platform.OS === 'web' ? { outlineStyle: 'none' } : null;

function Header({ title, onClose }: { title: string; onClose: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { backgroundColor: theme.header, paddingTop: insets.top + 10 }]}>
      <Pressable onPress={onClose} hitSlop={10} style={styles.iconBtn}>
        <Ionicons name="arrow-back" size={24} color={theme.headerText} />
      </Pressable>
      <Text style={[styles.title, { color: theme.headerText }]}>{title}</Text>
    </View>
  );
}

/* ------------------------- create group + join by code ------------------------- */

export function CreateGroupModal({
  visible,
  onClose,
  onOpenGroup,
}: {
  visible: boolean;
  onClose: () => void;
  onOpenGroup: (groupId: string) => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { users } = useChat();
  const { byPeer, searchUsers } = useConnections();
  const { refresh } = useGroups();

  const [tab, setTab] = useState<'create' | 'join'>('create');

  // create
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<SearchResult[]>([]);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);

  // join
  const [code, setCode] = useState('');
  const [preview, setPreview] = useState<GroupPreview | null>(null);
  const [checked, setChecked] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinInfo, setJoinInfo] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setTab('create');
      setName('');
      setDescription('');
      setQuery('');
      setFound([]);
      setSelected({});
      setCode('');
      setPreview(null);
      setChecked(false);
      setJoinInfo(null);
      setError(null);
    }
  }, [visible]);

  // Search other people by username (3+ letters).
  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setFound([]);
      return;
    }
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const r = await searchUsers(q);
        if (alive) setFound(r ?? []);
      } catch {
        if (alive) setFound([]);
      }
    }, 350);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [query, searchUsers]);

  const contacts = useMemo(
    () => users.filter((u) => byPeer[u.id]?.status === 'accepted').map((u) => ({ id: u.id, username: u.username })),
    [users, byPeer]
  );

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length >= 3) return found.map((f) => ({ id: f.id, username: f.username }));
    return contacts.filter((c) => !q || c.username.toLowerCase().includes(q));
  }, [query, found, contacts]);

  const toggle = (id: string, username: string) =>
    setSelected((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = username;
      return next;
    });

  const create = async () => {
    const clean = name.trim();
    if (clean.length < 1 || clean.length > 60) {
      setError('Give the group a name (up to 60 characters).');
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const gid = await groupApi.createGroup(clean, description.trim(), Object.keys(selected));
      await refresh();
      onClose();
      onOpenGroup(gid);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the group.');
    } finally {
      setCreating(false);
    }
  };

  const check = async () => {
    setError(null);
    setJoinInfo(null);
    setPreview(null);
    setChecked(false);
    try {
      const p = await groupApi.preview(code.trim());
      setPreview(p);
      setChecked(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not check the code.');
    }
  };

  const join = async () => {
    setJoining(true);
    setError(null);
    try {
      const result = await groupApi.joinByCode(code.trim());
      await refresh();
      if (result === 'requested') {
        setJoinInfo('Request sent. A group admin will review it.');
      } else {
        onClose();
        if (preview) onOpenGroup(preview.id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not join the group.');
    } finally {
      setJoining(false);
    }
  };

  const selectedIds = Object.keys(selected);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <Header title={tab === 'create' ? 'New group' : 'Join a group'} onClose={onClose} />

        <View style={styles.tabs}>
          {(['create', 'join'] as const).map((t) => (
            <Pressable
              key={t}
              onPress={() => {
                setTab(t);
                setError(null);
              }}
              style={[styles.tab, { backgroundColor: tab === t ? theme.accent : theme.searchBg }]}
            >
              <Text style={{ color: tab === t ? '#FFFFFF' : theme.subText, fontWeight: '700' }}>
                {t === 'create' ? 'Create' : 'Join with code'}
              </Text>
            </Pressable>
          ))}
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + 30 }}>
          {tab === 'create' ? (
            <View style={{ paddingHorizontal: 16 }}>
              <View style={styles.nameRow}>
                <GroupAvatar name={name || 'group'} size={56} />
                <TextInput
                  value={name}
                  onChangeText={setName}
                  maxLength={60}
                  placeholder="Group name"
                  placeholderTextColor={theme.subText}
                  style={[styles.input, { flex: 1, marginLeft: 12, backgroundColor: theme.searchBg, color: theme.text }, webReset]}
                />
              </View>
              <TextInput
                value={description}
                onChangeText={setDescription}
                maxLength={300}
                multiline
                placeholder="Description (optional)"
                placeholderTextColor={theme.subText}
                style={[styles.input, styles.multi, { backgroundColor: theme.searchBg, color: theme.text }, webReset]}
              />

              <Text style={[styles.label, { color: theme.subText }]}>INVITE PEOPLE ({selectedIds.length})</Text>
              <Text style={{ color: theme.subText, fontSize: 13, marginBottom: 8 }}>
                They get an invitation and join only if they accept.
              </Text>

              {selectedIds.length > 0 ? (
                <View style={styles.chips}>
                  {selectedIds.map((id) => (
                    <Pressable
                      key={id}
                      onPress={() => toggle(id, selected[id])}
                      style={[styles.chip, { backgroundColor: theme.accent }]}
                    >
                      <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 13 }}>{selected[id]}</Text>
                      <Ionicons name="close" size={14} color="#FFFFFF" style={{ marginLeft: 4 }} />
                    </Pressable>
                  ))}
                </View>
              ) : null}

              <TextInput
                value={query}
                onChangeText={setQuery}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="Search your chats, or type 3+ letters of a username"
                placeholderTextColor={theme.subText}
                style={[styles.input, { backgroundColor: theme.searchBg, color: theme.text }, webReset]}
              />

              {list.map((p) => {
                const on = !!selected[p.id];
                return (
                  <Pressable key={p.id} onPress={() => toggle(p.id, p.username)} style={styles.personRow}>
                    <Avatar name={p.username} size={42} ringColor={theme.background} onlineColor={theme.online} />
                    <Text numberOfLines={1} style={[styles.personName, { color: theme.text }]}>
                      {p.username}
                    </Text>
                    <Ionicons
                      name={on ? 'checkbox' : 'square-outline'}
                      size={24}
                      color={on ? theme.accent : theme.subText}
                    />
                  </Pressable>
                );
              })}
              {list.length === 0 ? (
                <Text style={{ color: theme.subText, textAlign: 'center', marginTop: 14 }}>
                  {query.trim().length >= 3 ? 'No one found.' : 'No chats to pick from yet. You can add people later.'}
                </Text>
              ) : null}

              {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}

              <Pressable
                onPress={() => void create()}
                disabled={creating}
                style={[styles.primary, { backgroundColor: theme.accent, opacity: creating ? 0.7 : 1 }]}
              >
                {creating ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>Create group</Text>}
              </Pressable>
            </View>
          ) : (
            <View style={{ paddingHorizontal: 16 }}>
              <Text style={{ color: theme.subText, fontSize: 14, lineHeight: 20, marginBottom: 12 }}>
                Ask a group admin for the group's invite code.
              </Text>
              <TextInput
                value={code}
                onChangeText={(v) => {
                  setCode(v);
                  setChecked(false);
                  setPreview(null);
                  setJoinInfo(null);
                }}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="Invite code"
                placeholderTextColor={theme.subText}
                style={[styles.input, { backgroundColor: theme.searchBg, color: theme.text }, webReset]}
              />
              <Pressable
                onPress={() => void check()}
                disabled={code.trim().length < 4}
                style={[styles.primary, { backgroundColor: theme.accent, opacity: code.trim().length < 4 ? 0.5 : 1 }]}
              >
                <Text style={styles.primaryText}>Check code</Text>
              </Pressable>

              {checked && !preview ? (
                <Text style={[styles.error, { color: theme.danger }]}>No group found for that code.</Text>
              ) : null}

              {preview ? (
                <View style={[styles.previewCard, { backgroundColor: theme.searchBg }]}>
                  <GroupAvatar name={preview.name} size={64} />
                  <Text style={[styles.previewName, { color: theme.text }]}>{preview.name}</Text>
                  <Text style={{ color: theme.subText, fontSize: 13.5 }}>
                    {preview.memberCount} {preview.memberCount === 1 ? 'member' : 'members'}
                  </Text>
                  {preview.description ? (
                    <Text style={{ color: theme.subText, fontSize: 14, textAlign: 'center', marginTop: 8 }}>
                      {preview.description}
                    </Text>
                  ) : null}
                  {joinInfo ? (
                    <Text style={{ color: theme.accent, textAlign: 'center', marginTop: 14, fontWeight: '600' }}>{joinInfo}</Text>
                  ) : (
                    <Pressable
                      onPress={() => void join()}
                      disabled={joining}
                      style={[styles.primary, { backgroundColor: theme.accent, marginTop: 16, alignSelf: 'stretch', opacity: joining ? 0.7 : 1 }]}
                    >
                      {joining ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <Text style={styles.primaryText}>
                          {preview.joinMode === 'approval' ? 'Request to join' : 'Join group'}
                        </Text>
                      )}
                    </Pressable>
                  )}
                </View>
              ) : null}

              {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

/* ------------------------------ invitations inbox ------------------------------ */

export function GroupInvitesModal({
  visible,
  onClose,
  onOpenGroup,
}: {
  visible: boolean;
  onClose: () => void;
  onOpenGroup: (groupId: string) => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { invites, refresh } = useGroups();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const respond = async (groupId: string, accept: boolean) => {
    setBusyId(groupId);
    setError(null);
    try {
      await groupApi.respondInvite(groupId, accept);
      await refresh();
      if (accept) {
        onClose();
        onOpenGroup(groupId);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <Header title="Group invitations" onClose={onClose} />
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
          {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}
          {invites.length === 0 ? (
            <View style={{ alignItems: 'center', paddingTop: 70 }}>
              <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700', marginBottom: 6 }}>No invitations</Text>
              <Text style={{ color: theme.subText }}>Invitations to groups will show up here.</Text>
            </View>
          ) : null}
          {invites.map((i) => {
            const busy = busyId === i.groupId;
            return (
              <View key={i.groupId} style={[styles.inviteCard, { borderBottomColor: theme.divider }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <GroupAvatar name={i.groupName} size={48} />
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <Text numberOfLines={1} style={{ color: theme.text, fontSize: 16.5, fontWeight: '600' }}>
                      {i.groupName}
                    </Text>
                    <Text numberOfLines={1} style={{ color: theme.subText, fontSize: 13.5, marginTop: 2 }}>
                      Invited by {i.invitedBy}
                    </Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', marginTop: 12 }}>
                  <Pressable
                    disabled={busy}
                    onPress={() => void respond(i.groupId, true)}
                    style={[styles.smallBtn, { backgroundColor: theme.accent, opacity: busy ? 0.6 : 1 }]}
                  >
                    {busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.primaryText}>Accept</Text>}
                  </Pressable>
                  <Pressable
                    disabled={busy}
                    onPress={() => void respond(i.groupId, false)}
                    style={[styles.smallBtn, { backgroundColor: theme.searchBg, opacity: busy ? 0.6 : 1 }]}
                  >
                    <Text style={{ color: theme.text, fontWeight: '700' }}>Decline</Text>
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
  tabs: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12 },
  tab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 18, marginRight: 8 },
  nameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  input: { height: 48, borderRadius: 12, paddingHorizontal: 14, fontSize: 16, marginBottom: 10 },
  multi: { height: 84, paddingTop: 12, textAlignVertical: 'top' },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, marginTop: 10, marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6, marginRight: 6, marginBottom: 6 },
  personRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  personName: { flex: 1, fontSize: 16, fontWeight: '500', marginHorizontal: 12 },
  error: { textAlign: 'center', marginTop: 14, paddingHorizontal: 12 },
  primary: { height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  primaryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  previewCard: { alignItems: 'center', borderRadius: 16, padding: 20, marginTop: 16 },
  previewName: { fontSize: 20, fontWeight: '700', marginTop: 10, marginBottom: 2 },
  inviteCard: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  smallBtn: { flex: 1, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
});
