/** Type contract; Metro swaps in the platform file. */
export interface SecureStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export const secure: SecureStore = {
  async get() {
    return null;
  },
  async set() {},
  async remove() {},
};
