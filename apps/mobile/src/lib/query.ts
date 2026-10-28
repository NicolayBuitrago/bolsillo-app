import { createQueryClient } from '@bolsillo/api-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { focusManager, onlineManager } from '@tanstack/react-query';
import * as Network from 'expo-network';
import Storage from 'expo-sqlite/kv-store';
import { AppState } from 'react-native';
import { authClient } from './auth-client';

/** TanStack Query follows the device connectivity and app focus. */
onlineManager.setEventListener((setOnline) => {
  const subscription = Network.addNetworkStateListener((state) => {
    setOnline(state.isConnected !== false);
  });
  return () => subscription.remove();
});

focusManager.setEventListener((setFocused) => {
  const subscription = AppState.addEventListener('change', (status) => {
    setFocused(status === 'active');
  });
  return () => subscription.remove();
});

export const queryClient = createQueryClient({
  // The session expired on the server: drop the local one so the auth guard
  // sends the user to sign in.
  onUnauthenticated: () => {
    void authClient.signOut();
  },
});

/** Last known data, stored in SQLite so the app opens with it even offline. */
export const queryPersister = createSyncStoragePersister({
  key: 'bolsillo-query-cache',
  storage: {
    getItem: (key) => Storage.getItemSync(key),
    setItem: (key, value) => Storage.setItemSync(key, value),
    removeItem: (key) => {
      Storage.removeItemSync(key);
    },
  },
});

/** Clears cached data of the previous user (sign-out or sign-in as someone else). */
export function clearLocalData() {
  queryClient.clear();
  queryPersister.removeClient();
}
