import { router } from 'expo-router';

/**
 * Goes back, or falls back to the dashboard.
 *
 * A screen reached by deep link or a notification tap has nothing behind it,
 * and calling `back()` there throws a "GO_BACK was not handled" warning and
 * strands the user on the screen they just finished with.
 */
export function goBack(): void {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}
