import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Calendar,
  Catalogs,
  Chat,
  ChevronLeft,
  ChevronRight,
  Plus,
  Setlists,
  Settings,
} from '../../../components/icons';
import {
  AvatarStack,
  CatalogMark,
  CircleButton,
  DashedButton,
  EmptyState,
  Eyebrow,
  PillButton,
  RoleChip,
  Tap,
} from '../../../components/ui';
import { useBandPulse } from '../../../lib/bandEvents';
import { goBack } from '../../../lib/nav';
import { catalogCounts, useBandRole, useCatalog, useStore } from '../../../lib/store';
import { font, palette, radius } from '../../../lib/theme';
import { formatGigDate, relativeDays } from '../../../lib/types';

/**
 * Una band aperta risponde a "cosa succede, e dov'è la roba": prima la data in
 * arrivo, poi le quattro porte — repertorio, scalette, bacheca, calendario.
 * Le impostazioni stanno dietro l'ingranaggio, un passo più in là, perché si
 * toccano una volta e poi mai più.
 */
export default function BandDashboard() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();

  const catalog = useCatalog(id);
  const role = useBandRole(id);
  const songs = useStore((state) => state.songs);
  const setlists = useStore((state) => state.setlists);

  const shared = !!catalog?.ownerUid;
  const { next, ahead, lastMessage, unread } = useBandPulse(catalog?.id, shared);

  if (!catalog) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 40 }]}>
        <EmptyState
          title="Band non trovata"
          body="Forse è stata eliminata."
          action={<PillButton label="Torna ai cataloghi" onPress={() => router.replace('/')} />}
        />
      </View>
    );
  }

  const counts = catalogCounts(catalog.id, songs, setlists);
  const dated = setlists.filter(
    (setlist) => setlist.catalogId === catalog.id && setlist.date
  ).length;

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <CircleButton label="Indietro" onPress={() => goBack('/')}>
          <ChevronLeft size={18} color={palette.text} />
        </CircleButton>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {catalog.name}
        </Text>
        {role ? (
          <CircleButton
            label="Gestione band"
            onPress={() => router.push(`/band/${catalog.id}/settings`)}
          >
            <Settings size={18} color={palette.text} />
          </CircleButton>
        ) : (
          <View style={{ width: 36 }} />
        )}
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 8,
          paddingBottom: insets.bottom + 40,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.identity}>
          <CatalogMark name={catalog.name} color={catalog.color} kind="band" />
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={2}>
              {catalog.name}
            </Text>
            <View style={styles.identityMeta}>
              {role ? <RoleChip role={role} /> : null}
              <Text style={styles.meta}>{`${catalog.members.length} in formazione`}</Text>
            </View>
          </View>
          {catalog.members.length > 0 ? <AvatarStack members={catalog.members} /> : null}
        </View>

        {/* ------------------------------------------------- Prossimo impegno */}

        {next ? (
          <>
            <Eyebrow color={palette.accent} style={styles.groupLabel}>
              {relativeDays(next.at)}
            </Eyebrow>
            <Tap
              onPress={() =>
                next.setlistId
                  ? router.push(`/setlist/${next.setlistId}`)
                  : router.push(`/band/${catalog.id}/calendar`)
              }
              accessibilityRole="button"
              accessibilityLabel={`${next.title}, ${formatGigDate(next.at) ?? ''}`}
              style={styles.next}
            >
              <Text style={styles.nextTitle} numberOfLines={2}>
                {next.title}
              </Text>
              <Text style={styles.meta} numberOfLines={1}>
                {[formatGigDate(next.at), next.place].filter(Boolean).join(' · ')}
              </Text>
              {next.setlistId ? (
                <View style={styles.nextLink}>
                  <Setlists size={15} color={palette.textMuted} strokeWidth={1.8} />
                  <Text style={styles.nextLinkText} numberOfLines={1}>
                    Apri la scaletta
                  </Text>
                  <ChevronRight size={15} color={palette.textGhost} strokeWidth={1.6} />
                </View>
              ) : null}
            </Tap>
          </>
        ) : (
          <>
            <Eyebrow style={styles.groupLabel}>Nessuna data in programma</Eyebrow>
            <DashedButton
              label="Segna una prova o un concerto"
              icon={<Plus size={17} color={palette.textFaint} />}
              onPress={() => router.push(`/band/${catalog.id}/calendar`)}
            />
          </>
        )}

        {/* ------------------------------------------------------- I riquadri */}

        <Eyebrow style={[styles.groupLabel, { marginTop: 22 }]}>La band</Eyebrow>
        <View style={styles.grid}>
          <Cell
            icon={<Catalogs size={19} color={palette.accent} strokeWidth={1.9} />}
            value={String(counts.songs)}
            label="Repertorio"
            sub={counts.songs === 1 ? 'brano' : 'brani'}
            onPress={() => router.push(`/catalog/${catalog.id}`)}
          />
          <Cell
            icon={<Setlists size={19} color={palette.accent} strokeWidth={1.9} />}
            value={String(counts.setlists)}
            label="Scalette"
            sub={dated > 0 ? `${dated} con una data` : 'nessuna con una data'}
            onPress={() => router.push('/setlists')}
          />
          <Cell
            icon={<Chat size={19} color={palette.accent} strokeWidth={1.9} />}
            badge={unread}
            label="Bacheca"
            sub={
              lastMessage
                ? `${lastMessage.name}: ${lastMessage.text}`
                : shared
                  ? 'Ancora nessun messaggio'
                  : 'Accedi per parlarne con la band'
            }
            onPress={shared ? () => router.push(`/chat/${catalog.id}`) : undefined}
          />
          <Cell
            icon={<Calendar size={19} color={palette.accent} strokeWidth={1.9} />}
            value={String(ahead.length)}
            label="Calendario"
            sub={ahead.length === 1 ? 'data in arrivo' : 'date in arrivo'}
            onPress={() => router.push(`/band/${catalog.id}/calendar`)}
          />
        </View>

        {/* ----------------------------------------------------- Informazioni */}

        {catalog.description?.trim() ? (
          <>
            <Eyebrow style={[styles.groupLabel, { marginTop: 22 }]}>Informazioni</Eyebrow>
            <Text style={styles.note}>{catalog.description.trim()}</Text>
          </>
        ) : null}

        {role ? (
          <DashedButton
            label="Gestisci la band"
            compact
            icon={<Settings size={16} color={palette.textFaint} />}
            onPress={() => router.push(`/band/${catalog.id}/settings`)}
          />
        ) : null}
      </ScrollView>
    </View>
  );
}

/** Un riquadro della griglia: un numero, o un pallino quando c'è da leggere. */
function Cell({
  icon,
  value,
  label,
  sub,
  badge,
  onPress,
}: {
  icon: React.ReactNode;
  value?: string;
  label: string;
  sub: string;
  badge?: number;
  onPress?: () => void;
}) {
  return (
    <Tap
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${value ?? ''} ${sub}`}
      style={styles.cell}
    >
      <View style={styles.cellHead}>
        {icon}
        {badge && badge > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : (
          <ChevronRight size={15} color={palette.textGhost} strokeWidth={1.6} />
        )}
      </View>
      {value ? <Text style={styles.cellValue}>{value}</Text> : null}
      <Text style={styles.cellLabel}>{label}</Text>
      <Text style={styles.cellSub} numberOfLines={2}>
        {sub}
      </Text>
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
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: font.displaySemi,
    fontSize: 14,
    color: palette.text,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 20,
  },
  name: {
    fontFamily: font.display,
    fontSize: 22,
    letterSpacing: -0.44,
    color: palette.text,
  },
  identityMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  meta: {
    fontFamily: font.meta,
    fontSize: 12,
    color: palette.textDim,
  },
  groupLabel: {
    marginBottom: 9,
  },
  next: {
    backgroundColor: palette.surface,
    borderRadius: radius.cardLg,
    borderLeftWidth: 3,
    borderLeftColor: palette.accent,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 3,
  },
  nextTitle: {
    fontFamily: font.displaySemi,
    fontSize: 17,
    letterSpacing: -0.2,
    color: palette.text,
  },
  nextLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 11,
    paddingTop: 11,
    borderTopWidth: 1,
    borderTopColor: palette.borderCard,
  },
  nextLinkText: {
    flex: 1,
    fontFamily: font.meta,
    fontSize: 13,
    color: palette.textMuted,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  cell: {
    // Due per riga: metà larghezza meno metà del gap.
    width: '48.5%',
    minHeight: 104,
    backgroundColor: palette.surface,
    borderRadius: radius.cardLg,
    paddingVertical: 14,
    paddingHorizontal: 15,
  },
  cellHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cellValue: {
    fontFamily: font.display,
    fontSize: 22,
    letterSpacing: -0.44,
    color: palette.text,
  },
  cellLabel: {
    fontFamily: font.displaySemi,
    fontSize: 13.5,
    color: palette.text,
  },
  cellSub: {
    fontFamily: font.meta,
    fontSize: 11.5,
    lineHeight: 16,
    color: palette.textDim,
    marginTop: 1,
  },
  badge: {
    minWidth: 19,
    height: 19,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: font.metaBold,
    fontSize: 11,
    color: palette.accentInk,
  },
  note: {
    fontFamily: font.meta,
    fontSize: 13,
    lineHeight: 20,
    color: palette.textSecondary,
    backgroundColor: palette.surfaceRaised,
    borderRadius: radius.card,
    paddingHorizontal: 15,
    paddingVertical: 13,
    marginBottom: 22,
  },
});
