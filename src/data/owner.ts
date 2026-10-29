import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Which account the private data on this device belongs to, so a different account signing in
 * on a shared device never sees someone else's mood check-ins or notes.
 * Web keeps it in memory, like the web preview's data.
 */
const KEY = 'abbhelpme.owner.v1';
let memory: string | null = null;
const web = Platform.OS === 'web';

export async function getDeviceOwner(): Promise<string | null> {
  return web ? memory : SecureStore.getItemAsync(KEY);
}

export async function setDeviceOwner(accountId: string): Promise<void> {
  if (web) { memory = accountId; return; }
  await SecureStore.setItemAsync(KEY, accountId, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
}

export async function clearDeviceOwner(): Promise<void> {
  if (web) { memory = null; return; }
  await SecureStore.deleteItemAsync(KEY);
}
