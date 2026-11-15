import {
  HankenGrotesk_400Regular,
  HankenGrotesk_400Regular_Italic,
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
  HankenGrotesk_700Bold,
} from '@expo-google-fonts/hanken-grotesk';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_600SemiBold,
  JetBrainsMono_700Bold,
} from '@expo-google-fonts/jetbrains-mono';
import {
  Sora_400Regular,
  Sora_500Medium,
  Sora_600SemiBold,
  Sora_700Bold,
  Sora_800ExtraBold,
} from '@expo-google-fonts/sora';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo } from 'react';
import { Platform, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  SafeAreaInsetsContext,
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { useAuth } from '../lib/auth';
import { startBandContentSync, stopBandContentSync } from '../lib/bandContent';
import { subscribeBands, syncBands } from '../lib/bandSync';
import { startPersonalSync, stopPersonalSync } from '../lib/personalContent';
import { useStore } from '../lib/store';
import { palette } from '../lib/theme';
import { applyWebInputFixes } from '../lib/webFocusFix';

applyWebInputFixes();

/**
 * On web (both Safari and Home Screen PWA with `status-bar-style="default"`),
 * the viewport already starts below the iOS status bar. Zero out `insets.top`
 * on web so a cached `env(safe-area-inset-top)` never adds a second status-bar
 * height of empty space above screen headers.
 */
function WebSafeAreaFix({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();

  const value = useMemo(
    () => (Platform.OS === 'web' && insets.top !== 0 ? { ...insets, top: 0 } : insets),
    [insets]
  );

  return (
    <SafeAreaInsetsContext.Provider value={value}>{children}</SafeAreaInsetsContext.Provider>
  );
}

SplashScreen.preventAutoHideAsync().catch(() => {
  /* Already hidden — nothing to do. */
});

/**
 * While someone is signed in, everything they own stays live: their own
 * catalogs, songs and setlists on one side, and on the other the bands they
 * play in — the line-up and the roles come down from the account, and the
 * shared repertoires keep themselves in step. Signing out takes all of it
 * back down; both `stop…` calls deliberately forget what the server held, so
 * a signed-out session can't later mistake "can't see it" for "was deleted".
 */
function useAccountSession(hydrated: boolean) {
  const uid = useAuth((state) => state.account?.uid ?? null);

  useEffect(() => {
    if (!hydrated || !uid) {
      stopBandContentSync();
      stopPersonalSync();
      return;
    }

    // Before the first sync, never after: whatever another account left on
    // this device would otherwise be claimed by `syncBands` and pushed up
    // as if this account had written it.
    useStore.getState().adoptAccount(uid, useAuth.getState().account?.name ?? null);

    // Personal material answers to nobody else, so it needs no pull to settle
    // first — the initial snapshot is the pull.
    startPersonalSync();

    let cancelled = false;
    let stopBands: () => void = () => undefined;

    void syncBands()
      .catch(() => undefined)
      .then(() => {
        if (cancelled) return;
        stopBands = subscribeBands();
        startBandContentSync();
      });

    return () => {
      cancelled = true;
      stopBands();
      stopBandContentSync();
      stopPersonalSync();
    };
  }, [hydrated, uid]);
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Sora_400Regular,
    Sora_500Medium,
    Sora_600SemiBold,
    Sora_700Bold,
    Sora_800ExtraBold,
    HankenGrotesk_400Regular,
    HankenGrotesk_400Regular_Italic,
    HankenGrotesk_500Medium,
    HankenGrotesk_600SemiBold,
    HankenGrotesk_700Bold,
    JetBrainsMono_400Regular,
    JetBrainsMono_600SemiBold,
    JetBrainsMono_700Bold,
  });

  const hydrated = useStore((state) => state.hydrated);
  const authReady = useAuth((state) => state.ready);
  const signedIn = useAuth((state) => !!state.account);
  const ready = (fontsLoaded || !!fontError) && hydrated && authReady;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  useEffect(() => {
    applyWebInputFixes();
  }, []);

  useAccountSession(hydrated);

  if (!ready) return <View style={{ flex: 1, backgroundColor: palette.bg }} />;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <WebSafeAreaFix>
          <StatusBar style="dark" />
          {/*
            Going deeper slides in from the right; the three tabs cross-fade,
            since they sit beside each other rather than inside one another; and
            the editor comes up from the bottom, the way a thing you're going to
            work on does. Durations are short on purpose — long enough to show
            the direction you moved in, not long enough to wait for.
          */}
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: palette.bg },
              animation: 'slide_from_right',
              animationDuration: 260,
            }}
          >
            <Stack.Protected guard={!signedIn}>
              <Stack.Screen name="account" options={{ animation: 'slide_from_bottom' }} />
            </Stack.Protected>

            <Stack.Protected guard={signedIn}>
              <Stack.Screen name="index" options={{ animation: 'fade', animationDuration: 160 }} />
              <Stack.Screen name="setlists" options={{ animation: 'fade', animationDuration: 160 }} />
              <Stack.Screen name="profile" options={{ animation: 'fade', animationDuration: 160 }} />
              <Stack.Screen name="band/new" options={{ animation: 'slide_from_bottom' }} />
              <Stack.Screen name="band/[id]/index" />
              <Stack.Screen name="band/[id]/settings" />
              <Stack.Screen name="band/[id]/calendar" />
              <Stack.Screen name="chat/[id]" />
              <Stack.Screen name="catalog/[id]" />
              <Stack.Screen name="setlist/[id]" />
              <Stack.Screen name="song/[id]/index" options={{ animationDuration: 240 }} />
              <Stack.Screen
                name="song/[id]/edit"
                options={{ animation: 'slide_from_bottom', animationDuration: 280 }}
              />
              <Stack.Screen
                name="song/[id]/share"
                options={{ animation: 'slide_from_bottom', animationDuration: 280 }}
              />
            </Stack.Protected>
          </Stack>
        </WebSafeAreaFix>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
