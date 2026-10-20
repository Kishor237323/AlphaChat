import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useConnections, type ReportReason } from '../lib/connections';
import { useTheme } from '../lib/theme';

type Stage = 'menu' | 'confirmBlock' | 'report' | 'done';

const REASONS: { key: ReportReason; label: string }[] = [
  { key: 'spam', label: 'Spam or unwanted messages' },
  { key: 'harassment', label: 'Harassment or threats' },
  { key: 'impersonation', label: 'Pretending to be someone else' },
  { key: 'inappropriate', label: 'Inappropriate content' },
  { key: 'other', label: 'Something else' },
];

export function PeerActionsModal({
  visible,
  peerId,
  peerName,
  onClose,
  onBlocked,
}: {
  visible: boolean;
  peerId: string;
  peerName: string;
  onClose: () => void;
  /** called after the person was blocked, so the chat can close */
  onBlocked: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { block, report } = useConnections();

  const [stage, setStage] = useState<Stage>('menu');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alsoBlock, setAlsoBlock] = useState(true);

  useEffect(() => {
    if (visible) {
      setStage('menu');
      setBusy(false);
      setError(null);
      setAlsoBlock(true);
    }
  }, [visible]);

  const fail = (e: unknown) => setError(e instanceof Error ? e.message : 'Something went wrong.');

  const doBlock = async () => {
    setBusy(true);
    setError(null);
    try {
      await block(peerId);
      onClose();
      onBlocked();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const doReport = async (reason: ReportReason) => {
    setBusy(true);
    setError(null);
    try {
      await report(peerId, reason, undefined, alsoBlock);
      if (alsoBlock) {
        onClose();
        onBlocked();
      } else {
        setStage('done');
      }
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.wrap}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: theme.background, paddingBottom: insets.bottom + 16 }]}>
          {stage === 'menu' ? (
            <>
              <Text style={[styles.title, { color: theme.text }]}>{peerName}</Text>
              <Pressable onPress={() => setStage('confirmBlock')} style={styles.item}>
                <Ionicons name="ban-outline" size={22} color={theme.danger} />
                <Text style={[styles.itemText, { color: theme.danger }]}>Block</Text>
              </Pressable>
              <Pressable onPress={() => setStage('report')} style={styles.item}>
                <Ionicons name="flag-outline" size={22} color={theme.danger} />
                <Text style={[styles.itemText, { color: theme.danger }]}>Report</Text>
              </Pressable>
              <Pressable onPress={onClose} style={styles.item}>
                <Ionicons name="close-outline" size={22} color={theme.subText} />
                <Text style={[styles.itemText, { color: theme.text }]}>Cancel</Text>
              </Pressable>
            </>
          ) : null}

          {stage === 'confirmBlock' ? (
            <>
              <Text style={[styles.title, { color: theme.text }]}>Block {peerName}?</Text>
              <Text style={[styles.body, { color: theme.subText }]}>
                They will not be able to message you or see your profile. You can unblock them any time from the menu.
              </Text>
              <View style={styles.btnRow}>
                <Pressable onPress={() => setStage('menu')} style={[styles.btn, { backgroundColor: theme.searchBg }]}>
                  <Text style={{ color: theme.text, fontWeight: '700' }}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={() => void doBlock()}
                  disabled={busy}
                  style={[styles.btn, { backgroundColor: theme.danger, opacity: busy ? 0.7 : 1 }]}
                >
                  {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.btnLight}>Block</Text>}
                </Pressable>
              </View>
            </>
          ) : null}

          {stage === 'report' ? (
            <>
              <Text style={[styles.title, { color: theme.text }]}>Report {peerName}</Text>
              <Text style={[styles.body, { color: theme.subText }]}>
                Why are you reporting this person? Messages are not attached to the report.
              </Text>
              {REASONS.map((r) => (
                <Pressable key={r.key} onPress={() => void doReport(r.key)} disabled={busy} style={styles.item}>
                  <Text style={[styles.itemTextPlain, { color: theme.text }]}>{r.label}</Text>
                  <Ionicons name="chevron-forward" size={18} color={theme.subText} />
                </Pressable>
              ))}
              <Pressable onPress={() => setAlsoBlock((v) => !v)} style={[styles.item, { marginTop: 6 }]}>
                <Ionicons
                  name={alsoBlock ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={alsoBlock ? theme.accent : theme.subText}
                />
                <Text style={[styles.itemTextPlain, { color: theme.text, marginLeft: 14 }]}>Also block this person</Text>
              </Pressable>
              {busy ? <ActivityIndicator style={{ marginTop: 8 }} color={theme.accent} /> : null}
            </>
          ) : null}

          {stage === 'done' ? (
            <>
              <Text style={[styles.title, { color: theme.text }]}>Report sent</Text>
              <Text style={[styles.body, { color: theme.subText }]}>Thank you. We will review it.</Text>
              <Pressable onPress={onClose} style={[styles.btn, { backgroundColor: theme.accent, marginTop: 8 }]}>
                <Text style={styles.btnLight}>Done</Text>
              </Pressable>
            </>
          ) : null}

          {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 20, paddingTop: 20 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 10 },
  body: { fontSize: 14.5, lineHeight: 21, marginBottom: 14 },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  itemText: { fontSize: 16.5, fontWeight: '600', marginLeft: 16 },
  itemTextPlain: { flex: 1, fontSize: 16 },
  btnRow: { flexDirection: 'row' },
  btn: { flex: 1, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  btnLight: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  error: { textAlign: 'center', marginTop: 12 },
});