import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { parseDateOnly, type Item } from '@/domain/item';
import type { Settings } from '@/domain/settings';

import type { NotificationScheduler } from './scheduler';

const CHANNEL_ID = 'expiry-reminders';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let configured = false;

function copyFor(item: Item, leadDays: number): { title: string; body: string } {
  const what = item.brand ? `${item.brand} ${item.name}` : item.name;
  if (leadDays === 0) return { title: `${what} expires today`, body: 'Use it or freeze it while it still counts.' };
  if (leadDays === 1) return { title: `${what} expires tomorrow`, body: 'Worth planning into today or tomorrow.' };
  return { title: `${what} expires in ${leadDays} days`, body: `In your ${item.location}. Time to make a plan.` };
}

export const scheduler: NotificationScheduler = {
  supported: true,

  async configure() {
    if (configured) return;
    configured = true;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Expiry reminders',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 220, 120, 220],
        lightColor: '#2E9E5B',
      });
    }
  },

  async hasPermission() {
    const { granted } = await Notifications.getPermissionsAsync();
    return granted;
  },

  async requestPermission() {
    await this.configure();
    const existing = await Notifications.getPermissionsAsync();
    if (existing.granted) return true;
    const { granted } = await Notifications.requestPermissionsAsync();
    return granted;
  },

  async scheduleForItem(item: Item, settings: Settings) {
    if (item.status !== 'active' || settings.reminderLeadDays.length === 0) return [];
    if (!(await this.hasPermission())) return [];
    await this.configure();

    const expiry = parseDateOnly(item.expiryDate);
    const ids: string[] = [];

    for (const lead of settings.reminderLeadDays) {
      const when = new Date(expiry);
      when.setDate(when.getDate() - lead);
      when.setHours(settings.notificationHour, 0, 0, 0);
      // A reminder whose moment has passed is noise, not a reminder.
      if (when.getTime() <= Date.now()) continue;

      const { title, body } = copyFor(item, lead);
      const id = await Notifications.scheduleNotificationAsync({
        content: { title, body, data: { itemId: item.id } },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: when,
          channelId: CHANNEL_ID,
        },
      });
      ids.push(id);
    }
    return ids;
  },

  async cancel(ids: string[]) {
    await Promise.all(
      ids.map((id) =>
        // A stale id (already fired, or cleared by the OS) is not an error.
        Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined)
      )
    );
  },

  async sendTestNotification() {
    await this.configure();
    const when = new Date(Date.now() + 5000);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Reminders are working',
        body: 'This is what an expiry reminder will look like.',
        data: { test: true },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: when,
        channelId: CHANNEL_ID,
      },
    });
  },
};
