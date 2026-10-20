
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { supabase } from '../lib/supabase';

type Profile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
};

type Props = {
  userId: string;
};

export default function ChatHome({ userId }: Props) {
  const [myProfile, setMyProfile] = useState<Profile | null>(null);
  const [people, setPeople] = useState<Profile[]>([]);
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] =
    useState<'error' | 'success'>('error');

  const loadProfiles = useCallback(async () => {
    setLoading(true);
    setMessage('');

    try {
      const [ownResult, peopleResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, display_name, avatar_url')
          .eq('id', userId)
          .single(),

        supabase
          .from('profiles')
          .select('id, display_name, avatar_url')
          .neq('id', userId)
          .order('display_name', { ascending: true })
          .limit(50),
      ]);

      if (ownResult.error && ownResult.error.code !== 'PGRST116') {
        throw ownResult.error;
      }
      if (peopleResult.error) throw peopleResult.error;

      let own = ownResult.data as Profile | null;

      if (!own) {
        const { data: userResult, error: userError } =
          await supabase.auth.getUser();
        if (userError) throw userError;

        const metadataName = userResult.user.user_metadata
          ?.display_name;
        const fallbackName =
          typeof metadataName === 'string' &&
          metadataName.trim().length >= 2
            ? metadataName.trim().slice(0, 40)
            : 'New user';
        const { data: created, error: createError } =
          await supabase
            .from('profiles')
            .insert({
              id: userId,
              display_name: fallbackName,
              avatar_url: null,
            })
            .select('id, display_name, avatar_url')
            .single();

        if (createError) throw createError;
        own = created as Profile;
      }

      setMyProfile(own);
      setDisplayName(own.display_name);
      setPeople((peopleResult.data ?? []) as Profile[]);
    } catch (error: unknown) {
      setMessageType('error');
      setMessage(
        error instanceof Error
          ? error.message
          : 'Unable to load profiles.'
      );
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void Promise.resolve().then(() => loadProfiles());
  }, [loadProfiles]);

  async function saveDisplayName() {
    const cleanName = displayName.trim();

    if (cleanName.length < 2 || cleanName.length > 40) {
      setMessageType('error');
      setMessage('Use a display name between 2 and 40 characters.');
      return;
    }

    setSaving(true);
    setMessage('');

    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({ display_name: cleanName })
        .eq('id', userId)
        .select('id, display_name, avatar_url')
        .single();

      if (error) throw error;

      setMyProfile(data as Profile);
      setDisplayName(cleanName);
      setMessageType('success');
      setMessage('Display name updated successfully.');

      await loadProfiles();
    } catch (error: unknown) {
      setMessageType('error');
      setMessage(
        error instanceof Error
          ? error.message
          : 'Could not update your profile.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function signOut() {
    setSigningOut(true);
    setMessage('');

    try {
      const { error } = await supabase.auth.signOut({
        scope: 'local',
      });

      if (error) throw error;
    } catch (error: unknown) {
      setMessageType('error');
      setMessage(
        error instanceof Error
          ? error.message
          : 'Could not sign out.'
      );
    } finally {
      setSigningOut(false);
    }
  }

  if (loading && !myProfile) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#818CF8" />
        <Text style={styles.muted}>Loading your profile...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>ALPHA CHAT</Text>
            <Text style={styles.subtitle}>
              Your people, one conversation away.
            </Text>
          </View>

          <Pressable
            onPress={() => void loadProfiles()}
            style={styles.refreshButton}
          >
            <Text style={styles.refreshText}>Refresh</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.heading}>Your profile</Text>

          <Text style={styles.label}>Display name</Text>
          <TextInput
            style={styles.input}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Enter your name"
            maxLength={40}
            autoCapitalize="words"
          />

          <Pressable
            onPress={() => void saveDisplayName()}
            disabled={saving}
            style={[styles.button, saving && styles.disabled]}
          >
            <Text style={styles.buttonText}>
              {saving ? 'Saving...' : 'Save changes'}
            </Text>
          </Pressable>

          <Text style={styles.muted}>
            Signed in as {myProfile?.display_name ?? 'User'}
          </Text>
        </View>

        {message ? (
          <Text
            style={[
              styles.message,
              messageType === 'success'
                ? styles.success
                : styles.error,
            ]}
          >
            {message}
          </Text>
        ) : null}

        <View style={styles.sectionHeader}>
          <Text style={styles.heading}>People on Alpha Chat</Text>
          <Text style={styles.count}>{people.length}</Text>
        </View>

        {people.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.body}>
              No other users yet. Register another test account
              with a different email address to test this directory.
            </Text>
          </View>
        ) : (
          people.map((person) => (
            <View key={person.id} style={styles.person}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(person.display_name || 'U')
                    .charAt(0)
                    .toUpperCase()}
                </Text>
              </View>

              <View style={styles.personInfo}>
                <Text style={styles.personName}>
                  {person.display_name}
                </Text>
                <Text style={styles.muted}>
                  Alpha Chat member
                </Text>
              </View>
            </View>
          ))
        )}

        <Text style={styles.footer}>
          One-to-one messaging is the next milestone.
        </Text>

        <Pressable
          onPress={() => void signOut()}
          disabled={signingOut}
          style={styles.signOutButton}
        >
          <Text style={styles.signOutText}>
            {signingOut ? 'Signing out...' : 'Sign out'}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#070B1A',
  },
  content: {
    padding: 20,
    paddingBottom: 36,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#070B1A',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  brand: {
    color: '#818CF8',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 2,
  },
  subtitle: {
    color: '#94A3B8',
    marginTop: 5,
  },
  heading: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
  },
  card: {
    backgroundColor: '#11182D',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#263354',
    padding: 18,
    marginBottom: 16,
  },
  label: {
    color: '#CBD5E1',
    fontWeight: '600',
    marginTop: 18,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#334268',
    borderRadius: 10,
    padding: 13,
    backgroundColor: '#0B1124',
    color: '#F8FAFC',
  },
  button: {
    backgroundColor: '#4F46E5',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 14,
  },
  disabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  refreshButton: {
    padding: 10,
  },
  refreshText: {
    color: '#A5B4FC',
    fontWeight: '700',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  count: {
    color: '#94A3B8',
    fontWeight: '700',
  },
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#11182D',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#263354',
    padding: 14,
    marginBottom: 10,
  },
  avatar: {
    height: 44,
    width: 44,
    borderRadius: 22,
    backgroundColor: '#25225A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#A5B4FC',
    fontSize: 18,
    fontWeight: '800',
  },
  personInfo: {
    marginLeft: 12,
    flex: 1,
  },
  personName: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
  },
  muted: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 5,
  },
  body: {
    color: '#CBD5E1',
    lineHeight: 21,
  },
  message: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 8,
    overflow: 'hidden',
  },
  success: {
    backgroundColor: '#12352F',
    color: '#6EE7B7',
  },
  error: {
    backgroundColor: '#3A1725',
    color: '#FDA4AF',
  },
  footer: {
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  signOutButton: {
    borderWidth: 1,
    borderColor: '#334268',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  signOutText: {
    color: '#FDA4AF',
    fontWeight: '700',
  },
});
