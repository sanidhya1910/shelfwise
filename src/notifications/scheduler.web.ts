import type { NotificationScheduler } from './scheduler';

/**
 * The web build is a viewer for an exported backup. Browsers cannot reliably
 * wake a closed tab to fire a scheduled reminder, so rather than pretend, web
 * reports itself unsupported and the UI says so plainly.
 *
 * This defines its own no-op rather than re-exporting from './scheduler':
 * Metro resolves that specifier back to *this* file on web, so a re-export
 * would make the module import itself and blow the stack on first access.
 */
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
