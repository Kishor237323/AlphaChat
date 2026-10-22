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
import { useConnections } from '../lib/connections';
import { USE_NATIVE_DRIVER, useTheme, useThemeMode, type ThemeMode } from '../lib/theme';
import { Avatar } from './Avatar';

type Props = {
  visible: boolean;
  onClose: () => void;
  onOpenProfile: () => void;
  onFindPeople: () => void;
  onOpenRequests: () => void;
  onOpenBlocked: () => void;
  onCreateGroup: () => void;
  onOpenGroupInvites: () => void;
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
  badge = 0,
  badgeColor,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  color: string;
  textColor: string;
  pressedColor: string;
  badge?: number;
  badgeColor?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={badge > 0 ? `${label}, ${badge} new` : label}
      style={({ pressed }) => [styles.item, pressed && { backgroundColor: pressedColor }]}
    >
      <Ionicons name={icon} size={22} color={color} />
      <Text style={[styles.itemLabel, { color: textColor }]}>{label}</Text>
      {badge > 0 ? (
        <View style={[styles.badge, { backgroundColor: badgeColor ?? color }]}>
          <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function Sidebar({
  visible,
  onClose,
  onOpenProfile,
  onFindPeople,
  onOpenRequests,
  onOpenBlocked,
  onCreateGroup,
  onOpenGroupInvites,
}: Props) {
  // All hooks live here, inside the component body, before any early return.
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { me, users, onlineIds, signOut } = useChat();
  const { incoming, byPeer } = useConnections();
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

  // Contacts are accepted connections only (pending requests are not contacts yet).
  let contactCount = 0;
  let onlineCount = 0;
  for (const u of users) {
    if (byPeer[u.id]?.status !== 'accepted') continue;
    contactCount += 1;
    if (onlineIds.has(u.id)) onlineCount += 1;
  }

  /** Close the drawer first, then run the action. */
  const go = (action: () => void) => () => {
    onClose();
    action();
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  };

  const itemColors = { color: theme.subText, textColor: theme.text, pressedColor: theme.pressed };

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* dimmed backdrop */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: progress }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close menu" />
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
          onPress={go(onOpenProfile)}
          style={[styles.profile, { backgroundColor: theme.header, paddingTop: insets.top + 24 }]}
        >
          <Avatar name={me?.username ?? '?'} size={72} online ringColor={theme.header} onlineColor={theme.online} />
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
          <MenuItem icon="chatbubbles-outline" label="Chats" onPress={onClose} {...itemColors} />
          <MenuItem icon="person-outline" label="My profile" onPress={go(onOpenProfile)} {...itemColors} />

          <View style={styles.item}>
            <Ionicons name="people-outline" size={22} color={theme.subText} />
            <View style={{ marginLeft: 20, flex: 1 }}>
              <Text style={[styles.itemLabelPlain, { color: theme.text }]}>Contacts</Text>
              <Text style={{ color: theme.subText, fontSize: 12.5, marginTop: 2 }}>
                {contactCount} {contactCount === 1 ? 'person' : 'people'} · {onlineCount} online
              </Text>
            </View>
          </View>

          <MenuItem icon="person-add-outline" label="Find people" onPress={go(onFindPeople)} {...itemColors} />
          <MenuItem icon="people-circle-outline" label="New group" onPress={go(onCreateGroup)} {...itemColors} />
          <MenuItem icon="mail-outline" label="Group invitations" onPress={go(onOpenGroupInvites)} {...itemColors} />
          <MenuItem
            icon="mail-unread-outline"
            label="Message requests"
            onPress={go(onOpenRequests)}
            badge={incoming.length}
            badgeColor={theme.accent}
            {...itemColors}
          />
          <MenuItem icon="ban-outline" label="Blocked users" onPress={go(onOpenBlocked)} {...itemColors} />

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
                  <Text
                    style={{ color: active ? '#FFFFFF' : theme.subText, fontSize: 13, fontWeight: '600', marginLeft: 5 }}
                  >
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
  itemLabel: { flex: 1, fontSize: 16, fontWeight: '500', marginLeft: 20 },
  itemLabelPlain: { fontSize: 16, fontWeight: '500' },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
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