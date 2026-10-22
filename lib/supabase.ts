import 'react-native-url-polyfill/auto';
import { AppState, Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import { authStorage } from './authStorage';

declare const process: { env: Record<string, string | undefined> };

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const configProblem: string | null = !url
  ? 'EXPO_PUBLIC_SUPABASE_URL is empty or missing (Expo did not load your .env)'
  : !/^https?:\/\//.test(url)
  ? `EXPO_PUBLIC_SUPABASE_URL must start with https:// but starts with "${url.slice(0, 10)}"`
  : anonKey.length < 20
  ? `EXPO_PUBLIC_SUPABASE_ANON_KEY is empty or too short (length ${anonKey.length})`
  : null;

export const isSupabaseConfigured = configProblem === null;

export const supabase = createClient(
  isSupabaseConfigured ? url : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? anonKey : 'placeholder-key',
  {
    auth: {
      storage: authStorage,
      autoRefreshToken: true,
      persistSession: true,
      // Web needs this to pick up the session after the Google redirect.
      // Native reads the tokens manually in lib/googleAuth.ts.
      detectSessionInUrl: Platform.OS === 'web',
    },
    realtime: { params: { eventsPerSecond: 10 } },
  }
);

// Only refresh the login token while the app is in the foreground.
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});