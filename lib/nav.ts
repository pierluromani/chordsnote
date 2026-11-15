import { router } from 'expo-router';

/**
 * Back button that never dies. A direct or deep-linked visit leaves nothing
 * on the stack, so a bare `router.back()` silently does nothing there —
 * this falls back to replacing with a known-good destination instead.
 */
export function goBack(fallback: string = '/') {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace(fallback as never);
  }
}
