import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { signInWithGoogle } from '../lib/googleAuth';
import { USE_NATIVE_DRIVER, useTheme, type Theme } from '../lib/theme';

const webReset: any = Platform.OS === 'web' ? { outlineStyle: 'none' } : null;

const TAGLINES = [
  'Chat in real time',
  'See who is online',
  'Know when they are typing',
  'Read receipts that update live',
];

/* ----------------------------- animation helpers ---------------------------- */

/** A value that glides 0 -> 1 -> 0 forever (like a pendulum). */
function useYoyo(duration: number, delay = 0) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, {
          toValue: 1,
          duration,
          delay,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(v, {
          toValue: 0,
          duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [v, duration, delay]);
  return v;
}

/** Fades in and slides up after `delay` ms. Used to stagger the form. */
function Reveal({
  delay,
  children,
  style,
}: {
  delay: number;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, {
      toValue: 1,
      duration: 480,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [v, delay]);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: v,
          transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [26, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/** Text that fades in again whenever its content changes. */
function FadeText({ text, style }: { text: string; style: StyleProp<any> }) {
  const op = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    op.setValue(0);
    Animated.timing(op, { toValue: 1, duration: 260, useNativeDriver: USE_NATIVE_DRIVER }).start();
  }, [text, op]);
  return <Animated.Text style={[style, { opacity: op }]}>{text}</Animated.Text>;
}

/* ------------------------------- hero pieces -------------------------------- */

function FloatingBubble({
  left,
  top,
  w,
  h,
  delay,
  duration,
  round,
}: {
  left: number;
  top: number;
  w: number;
  h: number;
  delay: number;
  duration: number;
  round: boolean;
}) {
  const v = useYoyo(duration, delay);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left,
        top,
        width: w,
        height: h,
        borderRadius: round ? h / 2 : 12,
        backgroundColor: 'rgba(255,255,255,0.13)',
        transform: [
          { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -20] }) },
          { rotate: v.interpolate({ inputRange: [0, 1], outputRange: ['-6deg', '6deg'] }) },
        ],
      }}
    />
  );
}

function PulseRing({ delay }: { delay: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, {
          toValue: 1,
          duration: 2000,
          easing: Easing.out(Easing.quad),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [v, delay]);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: 84,
        height: 84,
        borderRadius: 42,
        borderWidth: 2,
        borderColor: '#FFFFFF',
        opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
        transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.55] }) }],
      }}
    />
  );
}

function AnimatedLogo({ accent }: { accent: string }) {
  const pop = useRef(new Animated.Value(0)).current;
  const bob = useYoyo(1800);

  useEffect(() => {
    Animated.spring(pop, {
      toValue: 1,
      friction: 5,
      tension: 70,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [pop]);

  return (
    <Animated.View
      style={[
        styles.logoBox,
        { transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -7] }) }] },
      ]}
    >
      <PulseRing delay={0} />
      <PulseRing delay={900} />
      <Animated.View
        style={[
          styles.logo,
          {
            transform: [
              { scale: pop },
              { rotate: pop.interpolate({ inputRange: [0, 1], outputRange: ['-30deg', '0deg'] }) },
            ],
          },
        ]}
      >
        <Text style={[styles.logoText, { color: accent }]}>A</Text>
      </Animated.View>
    </Animated.View>
  );
}

/** Cycles through the feature lines with a fade + small slide. */
function TaglineCycler({ color }: { color: string }) {
  const [index, setIndex] = useState(0);
  const op = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    op.setValue(0);
    const seq = Animated.sequence([
      Animated.timing(op, { toValue: 1, duration: 350, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.delay(1700),
      Animated.timing(op, { toValue: 0, duration: 350, useNativeDriver: USE_NATIVE_DRIVER }),
    ]);
    seq.start(({ finished }) => {
      if (finished) setIndex((i) => (i + 1) % TAGLINES.length);
    });
    return () => seq.stop();
  }, [index, op]);

  return (
    <Animated.Text
      style={{
        height: 24,
        fontSize: 16,
        color,
        opacity: op,
        transform: [{ translateY: op.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
      }}
    >
      {TAGLINES[index]}
    </Animated.Text>
  );
}

/* ------------------------------ form pieces --------------------------------- */

/** Input whose border glows with the accent colour while focused. */
function Field({ theme, onFocus, onBlur, ...rest }: TextInputProps & { theme: Theme }) {
  const f = useRef(new Animated.Value(0)).current;
  const run = (to: number) =>
    Animated.timing(f, { toValue: to, duration: 180, useNativeDriver: false }).start();

  return (
    <Animated.View
      style={{
        borderWidth: 1.5,
        borderRadius: 12,
        marginBottom: 12,
        backgroundColor: theme.searchBg,
        borderColor: f.interpolate({ inputRange: [0, 1], outputRange: [theme.divider, theme.accent] }),
      }}
    >
      <TextInput
        {...rest}
        placeholderTextColor={theme.subText}
        onFocus={(e) => {
          run(1);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          run(0);
          onBlur?.(e);
        }}
        style={[styles.input, { color: theme.text }, webReset]}
      />
    </Animated.View>
  );
}

/** Button that squishes slightly when pressed. */
function ScaleButton({
  onPress,
  disabled,
  style,
  children,
}: {
  onPress: () => void;
  disabled?: boolean;
  style: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const s = useRef(new Animated.Value(1)).current;
  const to = (v: number) =>
    Animated.spring(s, { toValue: v, friction: 5, tension: 140, useNativeDriver: USE_NATIVE_DRIVER }).start();

  return (
    <Pressable onPress={onPress} disabled={disabled} onPressIn={() => to(0.96)} onPressOut={() => to(1)}>
      <Animated.View style={[style, { opacity: disabled ? 0.8 : 1, transform: [{ scale: s }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

/* --------------------------------- screen ----------------------------------- */

const BUBBLES = [
  { x: 0.06, y: 24, w: 56, h: 34, d: 0, t: 3200, r: false },
  { x: 0.78, y: 40, w: 44, h: 44, d: 400, t: 2800, r: true },
  { x: 0.2, y: 150, w: 30, h: 30, d: 800, t: 3600, r: true },
  { x: 0.7, y: 150, w: 64, h: 36, d: 200, t: 3000, r: false },
  { x: 0.44, y: 12, w: 26, h: 26, d: 600, t: 2600, r: true },
];

export function AuthScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const shake = useRef(new Animated.Value(0)).current;
  const modeAnim = useRef(new Animated.Value(0)).current; // 0 = sign in, 1 = sign up

  // Name field expands / collapses smoothly when switching modes.
  useEffect(() => {
    Animated.timing(modeAnim, {
      toValue: mode === 'signup' ? 1 : 0,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // height cannot run on the native driver
    }).start();
  }, [mode, modeAnim]);

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

  const google = async () => {
    setError(null);
    setInfo(null);
    setGoogleBusy(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      fail(e instanceof Error ? e.message : 'Google sign-in failed.');
    } finally {
      setGoogleBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.background }} behavior="padding">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ---------- animated hero ---------- */}
        <View style={[styles.hero, { backgroundColor: theme.header, paddingTop: insets.top + 36 }]}>
          {BUBBLES.map((b, i) => (
            <FloatingBubble
              key={i}
              left={b.x * width}
              top={b.y}
              w={b.w}
              h={b.h}
              delay={b.d}
              duration={b.t}
              round={b.r}
            />
          ))}

          <AnimatedLogo accent={theme.accent} />

          <Reveal delay={300} style={styles.heroTextBlock}>
            <Text style={styles.title}>AlphaChat</Text>
          </Reveal>
          <Reveal delay={450} style={styles.heroTextBlock}>
            <TaglineCycler color="#D1F4E8" />
          </Reveal>
        </View>

        {/* ---------- form ---------- */}
        <View style={[styles.form, { paddingBottom: insets.bottom + 24 }]}>
          <Reveal delay={550}>
            <FadeText
              text={mode === 'signin' ? 'Welcome back' : 'Create your account'}
              style={[styles.heading, { color: theme.text }]}
            />
          </Reveal>

          <Reveal delay={650}>
            <Animated.View style={{ transform: [{ translateX: shake }] }}>
              <Animated.View
                pointerEvents={mode === 'signup' ? 'auto' : 'none'}
                style={{
                  overflow: 'hidden',
                  opacity: modeAnim,
                  height: modeAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 64] }),
                }}
              >
                <Field
                  theme={theme}
                  placeholder="Your name"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="words"
                  editable={mode === 'signup'}
                />
              </Animated.View>
              <Field
                theme={theme}
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
              />
              <Field
                theme={theme}
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                onSubmitEditing={submit}
              />
            </Animated.View>
          </Reveal>

          {error ? <Text style={[styles.message, { color: theme.danger }]}>{error}</Text> : null}
          {info ? <Text style={[styles.message, { color: theme.accent }]}>{info}</Text> : null}

          <Reveal delay={780}>
            <ScaleButton
              onPress={submit}
              disabled={busy || googleBusy}
              style={[styles.button, { backgroundColor: theme.accent }]}
            >
              {busy ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>{mode === 'signin' ? 'Sign in' : 'Sign up'}</Text>
              )}
            </ScaleButton>
          </Reveal>

          <Reveal delay={840}>
            <View style={styles.orRow}>
              <View style={[styles.orLine, { backgroundColor: theme.divider }]} />
              <Text style={[styles.orText, { color: theme.subText }]}>or</Text>
              <View style={[styles.orLine, { backgroundColor: theme.divider }]} />
            </View>
            <ScaleButton
              onPress={google}
              disabled={googleBusy || busy}
              style={[styles.googleButton, { borderColor: theme.divider, backgroundColor: theme.searchBg }]}
            >
              {googleBusy ? (
                <ActivityIndicator color={theme.accent} />
              ) : (
                <Text style={[styles.googleText, { color: theme.text }]}>Continue with Google</Text>
              )}
            </ScaleButton>
          </Reveal>

          <Reveal delay={900}>
            <Pressable
              onPress={() => {
                setMode(mode === 'signin' ? 'signup' : 'signin');
                setError(null);
                setInfo(null);
              }}
              hitSlop={10}
            >
              <Text style={[styles.switch, { color: theme.accent }]}>
                {mode === 'signin' ? 'New here? Create an account' : 'Already have an account? Sign in'}
              </Text>
            </Pressable>
          </Reveal>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    paddingBottom: 40,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    overflow: 'hidden',
  },
  logoBox: { width: 110, height: 110, alignItems: 'center', justifyContent: 'center' },
  logo: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { fontSize: 44, fontWeight: '800' },
  heroTextBlock: { alignItems: 'center' },
  title: { color: '#FFFFFF', fontSize: 32, fontWeight: '800', marginTop: 10, marginBottom: 6 },
  form: { paddingHorizontal: 24, paddingTop: 28 },
  heading: { fontSize: 22, fontWeight: '700', marginBottom: 18 },
  input: { height: 50, paddingHorizontal: 16, fontSize: 16 },
  message: { fontSize: 14, textAlign: 'center', marginBottom: 12 },
  button: { height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  orRow: { flexDirection: 'row', alignItems: 'center', marginTop: 18, marginBottom: 14 },
  orLine: { flex: 1, height: 1 },
  orText: { marginHorizontal: 12, fontSize: 14 },
  googleButton: {
    height: 50,
    borderRadius: 25,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleText: { fontSize: 16, fontWeight: '600' },
  switch: { marginTop: 22, fontSize: 15, fontWeight: '600', textAlign: 'center' },
});