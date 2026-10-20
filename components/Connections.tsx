import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from './supabase';
import { useChat } from './ChatContext';

/** How many intro messages you may send before the other person accepts. Must match the SQL (3). */
export const INTRO_LIMIT = 3;

export type Relation = 'none' | 'connected' | 'pending_out' | 'pending_in';
export type SearchResult = { id: string; username: string; relation: Relation };
export type BlockedUser = { id: string; username: string };
export type ReportReason = 'spam' | 'harassment' | 'impersonation' | 'inappropriate' | 'other';

export type Connection = {
  peerId: string;
  status: 'pending' | 'accepted';
  /** true when I sent the request, false when they sent it to me */
  iRequested: boolean;
  createdAt: string;
};

type DbRow = { requester_id: string; addressee_id: string; status: 'pending' | 'accepted'; created_at: string };

type Ctx = {
  byPeer: Record<string, Connection>;
  /** requests other people sent me that I have not answered yet, newest first */
  incoming: Connection[];
  searchUsers: (q: string) => Promise<SearchResult[]>;
  requestChat: (peerId: string) => Promise<'accepted' | 'pending'>;
  respond: (peerId: string, accept: boolean) => Promise<void>;
  block: (peerId: string) => Promise<void>;
  unblock: (peerId: string) => Promise<void>;
  listBlocked: () => Promise<BlockedUser[]>;
  report: (peerId: string, reason: ReportReason, details?: string, alsoBlock?: boolean) => Promise<void>;
};

const ConnectionsContext = createContext<Ctx | null>(null);

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export function ConnectionsProvider({ children }: { children: React.ReactNode }) {
  const { me, reload } = useChat();
  const meId = me?.id ?? '';
  const [rows, setRows] = useState<DbRow[]>([]);

  // Keep the latest reload without re-subscribing every render.
  const reloadRef = useRef(reload);
  useEffect(() => {
    reloadRef.current = reload;
  }, [reload]);

  const load = useCallback(async () => {
    if (!meId) return;
    const { data, error } = await supabase.from('connections').select('requester_id, addressee_id, status, created_at');
    if (!error && data) setRows(data as DbRow[]);
  }, [meId]);

  // Load once, then refresh whenever a request is created, accepted or removed.
  useEffect(() => {
    if (!meId) return;
    void load();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const channel = supabase
      .channel(`connections:${meId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'connections' }, () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          void load();
          void reloadRef.current();
        }, 250);
      })
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [meId, load]);

  const byPeer = useMemo(() => {
    const map: Record<string, Connection> = {};
    for (const r of rows) {
      const iRequested = r.requester_id === meId;
      const peerId = iRequested ? r.addressee_id : r.requester_id;
      map[peerId] = { peerId, status: r.status, iRequested, createdAt: r.created_at };
    }
    return map;
  }, [rows, meId]);

  const incoming = useMemo(
    () =>
      Object.values(byPeer)
        .filter((c) => c.status === 'pending' && !c.iRequested)
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    [byPeer]
  );

  const refreshAll = useCallback(async () => {
    await load();
    await reloadRef.current();
  }, [load]);

  const searchUsers = useCallback((q: string) => rpc<SearchResult[]>('search_users', { q }), []);

  const requestChat = useCallback(
    async (peerId: string) => {
      const status = await rpc<'accepted' | 'pending'>('request_connection', { target: peerId });
      await refreshAll();
      return status;
    },
    [refreshAll]
  );

  const respond = useCallback(
    async (peerId: string, accept: boolean) => {
      await rpc<void>('respond_connection', { requester: peerId, accept });
      await refreshAll();
    },
    [refreshAll]
  );

  const block = useCallback(
    async (peerId: string) => {
      await rpc<void>('block_user', { target: peerId });
      await refreshAll();
    },
    [refreshAll]
  );

  const unblock = useCallback(
    async (peerId: string) => {
      await rpc<void>('unblock_user', { target: peerId });
      await refreshAll();
    },
    [refreshAll]
  );

  const listBlocked = useCallback(async () => (await rpc<BlockedUser[]>('blocked_users')) ?? [], []);

  const report = useCallback(
    async (peerId: string, reason: ReportReason, details?: string, alsoBlock = false) => {
      await rpc<void>('report_user', { target: peerId, reason, details: details ?? null, also_block: alsoBlock });
      if (alsoBlock) await refreshAll();
    },
    [refreshAll]
  );

  const value = useMemo<Ctx>(
    () => ({ byPeer, incoming, searchUsers, requestChat, respond, block, unblock, listBlocked, report }),
    [byPeer, incoming, searchUsers, requestChat, respond, block, unblock, listBlocked, report]
  );

  return <ConnectionsContext.Provider value={value}>{children}</ConnectionsContext.Provider>;
}

export function useConnections(): Ctx {
  const ctx = useContext(ConnectionsContext);
  if (!ctx) throw new Error('useConnections must be used inside ConnectionsProvider');
  return ctx;
}