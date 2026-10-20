import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { USE_NATIVE_DRIVER, useTheme } from '../lib/theme';

const webReset: any = Platform.OS === 'web' ? { outlineStyle: 'none' } : null;

export function AuthScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const shake = useRef(new Animated.Value(0)).current;

  const fail = (message: string) => {
    setError(message);
    shake.setValue(0);
    Animated.sequence([
      Animated.timing(shake, { toValue: 10, duration: 60, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.timing(shake, { toValue: -10, duration: 60, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.timing(shake, { toValue: 6, duration: 60, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.timing(shake, { toValue: 0, duration: 60, useNativeDriver: USE_NATIVE_DRIVER }),
    ]).start();
  };

  const submit = async () => {
    setError(null);
    setInfo(null);
    const mail = email.trim().toLowerCase();
    if (!mail || !password) return fail('Enter your email and password.');
    if (mode === 'signup' && username.trim().length < 2) return fail('Pick a name with at least 2 characters.');
    if (password.length < 6) return fail('Password must be at least 6 characters.');

    setBusy(true);
    try {
      if (mode === 'signin') {
        const { error: err } = await supabase.auth.signInWithPassword({ email: mail, password });
        if (err) fail(err.message);
      } else {
        const { data, error: err } = await supabase.auth.signUp({
          email: mail,
          password,
          options: { data: { username: username.trim() } },
        });
        if (err) fail(err.message);
        else if (!data.session) setInfo('Account created. Check your email to confirm it, then sign in.');
      }
    } catch (e) {
      fail(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const inputStyle = [styles.input, { backgroundColor: theme.searchBg, color: theme.text }, webReset];

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.background }} behavior="padding">
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.logo, { backgroundColor: theme.accent }]}>
          <Text style={styles.logoText}>A</Text>
        </View>
        <Text style={[styles.title, { color: theme.text }]}>AlphaChat</Text>
        <Text style={[styles.subtitle, { color: theme.subText }]}>
          {mode === 'signin' ? 'Welcome back' : 'Create your account'}
        </Text>

        <Animated.View style={{ width: '100%', transform: [{ translateX: shake }] }}>
          {mode === 'signup' ? (
            <TextInput
              style={inputStyle}
              placeholder="Your name"
              placeholderTextColor={theme.subText}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="words"
            />
          ) : null}
          <TextInput
            style={inputStyle}
            placeholder="Email"
            placeholderTextColor={theme.subText}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
          />
          <TextInput
            style={inputStyle}
            placeholder="Password"
            placeholderTextColor={theme.subText}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            onSubmitEditing={submit}
          />
        </Animated.View>

        {error ? <Text style={[styles.message, { color: theme.danger }]}>{error}</Text> : null}
        {info ? <Text style={[styles.message, { color: theme.accent }]}>{info}</Text> : null}

        <Pressable
          onPress={submit}
          disabled={busy}
          style={({ pressed }) => [styles.button, { backgroundColor: theme.accent, opacity: pressed || busy ? 0.8 : 1 }]}
        >
          {busy ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>{mode === 'signin' ? 'Sign in' : 'Sign up'}</Text>
          )}
        </Pressable>

        <Pressable
          onPress={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin');
            setError(null);
            setInfo(null);
          }}
          hitSlop={10}
        >
          <Text style={[styles.switch, { color: theme.accent }]}>
            {mode === 'signin' ? "New here? Create an account" : 'Already have an account? Sign in'}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, alignItems: 'center', paddingHorizontal: 28 },
  logo: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: '#FFFFFF', fontSize: 42, fontWeight: '800' },
  title: { fontSize: 28, fontWeight: '800', marginTop: 16 },
  subtitle: { fontSize: 15, marginTop: 4, marginBottom: 28 },
  input: { width: '100%', height: 50, borderRadius: 12, paddingHorizontal: 16, fontSize: 16, marginBottom: 12 },
  message: { fontSize: 14, textAlign: 'center', marginBottom: 12 },
  button: { width: '100%', height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  switch: { marginTop: 20, fontSize: 15, fontWeight: '600' },
});