import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  BackHandler,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import { ChatProvider, useChat } from './lib/ChatContext';
import { USE_NATIVE_DRIVER, useTheme } from './lib/theme';
import { AuthScreen } from './components/AuthScreen';
import { ChatListScreen } from './components/ChatListScreen';
import { ChatScreen } from './components/ChatScreen';

function CenterMessage({ title, body, action }: { title: string; body?: string; action?: { label: string; onPress: () => void } }) {
  const theme = useTheme();
  return (
    <View style={[styles.center, { backgroundColor: theme.background }]}>
      <Text style={[styles.centerTitle, { color: theme.text }]}>{title}</Text>
      {body ? <Text style={[styles.centerBody, { color: theme.subText }]}>{body}</Text> : null}
      {action ? (
        <Pressable onPress={action.onPress} style={[styles.centerBtn, { backgroundColor: theme.accent }]}>
          <Text style={styles.centerBtnText}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function Main() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const { loading, me, error, reload, signOut } = useChat();

  const [openId, setOpenId] = useState<string | null>(null);
  const [mountedId, setMountedId] = useState<string | null>(null);
  const slide = useRef(new Animated.Value(0)).current;

  const open = useCallback(
    (id: string) => {
      setMountedId(id);
      setOpenId(id);
      Animated.timing(slide, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: USE_NATIVE_DRIVER,
      }).start();
    },
    [slide]
  );

  const close = useCallback(() => {
    setOpenId(null);
    Animated.timing(slide, {
      toValue: 0,
      duration: 220,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start(({ finished }) => {
      if (finished) setMountedId(null);
    });
  }, [slide]);

  // Android hardware back button closes the open chat first.
  useEffect(() => {
    if (!openId) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [openId, close]);

  if (loading && !me) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  if (!me) {
    return (
      <CenterMessage
        title="Could not load your profile"
        body={error ?? 'Check your Supabase tables and policies, then try again.'}
        action={{ label: 'Try again', onPress: () => void reload() }}
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <Animated.View
        style={{
          flex: 1,
          transform: [{ translateX: slide.interpolate({ inputRange: [0, 1], outputRange: [0, -width * 0.2] }) }],
        }}
      >
        <ChatListScreen onOpen={open} />
      </Animated.View>

      {mountedId ? (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { transform: [{ translateX: slide.interpolate({ inputRange: [0, 1], outputRange: [width, 0] }) }] },
          ]}
        >
          <ChatScreen peerId={mountedId} onBack={close} />
        </Animated.View>
      ) : null}
    </View>
  );
}

function Root() {
  const theme = useTheme();
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (mounted) setSession(data.session);
      })
      .catch(() => undefined)
      .finally(() => {
        if (mounted) setReady(true);
      });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      if (mounted) setSession(next);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (!isSupabaseConfigured) {
    return (
      <CenterMessage
        title="Supabase is not configured"
        body="Create a .env file with EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY, then restart with: npx expo start -c"
      />
    );
  }

  if (!ready) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  if (!session) return <AuthScreen />;

  return (
    <ChatProvider key={session.user.id} userId={session.user.id}>
      <Main />
    </ChatProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Root />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  centerTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  centerBody: { fontSize: 15, textAlign: 'center', marginTop: 10, lineHeight: 22 },
  centerBtn: { marginTop: 24, paddingHorizontal: 28, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  centerBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
});