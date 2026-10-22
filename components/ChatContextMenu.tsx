import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { groupApi } from '../lib/groupApi';
import { MAX_PINNED, useChatPrefs, type ChatTarget } from '../lib/chatPrefs';
import { useTheme } from '../lib/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
type Point = { x: number; y: number } | null;
type Confirm = 'delete' | 'leave' | null;

type Item = {
  key: string;
  icon: IconName;
  label: string;
  danger?: boolean;
  onPress: () => void;
};

type Options = {
  onOpenChat: (t: ChatTarget) => void;
  onGroupInfo: (groupId: string) => void;
};

const MENU_W = 250;
const ROW_H = 46;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, hi));

export function useChatMenu({ onOpenChat, onGroupInfo }: Options) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const prefs = useChatPrefs();

  const [target, setTarget] = useState<ChatTarget | null>(null);
  const [point, setPoint] = useState<Point>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = useCallback((t: ChatTarget, p: Point) => {
    setTarget(t);
    setPoint(p);
    setConfirm(null);
    setError(null);
    setBusy(false);
  }, []);

  const close = useCallback(() => setTarget(null), []);

  /** Spread onto a row's <Pressable>: right-click on web, long-press on phones. */
  const trigger = useCallback(
    (t: ChatTarget): any => ({
      delayLongPress: 350,
      onLongPress: () => open(t, null),
      onContextMenu: (e: any) => {
        e?.preventDefault?.();
        const n = e?.nativeEvent ?? e;
        const x = n?.clientX ?? n?.pageX;
        const y = n?.clientY ?? n?.pageY;
        open(t, typeof x === 'number' && typeof y === 'number' ? { x, y } : null);
      },
    }),
    [open]
  );

  const items: Item[] = [];
  if (target) {
    const p = prefs.pref(target.kind, target.id);
    const isGroup = target.kind === 'group';

    items.push({
      key: 'open',
      icon: 'chatbubble-outline',
      label: 'Open chat',
      onPress: () => {
        close();
        onOpenChat(target);
      },
    });
    items.push({
      key: 'unread',
      icon: p.markedUnread ? 'mail-open-outline' : 'mail-unread-outline',
      label: p.markedUnread ? 'Mark as read' : 'Mark as unread',
      onPress: () => {
        prefs.setMarkedUnread(target, !p.markedUnread);
        close();
      },
    });
    items.push({
      key: 'pin',
      icon: p.pinnedAt ? 'pin-outline' : 'pin',
      label: p.pinnedAt ? 'Unpin chat' : 'Pin chat',
      onPress: () => {
        if (prefs.togglePin(target)) close();
        else setError(`You can pin up to ${MAX_PINNED} chats.`);
      },
    });
    items.push({
      key: 'mute',
      icon: p.muted ? 'notifications-outline' : 'notifications-off-outline',
      label: p.muted ? 'Unmute notifications' : 'Mute notifications',
      onPress: () => {
        prefs.toggleMute(target);
        close();
      },
    });
    items.push({
      key: 'archive',
      icon: p.archived ? 'arrow-undo-outline' : 'archive-outline',
      label: p.archived ? 'Unarchive chat' : 'Archive chat',
      onPress: () => {
        prefs.toggleArchive(target);
        close();
      },
    });
    if (isGroup) {
      items.push({
        key: 'info',
        icon: 'information-circle-outline',
        label: 'Group info',
        onPress: () => {
          close();
          onGroupInfo(target.id);
        },
      });
    }
    items.push({
      key: 'delete',
      icon: 'trash-outline',
      label: confirm === 'delete' ? 'Tap again to delete' : 'Delete chat',
      danger: true,
      onPress: () => {
        if (confirm === 'delete') {
          prefs.deleteChat(target);
          close();
        } else {
          setConfirm('delete');
        }
      },
    });
    if (isGroup) {
      items.push({
        key: 'leave',
        icon: 'exit-outline',
        label: confirm === 'leave' ? 'Tap again to leave' : 'Leave group',
        danger: true,
        onPress: () => {
          if (confirm !== 'leave') {
            setConfirm('leave');
            return;
          }
          setBusy(true);
          setError(null);
          groupApi
            .leave(target.id)
            .then(close)
            .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not leave.'))
            .finally(() => setBusy(false));
        },
      });
    }
  }

  const isWeb = Platform.OS === 'web';
  const estHeight = items.length * ROW_H + 16;
  const popStyle = isWeb
    ? {
        position: 'absolute' as const,
        width: MENU_W,
        left: point ? clamp(point.x, 8, width - MENU_W - 8) : (width - MENU_W) / 2,
        top: point ? clamp(point.y, 8, height - estHeight - 8) : Math.max(8, (height - estHeight) / 2),
        borderRadius: 12,
        paddingVertical: 8,
      }
    : {
        borderTopLeftRadius: 22,
        borderTopRightRadius: 22,
        paddingTop: 16,
        paddingBottom: insets.bottom + 12,
        paddingHorizontal: 12,
      };

  const element = (
    <Modal visible={!!target} transparent animationType="fade" onRequestClose={close}>
      <View style={[styles.fill, !isWeb && styles.bottom]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={close}
          {...({ onContextMenu: (e: any) => { e?.preventDefault?.(); close(); } } as any)}
        />
        <View style={[styles.card, { backgroundColor: theme.background }, popStyle]}>
          {!isWeb && target ? (
            <Text numberOfLines={1} style={[styles.title, { color: theme.text }]}>
              {target.name}
            </Text>
          ) : null}

          {items.map((it) => (
            <Pressable
              key={it.key}
              disabled={busy}
              onPress={it.onPress}
              style={({ pressed }) => [
                styles.row,
                pressed && { backgroundColor: theme.pressed },
              ]}
            >
              <Ionicons name={it.icon} size={20} color={it.danger ? theme.danger : theme.subText} />
              <Text style={[styles.label, { color: it.danger ? theme.danger : theme.text }]}>
                {it.label}
              </Text>
            </Pressable>
          ))}

          {busy ? <ActivityIndicator style={{ marginTop: 6 }} color={theme.accent} /> : null}
          {error ? (
            <Text style={{ color: theme.danger, textAlign: 'center', marginTop: 8, paddingHorizontal: 12 }}>
              {error}
            </Text>
          ) : null}
        </View>
      </View>
    </Modal>
  );

  return { trigger, element };
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)' },
  bottom: { justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 12,
  },
  title: { fontSize: 17, fontWeight: '700', marginBottom: 6, paddingHorizontal: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: ROW_H,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  label: { fontSize: 15.5, fontWeight: '500', marginLeft: 14 },
});