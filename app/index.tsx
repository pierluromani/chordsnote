import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChevronRight, Note, Plus } from '../components/icons';
import { Reveal } from '../components/Reveal';
import { TabBar, useTabBarHeight } from '../components/TabBar';
import {
  Avatar,
  AvatarStack,
  CatalogMark,
  DashedButton,
  Eyebrow,
  Tap,
} from '../components/ui';
import { catalogCounts, countsLabel, published, useStore } from '../lib/store';
import { font, palette, radius } from '../lib/theme';
import { GENERAL_CATALOG, type Catalog } from '../lib/types';

/**
 * Home: the way into the general catalog, your own material, and the bands you
 * play with. Everything below the hero is a flat list of catalogs, because at
 * this level the only question is "whose songs am I looking for".
 */
export default function Home() {
  const insets = useSafeAreaInsets();
  const tabHeight = useTabBarHeight();

  const catalogs = useStore((state) => state.catalogs);
  const songs = useStore((state) => state.songs);
  const setlists = useStore((state) => state.setlists);
  const userName = useStore((state) => state.settings.userName);

  const personal = catalogs.filter((catalog) => catalog.kind === 'personal');
  const bands = catalogs.filter((catalog) => catalog.kind === 'band');

  const open = (id: string) => router.push(`/catalog/${id}`);

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.brand}>
          <View style={styles.logo}>
            <Note size={15} color={palette.accentInk} />
          </View>
          <Text style={styles.wordmark}>ChordsNote</Text>
        </View>

        <Tap
          onPress={() => router.replace('/profile')}
          accessibilityRole="button"
          accessibilityLabel="Profilo"
          hitSlop={8}
        >
          <Avatar name={userName} size={34} letters={2} ring={palette.borderControl} />
        </Tap>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingTop: 8, paddingHorizontal: 18, paddingBottom: tabHeight + 12 }}
        showsVerticalScrollIndicator={false}
      >
        <Reveal>
          <Hero count={published(songs).length} onOpen={() => open(GENERAL_CATALOG)} />
        </Reveal>

        <Reveal delay={40}>
        <Eyebrow style={styles.groupLabel}>I miei cataloghi</Eyebrow>
        <View style={styles.group}>
          {personal.map((catalog) => (
            <CatalogCard
              key={catalog.id}
              catalog={catalog}
              subtitle={countsLabel(catalogCounts(catalog.id, songs, setlists))}
              onPress={() => open(catalog.id)}
            />
          ))}

          <DashedButton
            label="Crea un nuovo catalogo"
            icon={<Plus size={17} color={palette.textFaint} />}
            onPress={() => router.push('/catalog/new')}
          />
        </View>
        </Reveal>

        <Reveal delay={80}>
        <Eyebrow style={styles.groupLabel}>{`Le tue band · ${bands.length}`}</Eyebrow>

        <View style={styles.group}>
          {bands.map((catalog) => (
            <CatalogCard
              key={catalog.id}
              catalog={catalog}
              subtitle={countsLabel(catalogCounts(catalog.id, songs, setlists))}
              onPress={() => open(catalog.id)}
            />
          ))}

          <DashedButton
            label="Crea una nuova band"
            icon={<Plus size={17} color={palette.textFaint} />}
            onPress={() => router.push('/band/new')}
          />
        </View>
        </Reveal>
      </ScrollView>

      <TabBar />
    </View>
  );
}

/** The general catalog: everything, from every catalog, in one place. */
function Hero({ count, onOpen }: { count: number; onOpen: () => void }) {
  return (
    <LinearGradient
      colors={[palette.accentDeep, palette.accentDeep2]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.hero}
    >
      {/* Decorative ring, cropped by the card's overflow. */}
      <View style={styles.heroRing} pointerEvents="none" />

      <Text style={styles.heroLabel}>Catalogo generale</Text>
      <Text style={styles.heroTitle}>Tutte le canzoni</Text>
      <Text style={styles.heroMeta}>
        {count} {count === 1 ? 'brano' : 'brani'} · da tutti i cataloghi
      </Text>

      <View style={styles.heroActions}>
        <Tap
          onPress={onOpen}
          accessibilityRole="button"
          accessibilityLabel="Apri il catalogo generale"
          style={styles.heroPrimary}
        >
          <Text style={styles.heroPrimaryText}>Apri</Text>
        </Tap>
      </View>
    </LinearGradient>
  );
}

function CatalogCard({
  catalog,
  subtitle,
  onPress,
}: {
  catalog: Catalog;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Tap
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${catalog.name}, ${subtitle}`}
      style={styles.card}
    >
      <CatalogMark name={catalog.name} color={catalog.color} kind={catalog.kind} />

      <View style={{ flex: 1 }}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {catalog.name}
        </Text>
        <Text style={styles.cardMeta} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>

      {catalog.kind === 'band' && catalog.members.length > 0 ? (
        <AvatarStack members={catalog.members} />
      ) : (
        <ChevronRight size={17} color={palette.textGhost} strokeWidth={1.6} />
      )}
    </Tap>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingBottom: 10,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  logo: {
    width: 26,
    height: 26,
    borderRadius: radius.logo,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: {
    fontFamily: font.display,
    fontSize: 17,
    color: palette.text,
  },
  hero: {
    borderRadius: radius.sheet,
    overflow: 'hidden',
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 18,
    marginBottom: 22,
  },
  heroRing: {
    position: 'absolute',
    right: -26,
    bottom: -30,
    width: 126,
    height: 126,
    borderRadius: 999,
    borderWidth: 22,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  heroLabel: {
    fontFamily: font.metaSemi,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: palette.onHeroLabel,
  },
  heroTitle: {
    fontFamily: font.display,
    fontSize: 24,
    letterSpacing: -0.48,
    color: palette.onHero,
    marginTop: 5,
    marginBottom: 3,
  },
  heroMeta: {
    fontFamily: font.meta,
    fontSize: 13,
    color: palette.onHeroDim,
  },
  heroActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  heroPrimary: {
    backgroundColor: palette.bg,
    paddingVertical: 9,
    paddingHorizontal: 15,
    borderRadius: radius.round,
  },
  heroPrimaryText: {
    fontFamily: font.display,
    fontSize: 13,
    color: palette.accent,
  },
  groupLabel: {
    marginBottom: 9,
  },
  groupHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 9,
  },
  group: {
    gap: 8,
    marginBottom: 22,
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
  cardTitle: {
    fontFamily: font.displaySemi,
    fontSize: 16,
    color: palette.text,
  },
  cardMeta: {
    fontFamily: font.meta,
    fontSize: 12,
    color: palette.textDim,
    marginTop: 1,
  },
});
