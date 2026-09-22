/** Type contract; Metro swaps in `scheduler.native.ts` / `scheduler.web.ts`. */
import type { Item } from '@/domain/item';
import type { Settings } from '@/domain/settings';

export interface NotificationScheduler {
  configure(): Promise<void>;
  requestPermission(): Promise<boolean>;
  hasPermission(): Promise<boolean>;
  /** Returns the ids that were actually scheduled. */
  scheduleForItem(item: Item, settings: Settings): Promise<string[]>;
  cancel(ids: string[]): Promise<void>;
  /** Fires a notification a few seconds out so the user can verify it works. */
  sendTestNotification(): Promise<void>;
  readonly supported: boolean;
}

export const scheduler: NotificationScheduler = {
  supported: false,
  async configure() {},
  async requestPermission() {
    return false;
  },
  async hasPermission() {
    return false;
  },
  async scheduleForItem() {
    return [];
  },
  async cancel() {},
  async sendTestNotification() {},
};
