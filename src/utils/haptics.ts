import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Haptics are a no-op on web and must never throw — a failed buzz should not
 * interrupt the interaction that triggered it.
 */
const enabled = Platform.OS !== 'web';

function safely(run: () => Promise<unknown>) {
  if (!enabled) return;
  void run().catch(() => undefined);
}

export const haptics = {
  tap: () => safely(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  press: () => safely(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  thud: () => safely(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
  success: () => safely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () => safely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  error: () => safely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
  select: () => safely(() => Haptics.selectionAsync()),
};
