
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  Text,
} from 'react-native';

import type { Session } from '@supabase/supabase-js';
import ChatHome from './components/ChatHome';
import { supabase } from './lib/supabase';
import AuthScreen from './components/AuthScreen';

export default function App() {
  const [session, setSession] =
    useState<Session | null>(null);
  const [checkingSession, setCheckingSession] =
    useState(true);
  const [sessionError, setSessionError] = useState('');

  useEffect(() => {
    let active = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        if (!active) return;

        setSession(newSession);
        setCheckingSession(false);
      }
    );

    supabase.auth.getSession()
      .then(({ data, error }) => {
        if (!active) return;

        if (error) {
          setSessionError(error.message);
        }

        setSession(data.session);
        setCheckingSession(false);
      })
      .catch((error: unknown) => {
        if (!active) return;

        setSessionError(
          error instanceof Error
            ? error.message
            : 'Unable to restore your session.'
        );
        setCheckingSession(false);
      });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  if (checkingSession) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#818CF8" />
        <Text style={styles.subtitle}>
          Checking your session...
        </Text>
      </SafeAreaView>
    );
  }

  if (sessionError) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.brand}>ALPHA CHAT</Text>
        <Text style={styles.error}>{sessionError}</Text>
      </SafeAreaView>
    );
  }

  if (!session) {
    return <AuthScreen />;
  }

  return <ChatHome userId={session.user.id} />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#070B1A',
  },
  brand: {
    color: '#818CF8',
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 14,
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 14,
    marginTop: 12,
  },
  error: {
    color: '#FDA4AF',
    textAlign: 'center',
    marginBottom: 16,
  },
});
