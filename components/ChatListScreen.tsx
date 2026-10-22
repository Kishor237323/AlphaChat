import React, { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  ListRenderItemInfo,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useChat } from "../lib/ChatContext";
import { useConnections } from "../lib/connections";
import { useGroups } from "../lib/groups";
import { useChatPrefs, type ChatTarget } from "../lib/chatPrefs";
import { useTheme, type Theme } from "../lib/theme";
import type { Message, Profile } from "../lib/types";
import { listTimeLabel } from "../lib/utils";
import { Avatar } from "./Avatar";
import { BlockedModal } from "./BlockedModal";
import { useChatMenu } from "./ChatContextMenu";
import { FadeIn } from "./FadeIn";
import { FindPeopleModal } from "./FindPeopleModal";
import { ProfileModal } from "./ProfileModal";
import { RequestsModal } from "./RequestModal"; // file is RequestModal.tsx, component is RequestsModal
import { Sidebar } from "./Sidebar";
import { Ticks } from "./Ticks";
import { GroupAvatar } from "./GroupAvatar";
import { CreateGroupModal, GroupInvitesModal } from "./GroupModals";

const webReset: any = Platform.OS === "web" ? { outlineStyle: "none" } : null;

type Filter = "all" | "unread" | "online";
type Overlay = null | "profile" | "find" | "requests" | "blocked" | "createGroup" | "groupInvites";

/** One row of the list: either a direct chat or a group. */
type ListItem = {
  kind: "dm" | "group";
  id: string; // peer user id for 'dm', group id for 'group'
  name: string;
  lastAt: string | null;
  unread: number;
  user?: Profile; // dm only
  last?: Message | null; // dm only
  preview?: string; // group only
};

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "online", label: "Online" },
];

/* ------------------------------- chat row -------------------------------- */

type RowProps = {
  kind: "dm" | "group";
  id: string;
  name: string;
  lastAt: string | null;
  last: Message | null;
  preview: string;
  unread: number;
  pinned: boolean;
  muted: boolean;
  markedUnread: boolean;
  mine: boolean;
  online: boolean;
  typing: boolean;
  theme: Theme;
  onPress: (t: ChatTarget) => void;
  trigger: (t: ChatTarget) => any;
};

const ChatRow = React.memo(function ChatRow({
  kind,
  id,
  name,
  lastAt,
  last,
  preview,
  unread,
  pinned,
  muted,
  markedUnread,
  mine,
  online,
  typing,
  theme,
  onPress,
  trigger,
}: RowProps) {
  const target: ChatTarget = { kind, id, name, lastAt };
  const hasBadge = unread > 0 || markedUnread;
  const badgeColor = muted ? theme.subText : theme.accent;

  return (
    <Pressable
      onPress={() => onPress(target)}
      {...trigger(target)}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.pressed }]}
    >
      {kind === "group" ? (
        <GroupAvatar name={name} size={52} />
      ) : (
        <Avatar name={name} size={52} online={online} ringColor={theme.background} onlineColor={theme.online} />
      )}
      <View style={[styles.rowBody, { borderBottomColor: theme.divider }]}>
        <View style={styles.rowTop}>
          <Text numberOfLines={1} style={[styles.name, { color: theme.text }]}>
            {name}
          </Text>
          {lastAt ? (
            <Text style={[styles.time, { color: hasBadge && !muted ? theme.accent : theme.subText }]}>
              {listTimeLabel(lastAt)}
            </Text>
          ) : null}
        </View>
        <View style={styles.rowBottom}>
          <View style={styles.previewWrap}>
            {typing ? (
              <Text numberOfLines={1} style={{ color: theme.accent, fontSize: 14.5 }}>
                typing…
              </Text>
            ) : (
              <>
                {kind === "dm" && mine && last ? (
                  <View style={styles.tickBox}>
                    <Ticks message={last} theme={theme} />
                  </View>
                ) : null}
                <Text numberOfLines={1} style={[styles.preview, { color: theme.subText }]}>
                  {preview}
                </Text>
              </>
            )}
          </View>
          <View style={styles.flags}>
            {pinned ? <Ionicons name="pin" size={14} color={theme.subText} style={styles.flagIcon} /> : null}
            {muted ? (
              <Ionicons name="notifications-off" size={14} color={theme.subText} style={styles.flagIcon} />
            ) : null}
            {hasBadge ? (
              unread > 0 ? (
                <View style={[styles.badge, { backgroundColor: badgeColor }]}>
                  <Text style={styles.badgeText}>{unread > 99 ? "99+" : unread}</Text>
                </View>
              ) : (
                <View style={[styles.badgeDot, { backgroundColor: badgeColor }]} />
              )
            ) : null}
          </View>
        </View>
      </View>
    </Pressable>
  );
});

/** Horizontal strip of everyone who is online right now. */
function OnlineStrip({
  users,
  theme,
  onPress,
}: {
  users: Profile[];
  theme: Theme;
  onPress: (id: string) => void;
}) {
  return (
    <View style={[styles.strip, { borderBottomColor: theme.divider }]}>
      <Text style={[styles.stripTitle, { color: theme.subText }]}>ONLINE NOW</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stripContent}>
        {users.map((u) => (
          <Pressable key={u.id} onPress={() => onPress(u.id)} style={styles.stripItem}>
            <Avatar name={u.username} size={54} online ringColor={theme.background} onlineColor={theme.online} />
            <Text numberOfLines={1} style={[styles.stripName, { color: theme.text }]}>
              {u.username.split(" ")[0]}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

/* --------------------------------- screen -------------------------------- */

export function ChatListScreen({
  onOpen,
  onOpenGroup,
  onOpenGroupInfo,
}: {
  onOpen: (peerId: string) => void;
  onOpenGroup: (groupId: string) => void;
  /** optional: if you have a way to open the group info screen directly, pass it here */
  onOpenGroupInfo?: (groupId: string) => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { me, users, messages, onlineIds, typingIds, error, reload } = useChat();
  const { byPeer, incoming } = useConnections();
  const { groups } = useGroups();
  const { pref, isVisible, sortChats, setMarkedUnread } = useChatPrefs();

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [showArchived, setShowArchived] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [overlay, setOverlay] = useState<Overlay>(null); // only one modal is ever open

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const closeOverlay = useCallback(() => setOverlay(null), []);
  const openProfile = useCallback(() => setOverlay("profile"), []);
  const openFind = useCallback(() => setOverlay("find"), []);
  const openRequests = useCallback(() => setOverlay("requests"), []);
  const openBlocked = useCallback(() => setOverlay("blocked"), []);
  const openCreateGroup = useCallback(() => setOverlay("createGroup"), []);
  const openGroupInvites = useCallback(() => setOverlay("groupInvites"), []);

  const closeSearch = useCallback(() => {
    setSearching(false);
    setQuery("");
  }, []);

  /* ----- the right-click / long-press menu ----- */

  // Tapping a row: clear a manual "unread" flag, then open the chat.
  const openTarget = useCallback(
    (t: ChatTarget) => {
      setMarkedUnread(t, false);
      if (t.kind === "group") onOpenGroup(t.id);
      else onOpen(t.id);
    },
    [setMarkedUnread, onOpen, onOpenGroup],
  );

  const menu = useChatMenu({
    onOpenChat: openTarget,
    onGroupInfo: (groupId) => (onOpenGroupInfo ?? onOpenGroup)(groupId),
  });

  /* ----- build one combined list of direct chats and groups ----- */

  // People who sent me a request I have not answered are shown under "Message requests" instead.
  const allItems = useMemo<ListItem[]>(() => {
    const items: ListItem[] = [];

    for (const u of users) {
      const c = byPeer[u.id];
      if (c && c.status === "pending" && !c.iRequested) continue;
      const list = messages[u.id] ?? [];
      let unread = 0;
      for (const m of list) if (m.sender_id === u.id && !m.read_at) unread += 1;
      const last = list.length > 0 ? list[list.length - 1] : null;
      items.push({
        kind: "dm",
        id: u.id,
        name: u.username,
        lastAt: last ? last.created_at : null,
        unread,
        user: u,
        last,
      });
    }

    for (const g of groups) {
      let preview = `${g.memberCount} members`;
      if (g.lastContent) {
        preview = g.lastKind === "text" && g.lastSender ? `${g.lastSender}: ${g.lastContent}` : g.lastContent;
      }
      items.push({ kind: "group", id: g.id, name: g.name, lastAt: g.lastAt, unread: g.unread, preview });
    }

    // newest activity first
    items.sort((a, b) => {
      const ta = a.lastAt ? Date.parse(a.lastAt) : 0;
      const tb = b.lastAt ? Date.parse(b.lastAt) : 0;
      if (ta !== tb) return tb - ta;
      return a.name.localeCompare(b.name);
    });
    return items;
  }, [users, messages, byPeer, groups]);

  // Rows that are not deleted/archived: used for the counters.
  const activeItems = useMemo(() => allItems.filter((it) => isVisible(it, false)), [allItems, isVisible]);

  const archivedCount = useMemo(() => allItems.filter((it) => isVisible(it, true)).length, [allItems, isVisible]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = allItems.filter((it) => {
      if (!isVisible(it, showArchived)) return false;
      if (q && !it.name.toLowerCase().includes(q)) return false;
      if (filter === "unread") return it.unread > 0 || !!pref(it.kind, it.id).markedUnread;
      if (filter === "online") return it.kind === "dm" && onlineIds.has(it.id);
      return true;
    });
    return sortChats(filtered); // pinned chats float to the top
  }, [allItems, query, filter, showArchived, onlineIds, isVisible, pref, sortChats]);

  const unreadTotal = useMemo(
    () => activeItems.reduce((n, it) => n + (pref(it.kind, it.id).muted ? 0 : it.unread), 0),
    [activeItems, pref],
  );
  const unreadChats = useMemo(
    () => activeItems.filter((it) => it.unread > 0 || !!pref(it.kind, it.id).markedUnread).length,
    [activeItems, pref],
  );
  const onlineUsers = useMemo(
    () => activeItems.filter((it) => it.kind === "dm" && onlineIds.has(it.id)).map((it) => it.user as Profile),
    [activeItems, onlineIds],
  );

  const meId = me?.id ?? "";

  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<ListItem>) => {
      const p = pref(item.kind, item.id);
      const isDm = item.kind === "dm";
      const last = isDm ? item.last ?? null : null;
      const preview = isDm
        ? last
          ? last.content
          : onlineIds.has(item.id)
            ? "online"
            : "Tap to start chatting"
        : item.preview ?? "";
      return (
        <FadeIn delay={Math.min(index, 8) * 40}>
          <ChatRow
            kind={item.kind}
            id={item.id}
            name={item.name}
            lastAt={item.lastAt}
            last={last}
            preview={preview}
            unread={item.unread}
            pinned={!!p.pinnedAt}
            muted={!!p.muted}
            markedUnread={!!p.markedUnread}
            mine={!!last && last.sender_id === meId}
            online={isDm && onlineIds.has(item.id)}
            typing={isDm && !!typingIds[item.id]}
            theme={theme}
            onPress={openTarget}
            trigger={menu.trigger}
          />
        </FadeIn>
      );
    },
    [pref, meId, onlineIds, typingIds, theme, openTarget, menu.trigger],
  );

  const showStrip = filter === "all" && !query && !showArchived && onlineUsers.length > 0;
  const emptyAll = !query && filter === "all" && !showArchived;

  const emptyTitle = showArchived
    ? "No archived chats"
    : query
      ? "No matches"
      : filter === "unread"
        ? "No unread chats"
        : filter === "online"
          ? "Nobody is online"
          : "No chats yet";
  const emptyText = showArchived
    ? "Chats you archive will show up here."
    : query
      ? "Try a different name."
      : filter === "unread"
        ? "You are all caught up."
        : filter === "online"
          ? "People who are online right now will show up here."
          : "Search for someone by username to start a conversation.";

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {/* ------------------------------ header ------------------------------ */}
      <View style={[styles.header, { backgroundColor: theme.header, paddingTop: insets.top + 10 }]}>
        <View style={styles.headerRow}>
          {searching ? (
            <>
              <Pressable onPress={closeSearch} hitSlop={10} style={styles.iconBtn} accessibilityLabel="Close search">
                <Ionicons name="arrow-back" size={24} color={theme.headerText} />
              </Pressable>
              <TextInput
                autoFocus
                style={[
                  styles.searchInput,
                  { backgroundColor: theme.dark ? theme.searchBg : "#FFFFFF22", color: theme.headerText },
                  webReset,
                ]}
                placeholder="Search chats"
                placeholderTextColor={theme.headerSubText}
                value={query}
                onChangeText={setQuery}
              />
              {query ? (
                <Pressable onPress={() => setQuery("")} hitSlop={10} style={styles.iconBtn} accessibilityLabel="Clear search">
                  <Ionicons name="close" size={22} color={theme.headerText} />
                </Pressable>
              ) : null}
            </>
          ) : (
            <>
              <Pressable onPress={() => setDrawerOpen(true)} hitSlop={10} style={styles.iconBtn} accessibilityLabel="Open menu">
                <Ionicons name="menu" size={28} color={theme.headerText} />
                {unreadTotal + incoming.length > 0 ? (
                  <View style={[styles.menuDot, { backgroundColor: theme.online, borderColor: theme.header }]} />
                ) : null}
              </Pressable>
              <Text style={[styles.title, { color: theme.headerText }]}>AlphaChat</Text>
              <Pressable onPress={openFind} hitSlop={10} style={styles.iconBtn} accessibilityLabel="Find people">
                <Ionicons name="person-add-outline" size={22} color={theme.headerText} />
              </Pressable>
              <Pressable onPress={() => setSearching(true)} hitSlop={10} style={styles.iconBtn} accessibilityLabel="Search chats">
                <Ionicons name="search" size={22} color={theme.headerText} />
              </Pressable>
              <Pressable onPress={openProfile} hitSlop={6} style={styles.avatarBtn} accessibilityLabel="My profile">
                {me ? (
                  <Avatar name={me.username} size={34} online ringColor={theme.header} onlineColor={theme.online} />
                ) : null}
              </Pressable>
            </>
          )}
        </View>
      </View>

      {/* ---------------------------- filter chips --------------------------- */}
      <View style={styles.chips}>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          const count = f.key === "unread" ? unreadChats : f.key === "online" ? onlineUsers.length : 0;
          return (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[styles.chip, { backgroundColor: active ? theme.accent : theme.searchBg }]}
            >
              <Text style={{ color: active ? "#FFFFFF" : theme.subText, fontSize: 14, fontWeight: "600" }}>
                {f.label}
                {count > 0 ? `  ${count}` : ""}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {error ? (
        <Pressable onPress={() => void reload()} style={[styles.banner, { backgroundColor: theme.danger }]}>
          <Text style={styles.bannerText}>Connection problem · tap to retry</Text>
        </Pressable>
      ) : null}

      {incoming.length > 0 ? (
        <Pressable
          onPress={openRequests}
          style={[styles.requestsRow, { backgroundColor: theme.searchBg }]}
          accessibilityRole="button"
        >
          <Ionicons name="mail-unread-outline" size={20} color={theme.accent} />
          <Text style={[styles.requestsText, { color: theme.text }]}>
            {incoming.length} message {incoming.length === 1 ? "request" : "requests"}
          </Text>
          <Ionicons name="chevron-forward" size={18} color={theme.subText} />
        </Pressable>
      ) : null}

      {/* ------------------------------- list -------------------------------- */}
      <FlatList
        data={rows}
        keyExtractor={(item) => `${item.kind}:${item.id}`}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: insets.bottom + 12 }}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={12}
        windowSize={7}
        ListHeaderComponent={
          <View>
            {showArchived ? (
              <Pressable
                onPress={() => setShowArchived(false)}
                style={[styles.archiveRow, { borderBottomColor: theme.divider }]}
                accessibilityRole="button"
              >
                <Ionicons name="arrow-back" size={20} color={theme.accent} />
                <Text style={[styles.archiveText, { color: theme.text }]}>Archived chats · back to chats</Text>
              </Pressable>
            ) : (
              <>
                {archivedCount > 0 ? (
                  <Pressable
                    onPress={() => setShowArchived(true)}
                    style={[styles.archiveRow, { borderBottomColor: theme.divider }]}
                    accessibilityRole="button"
                  >
                    <Ionicons name="archive-outline" size={20} color={theme.accent} />
                    <Text style={[styles.archiveText, { color: theme.text }]}>Archived</Text>
                    <Text style={{ color: theme.subText, fontWeight: "700" }}>{archivedCount}</Text>
                  </Pressable>
                ) : null}
                <View style={styles.groupSectionHeader}>
                  <Text style={[styles.stripTitle, { color: theme.subText, marginBottom: 0 }]}>CHATS</Text>
                  <Pressable onPress={openCreateGroup} accessibilityRole="button" hitSlop={8}>
                    <Text style={{ color: theme.accent, fontWeight: "700" }}>New group</Text>
                  </Pressable>
                </View>
              </>
            )}
            {showStrip ? <OnlineStrip users={onlineUsers} theme={theme} onPress={onOpen} /> : null}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>{emptyTitle}</Text>
            <Text style={[styles.emptyText, { color: theme.subText }]}>{emptyText}</Text>
            {emptyAll ? (
              <Pressable onPress={openFind} style={[styles.emptyBtn, { backgroundColor: theme.accent }]}>
                <Text style={styles.emptyBtnText}>Find people</Text>
              </Pressable>
            ) : null}
          </View>
        }
      />

      {/* the right-click menu itself */}
      {menu.element}

      {/* drawer and modals sit on top of everything */}
      <Sidebar
        visible={drawerOpen}
        onClose={closeDrawer}
        onOpenProfile={openProfile}
        onFindPeople={openFind}
        onOpenRequests={openRequests}
        onOpenBlocked={openBlocked}
        onCreateGroup={openCreateGroup}
        onOpenGroupInvites={openGroupInvites}
      />
      <ProfileModal visible={overlay === "profile"} onClose={closeOverlay} />
      <FindPeopleModal visible={overlay === "find"} onClose={closeOverlay} onOpenChat={onOpen} />
      <RequestsModal visible={overlay === "requests"} onClose={closeOverlay} onOpenChat={onOpen} />
      <BlockedModal visible={overlay === "blocked"} onClose={closeOverlay} />
      <CreateGroupModal visible={overlay === "createGroup"} onClose={closeOverlay} onOpenGroup={onOpenGroup} />
      <GroupInvitesModal visible={overlay === "groupInvites"} onClose={closeOverlay} onOpenGroup={onOpenGroup} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 12, paddingBottom: 12 },
  headerRow: { flexDirection: "row", alignItems: "center", height: 44 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  avatarBtn: { marginLeft: 6 },
  title: { flex: 1, fontSize: 22, fontWeight: "800", marginLeft: 6 },
  searchInput: { flex: 1, height: 40, borderRadius: 20, paddingHorizontal: 16, fontSize: 15, marginLeft: 4 },
  menuDot: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 2,
  },
  chips: { flexDirection: "row", paddingHorizontal: 14, paddingVertical: 10 },
  chip: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 18, marginRight: 8 },
  banner: { paddingVertical: 8, alignItems: "center" },
  bannerText: { color: "#FFFFFF", fontWeight: "600" },
  requestsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 14,
    marginBottom: 6,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
  },
  requestsText: { flex: 1, fontSize: 15, fontWeight: "600", marginLeft: 10 },
  archiveRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  archiveText: { flex: 1, fontSize: 15.5, fontWeight: "600", marginLeft: 14 },
  strip: { paddingTop: 4, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  stripTitle: { fontSize: 12, fontWeight: "700", letterSpacing: 0.8, marginLeft: 16, marginBottom: 10 },
  stripContent: { paddingHorizontal: 12 },
  stripItem: { width: 68, alignItems: "center", marginHorizontal: 2 },
  groupSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingRight: 16,
    paddingTop: 6,
    paddingBottom: 8,
  },
  stripName: { fontSize: 12.5, marginTop: 6, maxWidth: 64 },
  row: { flexDirection: "row", alignItems: "center", paddingLeft: 16 },
  rowBody: {
    flex: 1,
    marginLeft: 14,
    paddingVertical: 14,
    paddingRight: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rowBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 3 },
  previewWrap: { flex: 1, flexDirection: "row", alignItems: "center" },
  tickBox: { marginRight: 4 },
  flags: { flexDirection: "row", alignItems: "center" },
  flagIcon: { marginLeft: 6 },
  name: { flex: 1, fontSize: 17, fontWeight: "600", marginRight: 8 },
  time: { fontSize: 12 },
  preview: { flex: 1, fontSize: 14.5 },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  badgeDot: { width: 12, height: 12, borderRadius: 6, marginLeft: 8 },
  badgeText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  empty: { paddingTop: 80, paddingHorizontal: 40, alignItems: "center" },
  emptyTitle: { fontSize: 18, fontWeight: "700", marginBottom: 8 },
  emptyText: { fontSize: 14.5, textAlign: "center", lineHeight: 21 },
  emptyBtn: { marginTop: 22, paddingHorizontal: 26, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  emptyBtnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 15 },
});