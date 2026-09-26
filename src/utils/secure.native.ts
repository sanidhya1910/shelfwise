import * as SecureStore from 'expo-secure-store';

import type { SecureStore as Contract } from './secure';

/** Keychain / Android Keystore. The API key never lands in the SQLite file. */
export const secure: Contract = {
  async get(key) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async set(key, value) {
    await SecureStore.setItemAsync(key, value);
  },
  async remove(key) {
    await SecureStore.deleteItemAsync(key);
  },
};
