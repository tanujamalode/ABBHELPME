import { AppState, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Where the session (JWT access token + refresh token) is kept.
 * Native: the OS keystore, this device only, split into chunks because keystore values are size-limited.
 * Web: the browser's localStorage.
 */
const CHUNK = 1800;
const KEYSTORE_OPTS = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

async function removeItem(key: string) {
  const n = Number(await SecureStore.getItemAsync(`${key}.n`)) || 0;
  for (let i = 0; i < n; i++) await SecureStore.deleteItemAsync(`${key}.${i}`);
  await SecureStore.deleteItemAsync(`${key}.n`);
}

const keystore = {
  async getItem(key: string): Promise<string | null> {
    const n = Number(await SecureStore.getItemAsync(`${key}.n`)) || 0;
    if (!n) return null;
    const parts = await Promise.all(Array.from({ length: n }, (_, i) => SecureStore.getItemAsync(`${key}.${i}`)));
    return parts.every((p) => p !== null) ? parts.join('') : null;
  },
  async setItem(key: string, value: string) {
    await removeItem(key);
    const parts = value.match(new RegExp(`[\\s\\S]{1,${CHUNK}}`, 'g')) ?? [];
    for (let i = 0; i < parts.length; i++) await SecureStore.setItemAsync(`${key}.${i}`, parts[i], KEYSTORE_OPTS);
    await SecureStore.setItemAsync(`${key}.n`, String(parts.length), KEYSTORE_OPTS);
  },
  removeItem,
};

/** null when EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY are missing: the app then shows a setup screen. */
export const isBackendConfigured = !!(url && anonKey);

export const supabase: SupabaseClient | null = url && anonKey
  ? createClient(url, anonKey, {
    auth: {
      storage: Platform.OS === 'web' ? undefined : keystore,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  })
  : null;

// Refresh the JWT only while the app is in the foreground (recommended for React Native).
if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
