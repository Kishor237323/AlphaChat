import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useChat } from '../lib/ChatContext';
import { useTheme } from '../lib/theme';
import { Avatar } from './Avatar';

const webReset: any = Platform.OS === 'web' ? { outlineStyle: 'none' } : null;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function memberSince(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function ProfileModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useTheme();
  const { me, reload } = useChat();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  // Reset the form every time the modal opens.
  useEffect(() => {
    if (!visible) return;
    setName(me?.username ?? '');
    setMessage(null);
    supabase.auth
      .getSession()
      .then(({ data }) => setEmail(data.session?.user.email ?? ''))
      .catch(() => undefined);
  }, [visible, me?.username]);

  const save = async () => {
    if (!me) return;
    const clean = name.trim();
    if (clean.length < 2 || clean.length > 40) {
      setMessage({ text: 'Use a name between 2 and 40 characters.', ok: false });
      return;
    }
    if (clean === me.username) {
      setMessage({ text: 'Nothing to change.', ok: false });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const { error } = await supabase.from('profiles').update({ username: clean }).eq('id', me.id);
      if (error) throw error;
      await reload();
      setMessage({ text: 'Profile updated.', ok: true });
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : 'Could not update your profile.', ok: false });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.card, { backgroundColor: theme.background }]}>
          <View style={styles.topRow}>
            <Text style={[styles.title, { color: theme.text }]}>My profile</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={24} color={theme.subText} />
            </Pressable>
          </View>

          <View style={styles.avatarWrap}>
            <Avatar
              name={name.trim() || me?.username || '?'}
              size={92}
              online
              ringColor={theme.background}
              onlineColor={theme.online}
            />
          </View>

          <Text style={[styles.label, { color: theme.subText }]}>Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            maxLength={40}
            autoCapitalize="words"
            placeholder="Your name"
            placeholderTextColor={theme.subText}
            style={[styles.input, { backgroundColor: theme.searchBg, color: theme.text }, webReset]}
          />

          <Text style={[styles.label, { color: theme.subText }]}>Email</Text>
          <View style={[styles.input, styles.readonly, { backgroundColor: theme.searchBg }]}>
            <Text numberOfLines={1} style={{ color: theme.subText, fontSize: 16 }}>
              {email || '—'}
            </Text>
          </View>

          {me?.created_at ? (
            <Text style={[styles.since, { color: theme.subText }]}>Member since {memberSince(me.created_at)}</Text>
          ) : null}

          {message ? (
            <Text style={[styles.message, { color: message.ok ? theme.accent : theme.danger }]}>{message.text}</Text>
          ) : null}

          <Pressable
            onPress={() => void save()}
            disabled={saving}
            style={[styles.saveBtn, { backgroundColor: theme.accent, opacity: saving ? 0.7 : 1 }]}
          >
            {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveText}>Save changes</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.55)', padding: 20 },
  card: { width: '100%', maxWidth: 420, borderRadius: 20, padding: 20 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 20, fontWeight: '700' },
  avatarWrap: { alignItems: 'center', marginVertical: 18 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 6 },
  input: { height: 48, borderRadius: 12, paddingHorizontal: 14, fontSize: 16 },
  readonly: { justifyContent: 'center' },
  since: { fontSize: 12.5, marginTop: 12, textAlign: 'center' },
  message: { fontSize: 14, textAlign: 'center', marginTop: 12 },
  saveBtn: { height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  saveText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});