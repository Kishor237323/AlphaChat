import { supabase } from './supabase';

export type GroupRole = 'owner' | 'admin' | 'member';
export type JoinMode = 'open' | 'approval' | 'closed';
export type GroupReportReason = 'spam' | 'harassment' | 'impersonation' | 'inappropriate' | 'other';

export type GroupSummary = {
  id: string;
  name: string;
  description: string;
  role: GroupRole;
  memberCount: number;
  lastContent: string | null;
  lastSender: string | null;
  lastKind: 'text' | 'system' | null;
  lastAt: string | null;
  unread: number;
  mentions: number;
  onlyAdminsPost: boolean;
  slowModeSeconds: number;
};

export type GroupInvite = { groupId: string; groupName: string; invitedBy: string; createdAt: string };

export type GroupInfo = {
  id: string;
  name: string;
  description: string;
  joinMode: JoinMode;
  onlyAdminsPost: boolean;
  slowModeSeconds: number;
  keyEpoch: number;
  myRole: GroupRole;
  inviteCode: string | null;
  memberCount: number;
};

export type GroupMember = {
  userId: string;
  username: string;
  role: GroupRole;
  joinedAt: string;
  mutedUntil: string | null;
};

export type JoinRequest = { userId: string; username: string; createdAt: string };

export type GroupReport = {
  id: string;
  reason: string;
  details: string | null;
  reportedName: string | null;
  messageId: string | null;
  messagePreview: string | null;
  reporterName: string;
  createdAt: string;
};

export type GroupPreview = { id: string; name: string; description: string; memberCount: number; joinMode: JoinMode };

/** A row of public.group_messages, plus two local-only flags. */
export type GroupMessage = {
  id: string;
  group_id: string;
  sender_id: string | null;
  sender_name: string;
  kind: 'text' | 'system';
  content: string;
  reply_to: string | null;
  reply_sender: string | null;
  reply_preview: string | null;
  mentions: string[];
  pinned_at: string | null;
  deleted_at: string | null;
  created_at: string;
  pending?: boolean;
};

export type GroupReaction = { message_id: string; user_id: string; emoji: string };

type Row = Record<string, any>;

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export const groupApi = {
  /* ------------------------------ lists ------------------------------ */
  async myGroups(): Promise<GroupSummary[]> {
    const rows = (await rpc<Row[]>('my_groups')) ?? [];
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description ?? '',
      role: r.role,
      memberCount: r.member_count ?? 0,
      lastContent: r.last_content ?? null,
      lastSender: r.last_sender ?? null,
      lastKind: r.last_kind ?? null,
      lastAt: r.last_at ?? null,
      unread: r.unread ?? 0,
      mentions: r.mention_count ?? 0,
      onlyAdminsPost: !!r.only_admins_post,
      slowModeSeconds: r.slow_mode_seconds ?? 0,
    }));
  },

  async myInvites(): Promise<GroupInvite[]> {
    const rows = (await rpc<Row[]>('my_group_invites')) ?? [];
    return rows.map((r) => ({
      groupId: r.group_id,
      groupName: r.group_name,
      invitedBy: r.invited_by_name,
      createdAt: r.created_at,
    }));
  },

  async info(groupId: string): Promise<GroupInfo | null> {
    const rows = (await rpc<Row[]>('group_info', { gid: groupId })) ?? [];
    const r = rows[0];
    if (!r) return null;
    return {
      id: r.id,
      name: r.name,
      description: r.description ?? '',
      joinMode: r.join_mode,
      onlyAdminsPost: !!r.only_admins_post,
      slowModeSeconds: r.slow_mode_seconds ?? 0,
      keyEpoch: r.key_epoch ?? 1,
      myRole: r.my_role,
      inviteCode: r.invite_code ?? null,
      memberCount: r.member_count ?? 0,
    };
  },

  async members(groupId: string): Promise<GroupMember[]> {
    const rows = (await rpc<Row[]>('group_members_list', { gid: groupId })) ?? [];
    return rows.map((r) => ({
      userId: r.user_id,
      username: r.username,
      role: r.role,
      joinedAt: r.joined_at,
      mutedUntil: r.muted_until ?? null,
    }));
  },

  async joinRequests(groupId: string): Promise<JoinRequest[]> {
    const rows = (await rpc<Row[]>('group_join_requests_list', { gid: groupId })) ?? [];
    return rows.map((r) => ({ userId: r.user_id, username: r.username, createdAt: r.created_at }));
  },

  async reports(groupId: string): Promise<GroupReport[]> {
    const rows = (await rpc<Row[]>('group_reports_list', { gid: groupId })) ?? [];
    return rows.map((r) => ({
      id: r.id,
      reason: r.reason,
      details: r.details ?? null,
      reportedName: r.reported_name ?? null,
      messageId: r.message_id ?? null,
      messagePreview: r.message_preview ?? null,
      reporterName: r.reporter_name,
      createdAt: r.created_at,
    }));
  },

  /* --------------------------- create / join --------------------------- */
  createGroup(name: string, description: string, invitees: string[]) {
    return rpc<string>('create_group', { gname: name, gdesc: description, invitees });
  },

  async preview(code: string): Promise<GroupPreview | null> {
    const rows = (await rpc<Row[]>('group_preview', { code })) ?? [];
    const r = rows[0];
    if (!r) return null;
    return { id: r.id, name: r.name, description: r.description ?? '', memberCount: r.member_count ?? 0, joinMode: r.join_mode };
  },

  joinByCode(code: string) {
    return rpc<'joined' | 'requested' | 'member'>('join_group_by_code', { code });
  },

  invite(groupId: string, userId: string) {
    return rpc<void>('invite_to_group', { gid: groupId, target: userId });
  },

  respondInvite(groupId: string, accept: boolean) {
    return rpc<void>('respond_group_invite', { gid: groupId, accept });
  },

  reviewRequest(groupId: string, userId: string, approve: boolean) {
    return rpc<void>('review_join_request', { gid: groupId, target: userId, approve });
  },

  /* ----------------------------- management ----------------------------- */
  updateGroup(
    groupId: string,
    v: { name: string; description: string; joinMode: JoinMode; onlyAdminsPost: boolean; slowModeSeconds: number }
  ) {
    return rpc<void>('update_group', {
      gid: groupId,
      gname: v.name,
      gdesc: v.description,
      gjoin: v.joinMode,
      admins_only: v.onlyAdminsPost,
      slow: v.slowModeSeconds,
    });
  },

  rotateCode(groupId: string) {
    return rpc<string>('rotate_invite_code', { gid: groupId });
  },

  setRole(groupId: string, userId: string, role: 'admin' | 'member') {
    return rpc<void>('set_member_role', { gid: groupId, target: userId, new_role: role });
  },

  removeMember(groupId: string, userId: string, ban: boolean) {
    return rpc<void>('remove_member', { gid: groupId, target: userId, ban });
  },

  muteMember(groupId: string, userId: string, minutes: number) {
    return rpc<void>('mute_member', { gid: groupId, target: userId, minutes });
  },

  transferOwner(groupId: string, userId: string) {
    return rpc<void>('transfer_group_owner', { gid: groupId, target: userId });
  },

  leave(groupId: string) {
    return rpc<void>('leave_group', { gid: groupId });
  },

  deleteGroup(groupId: string) {
    return rpc<void>('delete_group', { gid: groupId });
  },

  /* ------------------------------ messages ------------------------------ */
  pin(messageId: string, pin: boolean) {
    return rpc<void>('pin_group_message', { mid: messageId, pin });
  },

  deleteMessage(messageId: string) {
    return rpc<void>('delete_group_message', { mid: messageId });
  },

  react(messageId: string, reaction: string) {
    return rpc<void>('toggle_group_reaction', { mid: messageId, reaction });
  },

  markRead(groupId: string) {
    return rpc<void>('mark_group_read', { gid: groupId });
  },

  report(groupId: string, messageId: string | null, reason: GroupReportReason, details?: string) {
    return rpc<void>('report_group_content', { gid: groupId, mid: messageId, reason, details: details ?? null });
  },

  resolveReport(reportId: string) {
    return rpc<void>('resolve_group_report', { rid: reportId });
  },
};
