import { useEffect, useState } from 'react';
import { Platform, useColorScheme } from 'react-native';

export const USE_NATIVE_DRIVER = Platform.OS !== 'web';

export type Theme = {
  dark: boolean;
  header: string;
  headerText: string;
  headerSubText: string;
  background: string;
  chatBackground: string;
  text: string;
  subText: string;
  divider: string;
  accent: string;
  bubbleMine: string;
  bubbleTheirs: string;
  bubbleText: string;
  bubbleTime: string;
  tickRead: string;
  online: string;
  danger: string;
  inputBg: string;
  searchBg: string;
  pressed: string;
  chipBg: string;
  chipText: string;
};

const light: Theme = {
  dark: false,
  header: '#008069',
  headerText: '#FFFFFF',
  headerSubText: '#D1F4E8',
  background: '#FFFFFF',
  chatBackground: '#EFEAE2',
  text: '#111B21',
  subText: '#667781',
  divider: '#E9EDEF',
  accent: '#00A884',
  bubbleMine: '#D9FDD3',
  bubbleTheirs: '#FFFFFF',
  bubbleText: '#111B21',
  bubbleTime: '#667781',
  tickRead: '#53BDEB',
  online: '#25D366',
  danger: '#EA0038',
  inputBg: '#FFFFFF',
  searchBg: '#F0F2F5',
  pressed: '#F5F6F6',
  chipBg: '#FFFFFF',
  chipText: '#54656F',
};

const dark: Theme = {
  dark: true,
  header: '#202C33',
  headerText: '#E9EDEF',
  headerSubText: '#8696A0',
  background: '#111B21',
  chatBackground: '#0B141A',
  text: '#E9EDEF',
  subText: '#8696A0',
  divider: '#222D34',
  accent: '#00A884',
  bubbleMine: '#005C4B',
  bubbleTheirs: '#202C33',
  bubbleText: '#E9EDEF',
  bubbleTime: '#8696A0',
  tickRead: '#53BDEB',
  online: '#25D366',
  danger: '#F15C6D',
  inputBg: '#202C33',
  searchBg: '#202C33',
  pressed: '#182229',
  chipBg: '#182229',
  chipText: '#8696A0',
};

/* ----------------------- manual theme override (in memory) ----------------------- */

export type ThemeMode = 'system' | 'light' | 'dark';

let currentMode: ThemeMode = 'light';
const listeners = new Set<() => void>();

export function setThemeMode(next: ThemeMode) {
  currentMode = next;
  listeners.forEach((l) => l());
}

function useModeSubscription() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
}

/** Current mode ('system' | 'light' | 'dark') plus a setter. */
export function useThemeMode(): [ThemeMode, (m: ThemeMode) => void] {
  useModeSubscription();
  return [currentMode, setThemeMode];
}

export function useTheme(): Theme {
  const scheme = useColorScheme();
  useModeSubscription();
  const effective = currentMode === 'system' ? scheme : currentMode;
  return effective === 'dark' ? dark : light;
}