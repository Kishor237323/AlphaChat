import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useChat } from '../lib/ChatContext';
import { useConnections, type SearchResult } from '../lib/connections';
import {
  groupApi,
  type GroupInfo,
  type GroupMember,
  type GroupReport,
  type JoinMode,
  type JoinRequest,
} from '../lib/groupApi';
import { useGroups } from '../lib/groups';
import { useTheme } from '../lib/theme';
import { Avatar } from './Avatar';
import { GroupAvatar } from './GroupAvatar';

const webReset: any = Platform.OS === 'web' ? { outlineStyle: 'none' } : null;

const JOIN_MODES: { key: JoinMode; label: string }[] = [
  { key: 'open', label: 'Anyone with code' },
  { key: 'approval', label: 'Admin approval' },
  { key: 'closed', label: 'Invite only' },
];
const SLOW_MODES = [
  { value: 0, label: 'Off' },
  { value: 10, label: '10s' },
  { value: 30, label: '30s' },
  { value: 60, label: '1 min' },
  { value: 300, label: '5 min' },
];

function isMuted(m: GroupMember): boolean {
  return !!m.mutedUntil && Date.parse(m.mutedUntil) > Date.now();
}

/* ------------------------------ small helpers ------------------------------ */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ marginTop: 22 }}>
      <Text style={[styles.sectionTitle, { color: theme.subText }]}>{title}</Text>
      {children}
    </View>
  );
}

function Segmented<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.segment, { backgroundColor: theme.searchBg }]}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable key={String(o.key)} onPress={() => onChange(o.key)} style={[styles.segBtn, active && { backgroundColor: theme.accent }]}>
            <Text style={{ color: active ? '#FFFFFF' : theme.subText, fontSize: 12.5, fontWeight: '700', textAlign: 'center' }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ------------------------------ invite picker ------------------------------ */

function InvitePicker({ visible, groupId, onClose }: { visible: boolean; groupId: string; onClose: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { searchUsers } = useConnections();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [invited, setInvited] = useState<Record<string, boolean>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setQuery('');
      setResults([]);
      setInvited({});
      setError(null);
    }
  }, [visible]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setResults([]);
      return;
    }
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const r = await searchUsers(q);
        if (alive) setResults(r ?? []);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : 'Search failed.');
      }
    }, 350);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [query, searchUsers]);

  const invite = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      await groupApi.invite(groupId, id);
      setInvited((p) => ({ ...p, [id]: true }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not invite.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <View style={[styles.topBar, { backgroundColor: theme.header, paddingTop: insets.top + 10 }]}>
          <Pressable onPress={onClose} hitSlop={10} style={styles.iconBtn}>
            <Ionicons name="arrow-back" size={24} color={theme.headerText} />
          </Pressable>
          <TextInput
            autoFocus
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="Search by username"
            placeholderTextColor={theme.headerSubText}
            style={[styles.searchInput, { backgroundColor: theme.dark ? theme.searchBg : '#FFFFFF22', color: theme.headerText }, webReset]}
          />
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
          {query.trim().length < 3 ? (
            <Text style={{ color: theme.subText, textAlign: 'center', marginTop: 40, paddingHorizontal: 30 }}>
              Type at least 3 letters. People get an invitation and join only if they accept.
            </Text>
          ) : null}
          {error ? <Text style={{ color: theme.danger, textAlign: 'center', marginTop: 16 }}>{error}</Text> : null}
          {results.map((r) => (
            <View key={r.id} style={styles.personRow}>
              <Avatar name={r.username} size={44} ringColor={theme.background} onlineColor={theme.online} />
              <Text numberOfLines={1} style={[styles.personName, { color: theme.text }]}>
                {r.username}
              </Text>
              <Pressable
                disabled={busyId !== null || invited[r.id]}
                onPress={() => void invite(r.id)}
                style={[styles.smallBtn, { backgroundColor: invited[r.id] ? theme.searchBg : theme.accent }]}
              >
                {busyId === r.id ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={{ color: invited[r.id] ? theme.subText : '#FFFFFF', fontWeight: '700', fontSize: 13.5 }}>
                    {invited[r.id] ? 'Invited' : 'Invite'}
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

/* ------------------------------ member actions ------------------------------ */

function MemberSheet({
  member,
  myRole,
  busy,
  error,
  onClose,
  onRole,
  onMute,
  onRemove,
  onTransfer,
}: {
  member: GroupMember | null;
  myRole: GroupInfo['myRole'];
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onRole: (role: 'admin' | 'member') => void;
  onMute: (minutes: number) => void;
  onRemove: (ban: boolean) => void;
  onTransfer: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [confirm, setConfirm] = useState<string | null>(null);

  useEffect(() => setConfirm(null), [member?.userId]);

  const ask = (key: string, fn: () => void) => (confirm === key ? fn() : setConfirm(key));
  const item = (icon: React.ComponentProps<typeof Ionicons>['name'], label: string, onPress: () => void, danger = false) => (
    <Pressable onPress={onPress} disabled={busy} style={styles.sheetItem}>
      <Ionicons name={icon} size={22} color={danger ? theme.danger : theme.subText} />
      <Text style={{ color: danger ? theme.danger : theme.text, fontSize: 16.5, fontWeight: '500', marginLeft: 16 }}>{label}</Text>
    </Pressable>
  );

  return (
    <Modal visible={!!member} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.sheetWrap}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: theme.background, paddingBottom: insets.bottom + 14 }]}>
          {member ? (
            <>
              <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700', marginBottom: 6 }}>{member.username}</Text>

              {myRole === 'owner'
                ? member.role === 'admin'
                  ? item('shield-outline', 'Remove as admin', () => onRole('member'))
                  : item('shield-checkmark-outline', 'Make admin', () => onRole('admin'))
                : null}

              {isMuted(member)
                ? item('volume-high-outline', 'Unmute', () => onMute(0))
                : (
                  <>
                    {item('volume-mute-outline', 'Mute for 1 hour', () => onMute(60))}
                    {item('volume-mute-outline', 'Mute for 24 hours', () => onMute(1440))}
                  </>
                )}

              {myRole === 'owner'
                ? item('ribbon-outline', confirm === 'transfer' ? 'Tap again: make owner and become admin' : 'Make group owner', () => ask('transfer', onTransfer))
                : null}

              {item('person-remove-outline', confirm === 'remove' ? 'Tap again to remove' : 'Remove from group', () => ask('remove', () => onRemove(false)), true)}
              {item('ban-outline', confirm === 'ban' ? 'Tap again to remove and ban' : 'Remove and ban', () => ask('ban', () => onRemove(true)), true)}

              {busy ? <ActivityIndicator style={{ marginTop: 8 }} color={theme.accent} /> : null}
              {error ? <Text style={{ color: theme.danger, textAlign: 'center', marginTop: 10 }}>{error}</Text> : null}
            </>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

/* ---------------------------------- screen ---------------------------------- */

export function GroupInfoScreen({
  visible,
  groupId,
  onClose,
  onLeft,
}: {
  visible: boolean;
  groupId: string;
  onClose: () => void;
  /** called after I left or deleted the group */
  onLeft: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { me } = useChat();
  const { refresh } = useGroups();
  const meId = me?.id ?? '';

  const [info, setInfo] = useState<GroupInfo | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [reports, setReports] = useState<GroupReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [joinMode, setJoinMode] = useState<JoinMode>('approval');
  const [adminsOnly, setAdminsOnly] = useState(false);
  const [slow, setSlow] = useState(0);

  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [memberSheet, setMemberSheet] = useState<GroupMember | null>(null);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  const isAdmin = info?.myRole === 'owner' || info?.myRole === 'admin';
  const isOwner = info?.myRole === 'owner';

  const load = useCallback(async () => {
    try {
      const i = await groupApi.info(groupId);
      if (!i) return;
      setInfo(i);
      setName(i.name);
      setDescription(i.description);
      setJoinMode(i.joinMode);
      setAdminsOnly(i.onlyAdminsPost);
      setSlow(i.slowModeSeconds);
      setMembers(await groupApi.members(groupId));
      if (i.myRole !== 'member') {
        const [rq, rp] = await Promise.all([groupApi.joinRequests(groupId), groupApi.reports(groupId)]);
        setRequests(rq);
        setReports(rp);
      } else {
        setRequests([]);
        setReports([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load group info.');
    }
  }, [groupId]);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    setError(null);
    setNotice(null);
    setConfirm(null);
    void load().finally(() => setLoading(false));
  }, [visible, load]);

  /** Run an action, then reload everything. */
  const act = async (key: string, fn: () => Promise<unknown>, okNotice?: string) => {
    setBusyKey(key);
    setError(null);
    setNotice(null);
    try {
      await fn();
      await load();
      await refresh();
      if (okNotice) setNotice(okNotice);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusyKey(null);
      setConfirm(null);
    }
  };

  const ask = (key: string, fn: () => void) => (confirm === key ? fn() : setConfirm(key));

  const saveSettings = () =>
    act(
      'save',
      () => groupApi.updateGroup(groupId, { name, description, joinMode, onlyAdminsPost: adminsOnly, slowModeSeconds: slow }),
      'Settings saved.'
    );

  const shareCode = async () => {
    if (!info?.inviteCode) return;
    try {
      await Share.share({ message: `Join "${info.name}" on AlphaChat. Invite code: ${info.inviteCode}` });
    } catch {
      /* sharing is not available here; the code is shown on screen */
    }
  };

  const leaveOrDelete = async (kind: 'leave' | 'delete') => {
    setBusyKey(kind);
    setError(null);
    try {
      if (kind === 'leave') await groupApi.leave(groupId);
      else await groupApi.deleteGroup(groupId);
      await refresh();
      onLeft();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusyKey(null);
      setConfirm(null);
    }
  };

  const memberAction = async (fn: () => Promise<unknown>) => {
    setBusyKey('member');
    setSheetError(null);
    try {
      await fn();
      await load();
      await refresh();
      setMemberSheet(null);
    } catch (e) {
      setSheetError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusyKey(null);
    }
  };

  const canManage = (m: GroupMember) =>
    !!info && m.userId !== meId && ((info.myRole === 'owner' && m.role !== 'owner') || (info.myRole === 'admin' && m.role === 'member'));

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <View style={[styles.topBar, { backgroundColor: theme.header, paddingTop: insets.top + 10 }]}>
          <Pressable onPress={onClose} hitSlop={10} style={styles.iconBtn}>
            <Ionicons name="arrow-back" size={24} color={theme.headerText} />
          </Pressable>
          <Text style={{ color: theme.headerText, fontSize: 20, fontWeight: '700', marginLeft: 6 }}>Group info</Text>
        </View>

        {loading && !info ? <ActivityIndicator style={{ marginTop: 40 }} color={theme.accent} /> : null}

        {info ? (
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 40 }}>
            {/* summary */}
            <View style={{ alignItems: 'center', paddingTop: 22 }}>
              <GroupAvatar name={info.name} size={88} />
              <Text style={[styles.groupName, { color: theme.text }]}>{info.name}</Text>
              <Text style={{ color: theme.subText, fontSize: 14 }}>
                {info.memberCount} {info.memberCount === 1 ? 'member' : 'members'} · you are {info.myRole}
              </Text>
              {info.description ? (
                <Text style={{ color: theme.text, fontSize: 15, textAlign: 'center', marginTop: 10, lineHeight: 21 }}>{info.description}</Text>
              ) : null}
            </View>

            {error ? <Text style={[styles.msg, { color: theme.danger }]}>{error}</Text> : null}
            {notice ? <Text style={[styles.msg, { color: theme.accent }]}>{notice}</Text> : null}

            {/* invitations (admins) */}
            {isAdmin ? (
              <Section title="INVITE PEOPLE">
                <Pressable onPress={() => setInviteOpen(true)} style={[styles.rowBtn, { backgroundColor: theme.searchBg }]}>
                  <Ionicons name="person-add-outline" size={22} color={theme.accent} />
                  <Text style={{ color: theme.text, fontSize: 16, fontWeight: '600', marginLeft: 14, flex: 1 }}>Invite by username</Text>
                  <Ionicons name="chevron-forward" size={18} color={theme.subText} />
                </Pressable>

                {info.joinMode !== 'closed' && info.inviteCode ? (
                  <View style={[styles.codeBox, { backgroundColor: theme.searchBg }]}>
                    <Text style={{ color: theme.subText, fontSize: 12.5, fontWeight: '700' }}>INVITE CODE</Text>
                    <Text selectable style={{ color: theme.text, fontSize: 22, fontWeight: '800', letterSpacing: 2, marginVertical: 6 }}>
                      {info.inviteCode}
                    </Text>
                    <View style={{ flexDirection: 'row' }}>
                      <Pressable onPress={() => void shareCode()} style={[styles.smallBtn, { backgroundColor: theme.accent, marginRight: 8 }]}>
                        <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13.5 }}>Share code</Text>
                      </Pressable>
                      <Pressable
                        disabled={busyKey === 'rotate'}
                        onPress={() => ask('rotate', () => void act('rotate', () => groupApi.rotateCode(groupId), 'New invite code created. The old one no longer works.'))}
                        style={[styles.smallBtn, { backgroundColor: theme.background }]}
                      >
                        {busyKey === 'rotate' ? (
                          <ActivityIndicator size="small" color={theme.accent} />
                        ) : (
                          <Text style={{ color: theme.text, fontWeight: '700', fontSize: 13.5 }}>
                            {confirm === 'rotate' ? 'Tap again to reset' : 'Reset code'}
                          </Text>
                        )}
                      </Pressable>
                    </View>
                  </View>
                ) : null}
                {info.joinMode === 'closed' ? (
                  <Text style={{ color: theme.subText, fontSize: 13.5, marginTop: 8 }}>
                    The invite code is turned off. Admins can still invite people by username.
                  </Text>
                ) : null}
              </Section>
            ) : null}

            {/* join requests */}
            {isAdmin && requests.length > 0 ? (
              <Section title={`JOIN REQUESTS (${requests.length})`}>
                {requests.map((r) => (
                  <View key={r.userId} style={styles.personRow}>
                    <Avatar name={r.username} size={44} ringColor={theme.background} onlineColor={theme.online} />
                    <Text numberOfLines={1} style={[styles.personName, { color: theme.text }]}>
                      {r.username}
                    </Text>
                    <Pressable
                      disabled={busyKey !== null}
                      onPress={() => void act(`req-${r.userId}`, () => groupApi.reviewRequest(groupId, r.userId, true))}
                      style={[styles.smallBtn, { backgroundColor: theme.accent, marginRight: 6 }]}
                    >
                      <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>Approve</Text>
                    </Pressable>
                    <Pressable
                      disabled={busyKey !== null}
                      onPress={() => void act(`req-${r.userId}`, () => groupApi.reviewRequest(groupId, r.userId, false))}
                      style={[styles.smallBtn, { backgroundColor: theme.searchBg }]}
                    >
                      <Text style={{ color: theme.text, fontWeight: '700', fontSize: 13 }}>Decline</Text>
                    </Pressable>
                  </View>
                ))}
              </Section>
            ) : null}

            {/* reports */}
            {isAdmin && reports.length > 0 ? (
              <Section title={`REPORTS (${reports.length})`}>
                {reports.map((r) => (
                  <View key={r.id} style={[styles.reportCard, { backgroundColor: theme.searchBg }]}>
                    <Text style={{ color: theme.text, fontWeight: '700', fontSize: 14.5 }}>
                      {r.reporterName} reported {r.reportedName ?? 'a message'} · {r.reason}
                    </Text>
                    {r.messagePreview ? (
                      <Text numberOfLines={3} style={{ color: theme.subText, fontSize: 14, marginTop: 4 }}>
                        “{r.messagePreview}”
                      </Text>
                    ) : null}
                    <View style={{ flexDirection: 'row', marginTop: 10 }}>
                      {r.messageId ? (
                        <Pressable
                          disabled={busyKey !== null}
                          onPress={() =>
                            void act(`rep-${r.id}`, async () => {
                              await groupApi.deleteMessage(r.messageId as string);
                              await groupApi.resolveReport(r.id);
                            })
                          }
                          style={[styles.smallBtn, { backgroundColor: theme.danger, marginRight: 6 }]}
                        >
                          <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>Delete message</Text>
                        </Pressable>
                      ) : null}
                      <Pressable
                        disabled={busyKey !== null}
                        onPress={() => void act(`rep-${r.id}`, () => groupApi.resolveReport(r.id))}
                        style={[styles.smallBtn, { backgroundColor: theme.background }]}
                      >
                        <Text style={{ color: theme.text, fontWeight: '700', fontSize: 13 }}>Dismiss</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </Section>
            ) : null}

            {/* settings */}
            {isAdmin ? (
              <Section title="GROUP SETTINGS">
                <TextInput
                  value={name}
                  onChangeText={setName}
                  maxLength={60}
                  placeholder="Group name"
                  placeholderTextColor={theme.subText}
                  style={[styles.input, { backgroundColor: theme.searchBg, color: theme.text }, webReset]}
                />
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  maxLength={300}
                  multiline
                  placeholder="Description"
                  placeholderTextColor={theme.subText}
                  style={[styles.input, { height: 80, paddingTop: 12, textAlignVertical: 'top', backgroundColor: theme.searchBg, color: theme.text }, webReset]}
                />

                <Text style={[styles.label, { color: theme.subText }]}>Who can join with the code</Text>
                <Segmented options={JOIN_MODES} value={joinMode} onChange={setJoinMode} />

                <View style={styles.switchRow}>
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text style={{ color: theme.text, fontSize: 16, fontWeight: '600' }}>Only admins can send messages</Text>
                    <Text style={{ color: theme.subText, fontSize: 13, marginTop: 2 }}>Good for announcements.</Text>
                  </View>
                  <Switch value={adminsOnly} onValueChange={setAdminsOnly} trackColor={{ true: theme.accent }} />
                </View>

                <Text style={[styles.label, { color: theme.subText }]}>Slow mode (members only)</Text>
                <Segmented options={SLOW_MODES.map((s) => ({ key: s.value, label: s.label }))} value={slow} onChange={setSlow} />

                <Pressable
                  onPress={() => void saveSettings()}
                  disabled={busyKey === 'save'}
                  style={[styles.primary, { backgroundColor: theme.accent, opacity: busyKey === 'save' ? 0.7 : 1 }]}
                >
                  {busyKey === 'save' ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>Save settings</Text>}
                </Pressable>
              </Section>
            ) : null}

            {/* members */}
            <Section title={`MEMBERS (${members.length})`}>
              {members.map((m) => {
                const manageable = canManage(m);
                return (
                  <Pressable
                    key={m.userId}
                    disabled={!manageable}
                    onPress={() => {
                      setSheetError(null);
                      setMemberSheet(m);
                    }}
                    style={styles.personRow}
                  >
                    <Avatar name={m.username} size={44} ringColor={theme.background} onlineColor={theme.online} />
                    <View style={{ flex: 1, marginHorizontal: 12 }}>
                      <Text numberOfLines={1} style={{ color: theme.text, fontSize: 16, fontWeight: '600' }}>
                        {m.username}
                        {m.userId === meId ? ' (you)' : ''}
                      </Text>
                      {isMuted(m) ? <Text style={{ color: theme.danger, fontSize: 12.5 }}>Muted</Text> : null}
                    </View>
                    {m.role !== 'member' ? (
                      <View style={[styles.roleBadge, { backgroundColor: m.role === 'owner' ? theme.accent : theme.searchBg }]}>
                        <Text style={{ color: m.role === 'owner' ? '#FFFFFF' : theme.accent, fontSize: 12, fontWeight: '700' }}>
                          {m.role === 'owner' ? 'Owner' : 'Admin'}
                        </Text>
                      </View>
                    ) : null}
                    {manageable ? <Ionicons name="ellipsis-horizontal" size={20} color={theme.subText} style={{ marginLeft: 8 }} /> : null}
                  </Pressable>
                );
              })}
            </Section>

            {/* leave / delete */}
            <Section title="LEAVE">
              <Pressable
                disabled={busyKey !== null}
                onPress={() => ask('leave', () => void leaveOrDelete('leave'))}
                style={[styles.rowBtn, { backgroundColor: theme.searchBg }]}
              >
                <Ionicons name="exit-outline" size={22} color={theme.danger} />
                <Text style={{ color: theme.danger, fontSize: 16, fontWeight: '600', marginLeft: 14 }}>
                  {confirm === 'leave' ? 'Tap again to leave the group' : 'Leave group'}
                </Text>
              </Pressable>
              {isOwner ? (
                <>
                  <Text style={{ color: theme.subText, fontSize: 13, marginTop: 8 }}>
                    The owner must make someone else the owner before leaving. If you are the only member, leaving deletes the group.
                  </Text>
                  <Pressable
                    disabled={busyKey !== null}
                    onPress={() => ask('delete', () => void leaveOrDelete('delete'))}
                    style={[styles.rowBtn, { backgroundColor: theme.searchBg, marginTop: 10 }]}
                  >
                    <Ionicons name="trash-outline" size={22} color={theme.danger} />
                    <Text style={{ color: theme.danger, fontSize: 16, fontWeight: '600', marginLeft: 14 }}>
                      {confirm === 'delete' ? 'Tap again: delete group for everyone' : 'Delete group'}
                    </Text>
                  </Pressable>
                </>
              ) : null}
            </Section>

            <View style={[styles.note, { backgroundColor: theme.searchBg }]}>
              <Ionicons name="lock-open-outline" size={18} color={theme.subText} />
              <Text style={{ color: theme.subText, fontSize: 13, lineHeight: 18, flex: 1, marginLeft: 10 }}>
                Group messages are not end-to-end encrypted yet. They are stored on the server and protected by access rules, so only
                members can read them. End-to-end encryption is planned.
              </Text>
            </View>
          </ScrollView>
        ) : null}

        <MemberSheet
          member={memberSheet}
          myRole={info?.myRole ?? 'member'}
          busy={busyKey === 'member'}
          error={sheetError}
          onClose={() => setMemberSheet(null)}
          onRole={(role) => memberSheet && void memberAction(() => groupApi.setRole(groupId, memberSheet.userId, role))}
          onMute={(min) => memberSheet && void memberAction(() => groupApi.muteMember(groupId, memberSheet.userId, min))}
          onRemove={(ban) => memberSheet && void memberAction(() => groupApi.removeMember(groupId, memberSheet.userId, ban))}
          onTransfer={() => memberSheet && void memberAction(() => groupApi.transferOwner(groupId, memberSheet.userId))}
        />

        <InvitePicker visible={inviteOpen} groupId={groupId} onClose={() => setInviteOpen(false)} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 14 },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  searchInput: { flex: 1, height: 40, borderRadius: 20, paddingHorizontal: 16, fontSize: 15, marginLeft: 4 },
  groupName: { fontSize: 22, fontWeight: '800', marginTop: 12, marginBottom: 2 },
  msg: { textAlign: 'center', marginTop: 14, fontSize: 14.5 },
  sectionTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8 },
  rowBtn: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingHorizontal: 14, height: 52 },
  codeBox: { borderRadius: 12, padding: 14, marginTop: 10 },
  smallBtn: { minWidth: 76, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  personRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  personName: { flex: 1, fontSize: 16, fontWeight: '600', marginHorizontal: 12 },
  reportCard: { borderRadius: 12, padding: 12, marginBottom: 8 },
  input: { height: 48, borderRadius: 12, paddingHorizontal: 14, fontSize: 16, marginBottom: 10 },
  label: { fontSize: 13, fontWeight: '600', marginTop: 8, marginBottom: 6 },
  segment: { flexDirection: 'row', borderRadius: 12, padding: 4 },
  segBtn: { flex: 1, paddingVertical: 9, paddingHorizontal: 4, borderRadius: 9, justifyContent: 'center' },
  switchRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
  primary: { height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  primaryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  roleBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  note: { flexDirection: 'row', alignItems: 'flex-start', borderRadius: 12, padding: 12, marginTop: 24 },
  sheetWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 20, paddingTop: 18 },
  sheetItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
});
