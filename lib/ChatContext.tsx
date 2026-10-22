import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { Message, Profile } from "./types";
import { uuidv4 } from "./utils";

type MessagesByPeer = Record<string, Message[]>;

type ChatContextValue = {
  me: Profile | null;
  users: Profile[];
  messages: MessagesByPeer;
  onlineIds: Set<string>;
  typingIds: Record<string, boolean>;
  loading: boolean;
  error: string | null;
  sendMessage: (peerId: string, text: string) => Promise<void>;
  retryMessage: (peerId: string, messageId: string) => Promise<void>;
  notifyTyping: (peerId: string) => void;
  stopTyping: (peerId: string) => void;
  setActivePeer: (peerId: string | null) => void;
  reload: () => Promise<void>;
  signOut: () => Promise<void>;
};

const ChatContext = createContext<ChatContextValue | null>(null);

export function useChat(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used inside <ChatProvider>");
  return ctx;
}

/** Supabase query builders are lazy: they only run when awaited / .then() is called. */
function fire(query: PromiseLike<unknown>): void {
  Promise.resolve(query).then(
    () => undefined,
    () => undefined,
  );
}

const byTime = (a: Message, b: Message) =>
  Date.parse(a.created_at) - Date.parse(b.created_at);

function upsertMessage(list: Message[], msg: Message): Message[] {
  const idx = list.findIndex((m) => m.id === msg.id);
  if (idx >= 0) {
    const old = list[idx];
    const next = list.slice();
    next[idx] = {
      ...msg,
      delivered_at: msg.delivered_at ?? old.delivered_at,
      read_at: msg.read_at ?? old.read_at,
    };
    return next;
  }
  return [...list, msg].sort(byTime);
}

function groupByPeer(rows: Message[], meId: string): MessagesByPeer {
  const out: MessagesByPeer = {};
  for (const m of rows) {
    const peer = m.sender_id === meId ? m.receiver_id : m.sender_id;
    if (!out[peer]) out[peer] = [];
    out[peer].push(m);
  }
  Object.keys(out).forEach((k) => out[k].sort(byTime));
  return out;
}

function normalizeProfile(raw: any): Profile {
  const picked = [
    raw?.username,
    raw?.full_name,
    raw?.name,
    raw?.display_name,
  ].find((v) => typeof v === "string" && v.trim().length > 0) as
    | string
    | undefined;
  return {
    id: String(raw.id),
    username: picked ? picked.trim() : `User ${String(raw.id).slice(0, 4)}`,
    last_seen: raw.last_seen ?? null,
    created_at: raw.created_at ?? raw.updated_at ?? new Date().toISOString(),
  };
}

export function ChatProvider({
  userId,
  children,
}: {
  userId: string;
  children: React.ReactNode;
}) {
  const [me, setMe] = useState<Profile | null>(null);
  const [users, setUsers] = useState<Profile[]>([]);
  const [messages, setMessages] = useState<MessagesByPeer>({});
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [typingIds, setTypingIds] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const messagesRef = useRef<MessagesByPeer>({});
  const activePeerRef = useRef<string | null>(null);
  const typingTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>(
    {},
  );
  const myTypingTo = useRef<string | null>(null);
  const lastTypingSent = useRef(0);
  const typingStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  messagesRef.current = messages;

  /* ------------------------------ read receipts ----------------------------- */

  const markRead = useCallback(
    async (peerId: string, force = false) => {
      const list = messagesRef.current[peerId] ?? [];
      const hasUnread = list.some((m) => m.sender_id === peerId && !m.read_at);
      if (!hasUnread && !force) return;
      const now = new Date().toISOString();
      setMessages((prev) => ({
        ...prev,
        [peerId]: (prev[peerId] ?? []).map((m) =>
          m.sender_id === peerId && !m.read_at ? { ...m, read_at: now } : m,
        ),
      }));
      const { error: err } = await supabase
        .from("messages")
        .update({ read_at: now })
        .eq("receiver_id", userId)
        .eq("sender_id", peerId)
        .is("read_at", null);
      if (err) console.warn("markRead failed:", err.message);
    },
    [userId],
  );

  /* ------------------------------- initial load ------------------------------ */

  const loadAll = useCallback(async () => {
    const [profilesRes, messagesRes] = await Promise.all([
      supabase.from("profiles").select("*"),
      supabase
        .from("messages")
        .select("*")
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .order("created_at", { ascending: false })
        .limit(1000),
    ]);
    if (profilesRes.error) throw new Error(profilesRes.error.message);
    if (messagesRes.error) throw new Error(messagesRes.error.message);

    const all = ((profilesRes.data ?? []) as any[]).map(normalizeProfile);
    let mine = all.find((p) => p.id === userId) ?? null;

    if (!mine) {
      // Safety net if the signup trigger was not installed when this account was created.
      const { data: u } = await supabase.auth.getUser();
      const username =
        (u.user?.user_metadata?.username as string | undefined) ??
        u.user?.email?.split("@")[0] ??
        "user";
      const ins = await supabase
        .from("profiles")
        .upsert({ id: userId, username })
        .select()
        .single();
      if (!ins.error && ins.data) mine = normalizeProfile(ins.data);
    }

    setMe(mine);
    setUsers(all.filter((p) => p.id !== userId));

    const rows = (messagesRes.data ?? []) as Message[];
    const grouped = groupByPeer(rows, userId);

    setMessages((prev) => {
      // keep local messages that are still sending / failed
      Object.keys(prev).forEach((peer) => {
        prev[peer]
          .filter((m) => m.pending || m.failed)
          .forEach((m) => {
            if (!(grouped[peer] ?? []).some((x) => x.id === m.id)) {
              grouped[peer] = upsertMessage(grouped[peer] ?? [], m);
            }
          });
      });
      return grouped;
    });

    if (rows.some((m) => m.receiver_id === userId && !m.delivered_at)) {
      fire(
        supabase
          .from("messages")
          .update({ delivered_at: new Date().toISOString() })
          .eq("receiver_id", userId)
          .is("delivered_at", null),
      );
    }
    if (activePeerRef.current) void markRead(activePeerRef.current, true);
  }, [userId, markRead]);

  const reload = useCallback(async () => {
    try {
      setError(null);
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load chats");
    } finally {
      setLoading(false);
    }
  }, [loadAll]);

  /* ----------------------------- realtime handlers --------------------------- */

  const handleIncoming = useCallback(
    (msg: Message) => {
      const peer = msg.sender_id;
      setMessages((prev) => ({
        ...prev,
        [peer]: upsertMessage(prev[peer] ?? [], msg),
      }));
      setTypingIds((prev) => (prev[peer] ? { ...prev, [peer]: false } : prev));
      fire(
        supabase
          .from("messages")
          .update({ delivered_at: new Date().toISOString() })
          .eq("id", msg.id),
      );
      if (
        activePeerRef.current === peer &&
        AppState.currentState === "active"
      ) {
        setTimeout(() => void markRead(peer, true), 0);
      }
    },
    [markRead],
  );

  const handleUpdate = useCallback((msg: Message) => {
    const peer = msg.receiver_id;
    setMessages((prev) => ({
      ...prev,
      [peer]: upsertMessage(prev[peer] ?? [], msg),
    }));
  }, []);

  const handleProfileChange = useCallback(
    (p: Profile) => {
      if (p.id === userId) {
        setMe(p);
        return;
      }
      setUsers((prev) => {
        const i = prev.findIndex((u) => u.id === p.id);
        if (i === -1) return [...prev, p];
        const next = prev.slice();
        next[i] = p;
        return next;
      });
    },
    [userId],
  );

  /* ------------------------------ channel lifecycle -------------------------- */

  useEffect(() => {
    let cancelled = false;
    let subscribedBefore = false;

    void reload();

    const channel = supabase.channel("alpha-chat-room", {
      config: { presence: { key: userId }, broadcast: { self: false } },
    });
    channelRef.current = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        if (cancelled) return;
        setOnlineIds(new Set(Object.keys(channel.presenceState())));
      })
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const { from, to, typing } = (payload ?? {}) as {
          from?: string;
          to?: string;
          typing?: boolean;
        };
        if (!from || to !== userId || cancelled) return;
        if (typingTimers.current[from])
          clearTimeout(typingTimers.current[from]);
        setTypingIds((prev) => ({ ...prev, [from]: !!typing }));
        if (typing) {
          // safety net: if the "stopped typing" event is lost, clear it after 4s
          typingTimers.current[from] = setTimeout(() => {
            setTypingIds((prev) => ({ ...prev, [from]: false }));
          }, 4000);
        }
      })
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `receiver_id=eq.${userId}`,
        },
        (payload) => handleIncoming(payload.new as unknown as Message),
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `sender_id=eq.${userId}`,
        },
        (payload) => handleUpdate(payload.new as unknown as Message),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        (payload) => {
          if (payload.eventType === "DELETE") return;
          handleProfileChange(normalizeProfile(payload.new));
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void channel.track({
            user_id: userId,
            online_at: new Date().toISOString(),
          });
          if (subscribedBefore) void reload(); // reconnected: catch up on what we missed
          subscribedBefore = true;
        }
      });

    return () => {
      cancelled = true;
      Object.values(typingTimers.current).forEach((t) => clearTimeout(t));
      typingTimers.current = {};
      if (typingStopTimer.current) clearTimeout(typingStopTimer.current);
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [userId, reload, handleIncoming, handleUpdate, handleProfileChange]);

  /* ---------------------- foreground / background = online / offline --------- */

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      const ch = channelRef.current;
      if (state === "active") {
        if (ch)
          void ch.track({
            user_id: userId,
            online_at: new Date().toISOString(),
          });
        void reload();
      } else if (state === "background") {
        if (ch) void ch.untrack();
        fire(
          supabase
            .from("profiles")
            .update({ last_seen: new Date().toISOString() })
            .eq("id", userId),
        );
      }
    });
    return () => sub.remove();
  }, [userId, reload]);

  /* --------------------------------- typing ---------------------------------- */

  const sendTyping = useCallback(
    (peerId: string, typing: boolean) => {
      const ch = channelRef.current;
      if (!ch) return;
      void ch.send({
        type: "broadcast",
        event: "typing",
        payload: { from: userId, to: peerId, typing },
      });
    },
    [userId],
  );

  const notifyTyping = useCallback(
    (peerId: string) => {
      const now = Date.now();
      if (
        myTypingTo.current !== peerId ||
        now - lastTypingSent.current > 2500
      ) {
        sendTyping(peerId, true);
        lastTypingSent.current = now;
      }
      myTypingTo.current = peerId;
      if (typingStopTimer.current) clearTimeout(typingStopTimer.current);
      typingStopTimer.current = setTimeout(() => {
        if (myTypingTo.current) sendTyping(myTypingTo.current, false);
        myTypingTo.current = null;
      }, 2000);
    },
    [sendTyping],
  );

  const stopTyping = useCallback(
    (peerId: string) => {
      if (typingStopTimer.current) clearTimeout(typingStopTimer.current);
      if (myTypingTo.current === peerId) {
        sendTyping(peerId, false);
        myTypingTo.current = null;
      }
    },
    [sendTyping],
  );

  /* -------------------------------- sending ---------------------------------- */

  const insertMessage = useCallback(
    async (peerId: string, id: string, content: string) => {
      const { data, error: err } = await supabase
        .from("messages")
        .insert({ id, sender_id: userId, receiver_id: peerId, content })
        .select()
        .single();

      if (err && err.code === "23505") {
        // duplicate id: an earlier attempt actually reached the server
        setMessages((prev) => ({
          ...prev,
          [peerId]: (prev[peerId] ?? []).map((m) =>
            m.id === id ? { ...m, pending: false, failed: false } : m,
          ),
        }));
        return;
      }
      if (err || !data) {
        setMessages((prev) => ({
          ...prev,
          [peerId]: (prev[peerId] ?? []).map((m) =>
            m.id === id ? { ...m, pending: false, failed: true } : m,
          ),
        }));
        return;
      }
      setMessages((prev) => ({
        ...prev,
        [peerId]: upsertMessage(prev[peerId] ?? [], data as Message),
      }));
    },
    [userId],
  );

  const sendMessage = useCallback(
    async (peerId: string, text: string) => {
      const content = text.trim();
      if (!content) return;
      const id = uuidv4();
      const optimistic: Message = {
        id,
        sender_id: userId,
        receiver_id: peerId,
        content,
        created_at: new Date().toISOString(),
        delivered_at: null,
        read_at: null,
        pending: true,
      };
      setMessages((prev) => ({
        ...prev,
        [peerId]: upsertMessage(prev[peerId] ?? [], optimistic),
      }));
      stopTyping(peerId);
      await insertMessage(peerId, id, content);
    },
    [userId, stopTyping, insertMessage],
  );

  const retryMessage = useCallback(
    async (peerId: string, messageId: string) => {
      const msg = (messagesRef.current[peerId] ?? []).find(
        (m) => m.id === messageId,
      );
      if (!msg) return;
      setMessages((prev) => ({
        ...prev,
        [peerId]: (prev[peerId] ?? []).map((m) =>
          m.id === messageId ? { ...m, pending: true, failed: false } : m,
        ),
      }));
      await insertMessage(peerId, messageId, msg.content);
    },
    [insertMessage],
  );

  const setActivePeer = useCallback(
    (peerId: string | null) => {
      activePeerRef.current = peerId;
      if (peerId) void markRead(peerId);
    },
    [markRead],
  );

  const signOut = useCallback(async () => {
    try {
      await supabase
        .from("profiles")
        .update({ last_seen: new Date().toISOString() })
        .eq("id", userId);
      await channelRef.current?.untrack();
    } catch {
      // ignore: we are leaving anyway
    }
    await supabase.auth.signOut();
  }, [userId]);

  const value = useMemo<ChatContextValue>(
    () => ({
      me,
      users,
      messages,
      onlineIds,
      typingIds,
      loading,
      error,
      sendMessage,
      retryMessage,
      notifyTyping,
      stopTyping,
      setActivePeer,
      reload,
      signOut,
    }),
    [
      me,
      users,
      messages,
      onlineIds,
      typingIds,
      loading,
      error,
      sendMessage,
      retryMessage,
      notifyTyping,
      stopTyping,
      setActivePeer,
      reload,
      signOut,
    ],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
