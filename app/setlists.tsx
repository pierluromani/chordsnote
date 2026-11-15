import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChevronRight, Plus } from '../components/icons';
import { Reveal } from '../components/Reveal';
import { TabBar, useTabBarHeight } from '../components/TabBar';
import { CatalogMark, DashedButton, Dot, EmptyState, Eyebrow, Tap } from '../components/ui';
import { useStore } from '../lib/store';
import { font, palette, radius } from '../lib/theme';
import { formatGigDate, formatTotal, type Setlist } from '../lib/types';

/**
 * Every setlist you have, newest gig first, grouped by the catalog it belongs
 * to. Dated sets sort ahead of undated ones — a rehearsal list matters less
 * than the thing you're playing on Friday.
 */
export default function SetlistsScreen() {
  const insets = useSafeAreaInsets();
  const tabHeight = useTabBarHeight();

  const setlists = useStore((state) => state.setlists);
  const catalogs = useStore((state) => state.catalogs);
  const songs = useStore((state) => state.songs);
  const createSetlist = useStore((state) => state.createSetlist);
  const ensurePersonalCatalog = useStore((state) => state.ensurePersonalCatalog);

  const sorted = useMemo(
    () =>
      [...setlists].sort((a, b) => {
        if (a.date && b.date) return a.date.localeCompare(b.date);
        if (a.date) return -1;
        if (b.date) return 1;
        return b.updatedAt - a.updatedAt;
      }),
    [setlists]
  );

  const durationOf = (setlist: Setlist) => {
    const total = setlist.items.reduce((sum, item) => {
      if (item.type !== 'song') return sum;
      return sum + (songs.find((song) => song.id === item.songId)?.duration ?? 0);
    }, 0);
    return total > 0 ? formatTotal(total) : null;
  };

  return (
    <View style={styles.screen}>
      <Reveal>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.title}>Scalette</Text>
        <Text style={styles.subtitle}>
          {setlists.length} {setlists.length === 1 ? 'scaletta' : 'scalette'} · da tutti i cataloghi
        </Text>
      </View>
      </Reveal>

      <Reveal delay={60} style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: 10,
          paddingHorizontal: 18,
          paddingBottom: tabHeight + 12,
          gap: 8,
        }}
        showsVerticalScrollIndicator={false}
      >
        {sorted.length === 0 ? (
          <EmptyState
            title="Nessuna scaletta"
            body="Crea la prima: scegli i brani, mettili in ordine e annota cosa succede tra uno e l’altro."
          />
        ) : null}

        {sorted.map((setlist) => {
          const catalog = catalogs.find((entry) => entry.id === setlist.catalogId);
          const count = setlist.items.filter((item) => item.type === 'song').length;
          const duration = durationOf(setlist);

          return (
            <Tap
              key={setlist.id}
              onPress={() => router.push(`/setlist/${setlist.id}`)}
              accessibilityRole="button"
              accessibilityLabel={setlist.name}
              style={styles.card}
            >
              {catalog ? (
                <CatalogMark name={catalog.name} color={catalog.color} kind={catalog.kind} />
              ) : null}

              <View style={{ flex: 1 }}>
                {formatGigDate(setlist.date) ? (
                  <Eyebrow color={palette.accent} style={styles.date}>
                    {formatGigDate(setlist.date)!}
                  </Eyebrow>
                ) : null}
                <Text style={styles.name} numberOfLines={1}>
                  {setlist.name}
                </Text>
                <View style={styles.metaRow}>
                  <Text style={styles.meta}>
                    {count} {count === 1 ? 'brano' : 'brani'}
                  </Text>
                  {duration ? (
                    <>
                      <Dot />
                      <Text style={styles.meta}>{duration}</Text>
                    </>
                  ) : null}
                </View>
              </View>

              <ChevronRight size={17} color={palette.textGhost} strokeWidth={1.6} />
            </Tap>
          );
        })}

        <DashedButton
          label="Nuova scaletta"
          icon={<Plus size={17} color={palette.textFaint} />}
          onPress={() => {
            const setlist = createSetlist({ catalogId: catalogs[0]?.id ?? ensurePersonalCatalog() });
            router.push(`/setlist/${setlist.id}`);
          }}
        />
      </ScrollView>
      </Reveal>

      <TabBar />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 4,
  },
  title: {
    fontFamily: font.display,
    fontSize: 25,
    letterSpacing: -0.5,
    color: palette.text,
  },
  subtitle: {
    fontFamily: font.meta,
    fontSize: 13,
    color: palette.textDim,
    marginTop: 4,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: palette.surface,
    borderRadius: radius.cardLg,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  date: {
    fontSize: 10,
    letterSpacing: 1.6,
    marginBottom: 3,
  },
  name: {
    fontFamily: font.displaySemi,
    fontSize: 16,
    color: palette.text,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 2,
  },
  meta: {
    fontFamily: font.meta,
    fontSize: 12,
    color: palette.textDim,
  },
});
