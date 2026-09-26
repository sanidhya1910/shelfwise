import type { SecureStore as Contract } from './secure';

/**
 * The web build is a viewer and never calls the AI, so nothing should be stored
 * here. Kept as a no-op rather than localStorage so a key cannot leak into a
 * browser profile by accident.
 */
export const secure: Contract = {
  async get() {
    return null;
  },
  async set() {},
  async remove() {},
};
