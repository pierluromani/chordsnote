import { router, usePathname } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { font, palette } from '../lib/theme';
import { GENERAL_CATALOG } from '../lib/types';
import { Catalogs, Person, Search, Setlists, type IconProps } from './icons';
import { Tap } from './ui';

/**
 * The four places the app starts from. The handoff specifies a near-black
 * translucent bar here — a leftover from the dark explorations that the
 * screenshots contradict — so it's built on the warm ground the rest of the
 * "Palco" direction sits on, with the top hairline doing the separating.
 */

type Entry = {
  href: string;
  label: string;
  icon: (props: IconProps) => React.ReactNode;
};

const TABS: Entry[] = [
  { href: '/', label: 'Cataloghi', icon: Catalogs },
  { href: `/catalog/${GENERAL_CATALOG}`, label: 'Cerca', icon: Search },
  { href: '/setlists', label: 'Scalette', icon: Setlists },
  { href: '/profile', label: 'Profilo', icon: Person },
];

export function TabBar() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 14) + 16 }]}>
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        const color = active ? palette.accent : palette.textFainter;

        return (
          <Tap
            key={tab.href}
            onPress={() => {
              if (!active) router.replace(tab.href as never);
            }}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: active }}
            style={styles.tab}
          >
            {tab.icon({ size: 21, color, strokeWidth: active ? 2.4 : 1.9 })}
            <Text
              numberOfLines={1}
              style={[styles.label, { color }, active && { fontFamily: font.metaSemi }]}
            >
              {tab.label}
            </Text>
          </Tap>
        );
      })}
    </View>
  );
}

/** How much room the bar takes, for a scroll view's bottom padding. */
export function useTabBarHeight(): number {
  const insets = useSafeAreaInsets();
  return Math.max(insets.bottom, 14) + 16 + 48;
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    paddingTop: 10,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(250,248,246,0.94)',
    borderTopWidth: 1,
    borderTopColor: palette.borderCard,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
    paddingTop: 2,
  },
  label: {
    fontFamily: font.metaMid,
    fontSize: 10,
  },
});
