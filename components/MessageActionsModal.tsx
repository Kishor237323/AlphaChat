import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../lib/theme';
import type { GroupMessage, GroupReportReason } from '../lib/groupApi';

export const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

const REASONS: { key: GroupReportReason; label: string }[] = [
  { key: 'spam', label: 'Spam' },
  { key: 'harassment', label: 'Harassment or threats' },
  { key: 'impersonation', label: 'Pretending to be someone else' },
  { key: 'inappropriate', label: 'Inappropriate content' },
  { key: 'other', label: 'Something else' },
];

type Stage = 'menu' | 'report' | 'done';

type Props = {
  message: GroupMessage | null;
  mine: boolean;
  isAdmin: boolean;
  onClose: () => void;
  onReact: (emoji: string) => void;
  onReply: () => void;
  onPin: (pin: boolean) => Promise<void>;
  onDelete: () => Promise<void>;
  onReport: (reason: GroupReportReason) => Promise<void>;
};

export function MessageActionsModal({ message, mine, isAdmin, onClose, onReact, onReply, onPin, onDelete, onReport }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [stage, setStage] = useState<Stage>('menu');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (message) {
      setStage('menu');
      setConfirmDelete(false);
      setBusy(false);
      setError(null);
    }
  }, [message?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (fn: () => Promise<void>, closeAfter = true) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      if (closeAfter) onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const canDelete = mine || isAdmin;
  const item = (icon: React.ComponentProps<typeof Ionicons>['name'], label: string, onPress: () => void, color?: string) => (
    <Pressable onPress={onPress} disabled={busy} style={styles.item}>
      <Ionicons name={icon} size={22} color={color ?? theme.subText} />
      <Text style={[styles.itemText, { color: color ?? theme.text }]}>{label}</Text>
    </Pressable>
  );

  return (
    <Modal visible={!!message} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.wrap}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: theme.background, paddingBottom: insets.bottom + 14 }]}>
          {stage === 'menu' && message ? (
            <>
              <View style={styles.emojiRow}>
                {REACTION_EMOJIS.map((e) => (
                  <Pressable
                    key={e}
                    onPress={() => {
                      onReact(e);
                      onClose();
                    }}
                    style={[styles.emojiBtn, { backgroundColor: theme.searchBg }]}
                  >
                    <Text style={{ fontSize: 24 }}>{e}</Text>
                  </Pressable>
                ))}
              </View>

              {item('arrow-undo-outline', 'Reply', () => {
                onReply();
                onClose();
              })}
              {isAdmin
                ? item(message.pinned_at ? 'pin-outline' : 'pin', message.pinned_at ? 'Unpin message' : 'Pin message', () =>
                    void run(() => onPin(!message.pinned_at))
                  )
                : null}
              {canDelete
                ? item(
                    'trash-outline',
                    confirmDelete ? 'Tap again to delete for everyone' : 'Delete',
                    () => (confirmDelete ? void run(onDelete) : setConfirmDelete(true)),
                    theme.danger
                  )
                : null}
              {!mine ? item('flag-outline', 'Report', () => setStage('report'), theme.danger) : null}
            </>
          ) : null}

          {stage === 'report' ? (
            <>
              <Text style={[styles.title, { color: theme.text }]}>Report this message</Text>
              <Text style={{ color: theme.subText, fontSize: 14, marginBottom: 8 }}>
                Group admins will see your report. Why are you reporting it?
              </Text>
              {REASONS.map((r) => (
                <Pressable
                  key={r.key}
                  disabled={busy}
                  onPress={() =>
                    void run(async () => {
                      await onReport(r.key);
                      setStage('done');
                    }, false)
                  }
                  style={styles.item}
                >
                  <Text style={[styles.itemTextPlain, { color: theme.text }]}>{r.label}</Text>
                  <Ionicons name="chevron-forward" size={18} color={theme.subText} />
                </Pressable>
              ))}
            </>
          ) : null}

          {stage === 'done' ? (
            <>
              <Text style={[styles.title, { color: theme.text }]}>Report sent</Text>
              <Text style={{ color: theme.subText, fontSize: 14.5, marginBottom: 12 }}>Thank you. The group admins will review it.</Text>
              <Pressable onPress={onClose} style={[styles.doneBtn, { backgroundColor: theme.accent }]}>
                <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Done</Text>
              </Pressable>
            </>
          ) : null}

          {busy ? <ActivityIndicator style={{ marginTop: 8 }} color={theme.accent} /> : null}
          {error ? <Text style={{ color: theme.danger, textAlign: 'center', marginTop: 10 }}>{error}</Text> : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 20, paddingTop: 18 },
  emojiRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  emojiBtn: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  itemText: { fontSize: 16.5, fontWeight: '500', marginLeft: 16 },
  itemTextPlain: { flex: 1, fontSize: 16 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
  doneBtn: { height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
});
