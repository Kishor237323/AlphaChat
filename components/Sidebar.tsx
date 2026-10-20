import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useChat } from '../lib/ChatContext';
import { USE_NATIVE_DRIVER, useTheme, useThemeMode, type ThemeMode } from '../lib/theme';
import { Avatar } from './Avatar';

type Props = {
  visible: boolean;
  onClose: () => void;
  onOpenProfile: () => void;
};

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const MODES: { key: ThemeMode; label: string; icon: IconName }[] = [
  { key: 'light', label: 'Light', icon: 'sunny-outline' },
  { key: 'dark', label: 'Dark', icon: 'moon-outline' },
  { key: 'system', label: 'Auto', icon: 'phone-portrait-outline' },
];

function MenuItem({
  icon,
  label,
  onPress,
  color,
  textColor,
  pressedColor,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  color: string;
  textColor: string;
  pressedColor: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.item, pressed && { backgroundColor: pressedColor }]}
    >
      <Ionicons name={icon} size={22} color={color} />
      <Text style={[styles.itemLabel, { color: textColor }]}>{label}</Text>
    </Pressable>
  );
}

export function Sidebar({ visible, onClose, onOpenProfile }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { me, users, onlineIds, signOut } = useChat();
  const [mode, setMode] = useThemeMode();

  const drawerWidth = Math.min(320, width * 0.82);
  const progress = useRef(new Animated.Value(0)).current; // 0 closed, 1 open
  const [mounted, setMounted] = useState(visible);
  const [email, setEmail] = useState('');
  const [signingOut, setSigningOut] = useState(false);

  // Slide in / out.
  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(progress, {
        toValue: 1,
        duration: 250,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: USE_NATIVE_DRIVER,
      }).start();
    } else {
      Animated.timing(progress, {
        toValue: 0,
        duration: 200,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: USE_NATIVE_DRIVER,
      }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible, progress]);

  // Email lives in the auth session, not in the profiles table.
  useEffect(() => {
    let alive = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (alive) setEmail(data.session?.user.email ?? '');
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  // Android back button closes the drawer first.
  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, onClose]);

  if (!mounted) return null;

  const onlineCount = users.filter((u) => onlineIds.has(u.id)).length;

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* dimmed backdrop */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: progress }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* drawer */}
      <Animated.View
        style={[
          styles.drawer,
          {
            width: drawerWidth,
            backgroundColor: theme.background,
            transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-drawerWidth, 0] }) }],
          },
        ]}
      >
        {/* profile card */}
        <Pressable
          onPress={() => {
            onClose();
            onOpenProfile();
          }}
          style={[styles.profile, { backgroundColor: theme.header, paddingTop: insets.top + 24 }]}
        >
          <Avatar
            name={me?.username ?? '?'}
            size={72}
            online
            ringColor={theme.header}
            onlineColor={theme.online}
          />
          <Text numberOfLines={1} style={[styles.name, { color: theme.headerText }]}>
            {me?.username ?? ''}
          </Text>
          {email ? (
            <Text numberOfLines={1} style={[styles.email, { color: theme.headerSubText }]}>
              {email}
            </Text>
          ) : null}
          <View style={styles.editRow}>
            <Ionicons name="create-outline" size={14} color={theme.headerSubText} />
            <Text style={[styles.editText, { color: theme.headerSubText }]}>View and edit profile</Text>
          </View>
        </Pressable>

        <ScrollView contentContainerStyle={{ paddingVertical: 8 }}>
          <MenuItem
            icon="chatbubbles-outline"
            label="Chats"
            onPress={onClose}
            color={theme.subText}
            textColor={theme.text}
            pressedColor={theme.pressed}
          />
          <MenuItem
            icon="person-outline"
            label="My profile"
            onPress={() => {
              onClose();
              onOpenProfile();
            }}
            color={theme.subText}
            textColor={theme.text}
            pressedColor={theme.pressed}
          />

          <View style={styles.item}>
            <Ionicons name="people-outline" size={22} color={theme.subText} />
            <View style={{ marginLeft: 20, flex: 1 }}>
              <Text style={[styles.itemLabelPlain, { color: theme.text }]}>Contacts</Text>
              <Text style={{ color: theme.subText, fontSize: 12.5, marginTop: 2 }}>
                {users.length} {users.length === 1 ? 'person' : 'people'} · {onlineCount} online
              </Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.divider }]} />

          <Text style={[styles.section, { color: theme.subText }]}>APPEARANCE</Text>
          <View style={[styles.segment, { backgroundColor: theme.searchBg }]}>
            {MODES.map((m) => {
              const active = mode === m.key;
              return (
                <Pressable
                  key={m.key}
                  onPress={() => setMode(m.key)}
                  style={[styles.segmentBtn, active && { backgroundColor: theme.accent }]}
                >
                  <Ionicons name={m.icon} size={15} color={active ? '#FFFFFF' : theme.subText} />
                  <Text style={{ color: active ? '#FFFFFF' : theme.subText, fontSize: 13, fontWeight: '600', marginLeft: 5 }}>
                    {m.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        {/* footer */}
        <View style={[styles.footer, { borderTopColor: theme.divider, paddingBottom: insets.bottom + 10 }]}>
          <MenuItem
            icon="log-out-outline"
            label={signingOut ? 'Logging out…' : 'Log out'}
            onPress={() => void handleSignOut()}
            color={theme.danger}
            textColor={theme.danger}
            pressedColor={theme.pressed}
          />
          <Text style={[styles.version, { color: theme.subText }]}>AlphaChat · v1.0.0</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(0,0,0,0.5)' },
  drawer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 4, height: 0 },
    elevation: 16,
  },
  profile: { paddingHorizontal: 20, paddingBottom: 20 },
  name: { fontSize: 20, fontWeight: '700', marginTop: 14 },
  email: { fontSize: 13.5, marginTop: 3 },
  editRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  editText: { fontSize: 12.5, marginLeft: 5 },
  item: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 22, paddingVertical: 14 },
  itemLabel: { fontSize: 16, fontWeight: '500', marginLeft: 20 },
  itemLabelPlain: { fontSize: 16, fontWeight: '500' },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 8, marginHorizontal: 22 },
  section: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, marginHorizontal: 22, marginTop: 10, marginBottom: 10 },
  segment: { flexDirection: 'row', marginHorizontal: 18, borderRadius: 12, padding: 4 },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 9,
  },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 4 },
  version: { fontSize: 12, textAlign: 'center', marginTop: 4 },
});