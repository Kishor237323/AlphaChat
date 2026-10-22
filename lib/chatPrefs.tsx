import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { authStorage } from './authStorage';
import { useChat } from './ChatContext';

export type ChatKind = 'dm' | 'group';

export type ChatTarget = {
  kind: ChatKind;
  id: string; // peer user id for 'dm', group id for 'group'
  name: string;
  /** time of the newest message; decides whether a deleted chat comes back */
  lastAt?: string | null;
};

export type ChatPref = {
  pinnedAt?: number;
  muted?: boolean;
  archived?: boolean;
  markedUnread?: boolean;
  hiddenAt?: number;
};

export const MAX_PINNED = 3;

const EMPTY: ChatPref = {};
const keyOf = (kind: ChatKind, id: string) => `${kind}:${id}`;

type ChatPrefsCtx = {
  pref: (kind: ChatKind, id: string) => ChatPref;
  /** returns false when the pin limit is reached */
  togglePin: (t: ChatTarget) => boolean;
  toggleMute: (t: ChatTarget) => void;
  toggleArchive: (t: ChatTarget) => void;
  setMarkedUnread: (t: ChatTarget, value: boolean) => void;
  deleteChat: (t: ChatTarget) => void;
  /** archivedView=false for the main list, true for the Archived list */
  isVisible: (t: ChatTarget, archivedView: boolean) => boolean;
  /** pinned chats first (newest pin first), everything else keeps its order */
  sortChats: <T extends { kind: ChatKind; id: string }>(items: T[]) => T[];
};

const Ctx = createContext<ChatPrefsCtx | null>(null);

export function ChatPrefsProvider({ children }: { children: React.ReactNode }) {
  const { me } = useChat();
  const meId = me?.id ?? '';
  const [prefs, setPrefs] = useState<Record<string, ChatPref>>({});
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const loadedFor = useRef('');

  // Load this user's saved notes.
  useEffect(() => {
    if (!meId) return;
    let alive = true;
    loadedFor.current = '';
    setPrefs({});
    Promise.resolve(authStorage.getItem(`alphachat.chatPrefs.${meId}`))
      .then((raw) => {
        if (!alive) return;
        try {
          setPrefs(raw ? (JSON.parse(raw) as Record<string, ChatPref>) : {});
        } catch {
          setPrefs({});
        }
        loadedFor.current = meId;
      })
      .catch(() => {
        if (alive) loadedFor.current = meId;
      });
    return () => {
      alive = false;
    };
  }, [meId]);

  // Save after every change (but never before the first load finished).
  useEffect(() => {
    if (!meId || loadedFor.current !== meId) return;
    void Promise.resolve(
      authStorage.setItem(`alphachat.chatPrefs.${meId}`, JSON.stringify(prefs))
    ).catch(() => undefined);
  }, [prefs, meId]);

  /** Merge a change into one chat's notes; null/undefined/false removes a note. */
  const patch = useCallback((t: ChatTarget, change: Record<string, unknown>) => {
    const k = keyOf(t.kind, t.id);
    setPrefs((prev) => {
      const merged: Record<string, unknown> = { ...(prev[k] ?? {}), ...change };
      for (const field of Object.keys(merged)) {
        if (merged[field] == null || merged[field] === false) delete merged[field];
      }
      const next = { ...prev };
      if (Object.keys(merged).length === 0) delete next[k];
      else next[k] = merged as ChatPref;
      return next;
    });
  }, []);

  const pref = useCallback(
    (kind: ChatKind, id: string): ChatPref => prefs[keyOf(kind, id)] ?? EMPTY,
    [prefs]
  );

  const togglePin = useCallback(
    (t: ChatTarget): boolean => {
      const current = prefsRef.current[keyOf(t.kind, t.id)];
      if (current?.pinnedAt) {
        patch(t, { pinnedAt: null });
        return true;
      }
      const pinnedCount = Object.values(prefsRef.current).filter((p) => p.pinnedAt).length;
      if (pinnedCount >= MAX_PINNED) return false;
      patch(t, { pinnedAt: Date.now() });
      return true;
    },
    [patch]
  );

  const toggleMute = useCallback(
    (t: ChatTarget) => patch(t, { muted: !prefsRef.current[keyOf(t.kind, t.id)]?.muted }),
    [patch]
  );

  const toggleArchive = useCallback(
    (t: ChatTarget) => {
      const archived = !prefsRef.current[keyOf(t.kind, t.id)]?.archived;
      // An archived chat cannot stay pinned.
      patch(t, { archived, ...(archived ? { pinnedAt: null } : {}) });
    },
    [patch]
  );

  const setMarkedUnread = useCallback(
    (t: ChatTarget, value: boolean) => {
      // Skip the write when nothing changes (this runs on every chat open).
      const has = !!prefsRef.current[keyOf(t.kind, t.id)]?.markedUnread;
      if (has !== value) patch(t, { markedUnread: value });
    },
    [patch]
  );

  const deleteChat = useCallback(
    (t: ChatTarget) =>
      patch(t, { hiddenAt: Date.now(), pinnedAt: null, archived: null, markedUnread: null }),
    [patch]
  );

  const isVisible = useCallback(
    (t: ChatTarget, archivedView: boolean): boolean => {
      const p = prefs[keyOf(t.kind, t.id)] ?? EMPTY;
      if (p.hiddenAt) {
        const last = t.lastAt ? Date.parse(t.lastAt) : 0;
        if (last <= p.hiddenAt) return false; // nothing new since "delete"
      }
      return !!p.archived === archivedView;
    },
    [prefs]
  );

  const sortChats = useCallback(
    function sort<T extends { kind: ChatKind; id: string }>(items: T[]): T[] {
      const pinTime = (x: T) => prefs[keyOf(x.kind, x.id)]?.pinnedAt ?? 0;
      return items
        .map((x, i) => ({ x, i }))
        .sort((a, b) => {
          const pa = pinTime(a.x);
          const pb = pinTime(b.x);
          if (pa && pb) return pb - pa;
          if (pa) return -1;
          if (pb) return 1;
          return a.i - b.i;
        })
        .map((o) => o.x);
    },
    [prefs]
  );

  const value = useMemo<ChatPrefsCtx>(
    () => ({
      pref,
      togglePin,
      toggleMute,
      toggleArchive,
      setMarkedUnread,
      deleteChat,
      isVisible,
      sortChats,
    }),
    [pref, togglePin, toggleMute, toggleArchive, setMarkedUnread, deleteChat, isVisible, sortChats]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useChatPrefs(): ChatPrefsCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useChatPrefs must be used inside ChatPrefsProvider');
  return ctx;
}