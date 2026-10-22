import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';
import { useChat } from './ChatContext';
import { groupApi, type GroupInvite, type GroupSummary } from './groupApi';

type Ctx = {
  groups: GroupSummary[];
  invites: GroupInvite[];
  /** true until the first load finished (success or failure) */
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const GroupsContext = createContext<Ctx | null>(null);

const WATCHED_TABLES = ['groups', 'group_members', 'group_messages', 'group_invites', 'group_join_requests'];

export function GroupsProvider({ children }: { children: React.ReactNode }) {
  const { me } = useChat();
  const meId = me?.id ?? '';
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [invites, setInvites] = useState<GroupInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!meId) return;
    try {
      const [g, i] = await Promise.all([groupApi.myGroups(), groupApi.myInvites()]);
      setGroups(g);
      setInvites(i);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load groups.');
    } finally {
      setLoading(false);
    }
  }, [meId]);

  useEffect(() => {
    if (!meId) return;
    void refresh();

    let timer: ReturnType<typeof setTimeout> | undefined;
    const kick = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void refresh(), 300);
    };

    let channel = supabase.channel(`groups:${meId}`);
    for (const table of WATCHED_TABLES) {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, kick);
    }
    channel.subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [meId, refresh]);

  const value = useMemo<Ctx>(
    () => ({ groups, invites, loading, error, refresh }),
    [groups, invites, loading, error, refresh]
  );

  return <GroupsContext.Provider value={value}>{children}</GroupsContext.Provider>;
}

export function useGroups(): Ctx {
  const ctx = useContext(GroupsContext);
  if (!ctx) throw new Error('useGroups must be used inside GroupsProvider');
  return ctx;
}
