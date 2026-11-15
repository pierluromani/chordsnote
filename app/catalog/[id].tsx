import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Chat, ChevronLeft, Copy, Ellipsis, Export, Person, Plus, Trash } from '../../components/icons';
import { ImportSheet } from '../../components/ImportSong';
import { Reveal } from '../../components/Reveal';
import { Sheet, SheetRow } from '../../components/Sheet';
import { groupSongs, SongList } from '../../components/SongList';
import { SongMenu } from '../../components/SongMenu';
import { TabBar, useTabBarHeight } from '../../components/TabBar';
import {
  AvatarStack,
  Chip,
  CircleButton,
  DashedButton,
  Dot,
  EmptyState,
  FloatingBar,
  PillButton,
  PrimaryButton,
  SearchField,
  Tap,
} from '../../components/ui';
import { removeBand } from '../../lib/bandSync';
import type { ParsedSong } from '../../lib/chordpro';
import { goBack } from '../../lib/nav';
import { emailFiles, emailTextFiles } from '../../lib/pdfDelivery';
import { drafts, useBandRole, useCanEdit, useCatalog, useStore } from '../../lib/store';
import { font, palette, radius } from '../../lib/theme';
import { GENERAL_CATALOG, type Song } from '../../lib/types';

type Filter = 'songs' | 'setlists' | 'favorites' | 'drafts';

/**
 * A catalog opened up. The header carries identity and the tools that act on
 * the whole catalog; below it the list runs edge to edge with the A–Z index
 * pinned to the right, and a single floating action for the only thing you're
 * likely to want that isn't already on screen.
 */
export default function CatalogScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const tabHeight = useTabBarHeight();

  const general = id === GENERAL_CATALOG;
  const catalog = useCatalog(general ? undefined : id);
  const allSongs = useStore((state) => state.songs);
  const allSetlists = useStore((state) => state.setlists);
  const notation = useStore((state) => state.settings.notation);
  const createSong = useStore((state) => state.createSong);
  const ensurePersonalCatalog = useStore((state) => state.ensurePersonalCatalog);
  const toggleFavorite = useStore((state) => state.toggleFavorite);
  const deleteCatalog = useStore((state) => state.deleteCatalog);
  const duplicateSong = useStore((state) => state.duplicateSong);
  const deleteSong = useStore((state) => state.deleteSong);

  // In a shared band, a viewer gets the catalog without the tools that write
  // to it: nothing here refuses a tap, it simply isn't offered.
  const canEdit = useCanEdit(general ? undefined : id);
  const bandRole = useBandRole(general ? undefined : id);

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('songs');
  const [menuOpen, setMenuOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [songMenu, setSongMenu] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Picking songs to export rather than one to open: a separate mode so the
  // same list and the same taps can serve both without either getting in the
  // other's way.
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exportSheetOpen, setExportSheetOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<'pdf' | 'text'>('pdf');
  const [pdfWorking, setPdfWorking] = useState(false);
  const [pdfStatus, setPdfStatus] = useState<string | null>(null);
  const [pdfChords, setPdfChords] = useState(true);

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
    setExportSheetOpen(false);
    setPdfStatus(null);
    setExportFormat('pdf');
    setPdfChords(true);
  };

  const songs = useMemo(
    () => (general ? allSongs : allSongs.filter((song) => song.catalogId === id)),
    [allSongs, general, id]
  );
  const setlists = useMemo(
    () => (general ? allSetlists : allSetlists.filter((entry) => entry.catalogId === id)),
    [allSetlists, general, id]
  );

  const draftCount = useMemo(() => drafts(songs).length, [songs]);
  const songCount = songs.length - draftCount;

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return songs.filter((song) => {
      // Drafts live behind their own tab and nowhere else, so an unfinished
      // song can't surface in the repertoire you play from.
      if (filter === 'drafts' ? !song.draft : !!song.draft) return false;
      if (filter === 'favorites' && !song.favorite) return false;
      if (!needle) return true;
      return (
        song.title.toLowerCase().includes(needle) ||
        song.artist.toLowerCase().includes(needle)
      );
    });
  }, [songs, query, filter]);

  const groups = useMemo(() => groupSongs(visible), [visible]);
  /** Every real song in the catalog, tab and search box aside — what "tutto il catalogo" means. */
  const nonDraftSongs = useMemo(() => songs.filter((song) => !song.draft), [songs]);

  if (!general && !catalog) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 40 }]}>
        <EmptyState
          title="Catalogo non trovato"
          body="Forse è stato eliminato."
          action={<PillButton label="Torna alla home" onPress={() => router.replace('/')} />}
        />
      </View>
    );
  }

  const title = general ? 'Tutte le canzoni' : catalog!.name;
  const isBand = !general && catalog!.kind === 'band';

  const targetCatalogId = () => (general ? allSongs[0]?.catalogId ?? ensurePersonalCatalog() : id);

  const newSong = () => {
    const song = createSong({ catalogId: targetCatalogId() });
    router.push(`/song/${song.id}/edit`);
  };

  const importedSong = (imported: ParsedSong) => {
    const song = createSong({ ...imported, catalogId: targetCatalogId() });
    router.push(`/song/${song.id}/edit`);
  };

  const toggleSelect = (song: Song) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(song.id)) next.delete(song.id);
      else next.add(song.id);
      return next;
    });
  };

  const allSelected = visible.length > 0 && visible.every((song) => selectedIds.has(song.id));
  const selectAll = () =>
    setSelectedIds(allSelected ? new Set() : new Set(visible.map((song) => song.id)));

  /** One file per selected song — PDF or plain text — sent as mail attachments. */
  const exportSelected = async () => {
    const chosen = visible.filter((song) => selectedIds.has(song.id));
    if (chosen.length === 0) return;
    setPdfWorking(true);
    setPdfStatus(null);
    const result =
      exportFormat === 'pdf'
        ? await emailFiles(chosen, { notation, chords: pdfChords })
        : await emailTextFiles(chosen, { notation, chords: pdfChords });
    setPdfWorking(false);
    if (result) setPdfStatus(result);
    else exitSelectMode();
  };

  return (
    <View style={styles.screen}>
      <Reveal>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <View style={styles.headerTop}>
          <CircleButton label="Indietro" onPress={() => goBack('/')}>
            <ChevronLeft size={18} color={palette.text} />
          </CircleButton>

          <View style={{ flex: 1 }} />

          {selectMode ? (
            <>
              <Tap onPress={selectAll} accessibilityRole="button" hitSlop={8}>
                <Text style={styles.selectAction}>{allSelected ? 'Nessuno' : 'Tutti'}</Text>
              </Tap>
              <Tap onPress={exitSelectMode} accessibilityRole="button" hitSlop={8}>
                <Text style={styles.selectAction}>Annulla</Text>
              </Tap>
            </>
          ) : (
            <>
              <PillButton label="Esporta" onPress={() => setSelectMode(true)} />
              {isBand && catalog!.ownerUid ? (
                <CircleButton label="Apri la chat" onPress={() => router.push(`/chat/${id}`)}>
                  <Chat size={18} color={palette.textMuted} />
                </CircleButton>
              ) : null}
              <CircleButton label="Opzioni catalogo" onPress={() => setMenuOpen(true)}>
                <Ellipsis size={18} color={palette.textMuted} />
              </CircleButton>
            </>
          )}
        </View>

        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {isBand ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>BAND</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.meta}>
            {selectMode
              ? `${selectedIds.size} ${selectedIds.size === 1 ? 'selezionato' : 'selezionati'}`
              : `${songCount} ${songCount === 1 ? 'brano' : 'brani'}`}
          </Text>
          {!selectMode && isBand && catalog!.members.length > 0 ? (
            <>
              <Dot />
              <AvatarStack members={catalog!.members} size={21} ring={palette.bg} />
              <Dot />
              <Tap
                onPress={() => router.push(`/band/${id}`)}
                accessibilityRole="button"
                accessibilityLabel={
                  bandRole === 'owner' ? 'Invita nella band' : 'Vedi la formazione'
                }
                hitSlop={8}
              >
                <Text style={styles.invite}>
                  {bandRole === 'owner' ? 'Invita' : 'Formazione'}
                </Text>
              </Tap>
            </>
          ) : null}
        </View>

        <View style={{ marginTop: 14 }}>
          <SearchField value={query} onChangeText={setQuery} />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          <Chip label="Canzoni" active={filter === 'songs'} onPress={() => setFilter('songs')} />
          <Chip
            label={`Scalette · ${setlists.length}`}
            active={filter === 'setlists'}
            onPress={() => setFilter('setlists')}
          />
          <Chip
            label="Preferite"
            active={filter === 'favorites'}
            onPress={() => setFilter('favorites')}
          />
          {draftCount > 0 ? (
            <Chip
              label={`Bozze · ${draftCount}`}
              active={filter === 'drafts'}
              onPress={() => setFilter('drafts')}
            />
          ) : null}
        </ScrollView>
      </View>
      </Reveal>

      {filter === 'setlists' ? (
        <SetlistPane catalogId={general ? undefined : id} canEdit={canEdit} />
      ) : (
        <Reveal delay={60} style={{ flex: 1 }}>
        <SongList
          groups={groups}
          notation={notation}
          bottomPadding={
            (general ? tabHeight : insets.bottom) + (selectMode || canEdit ? 96 : 40)
          }
          onPressSong={(song: Song) => router.push(`/song/${song.id}`)}
          onLongPressSong={(song: Song) => setSongMenu(song.id)}
          onToggleFavorite={(song) => toggleFavorite(song.id)}
          onDeleteSong={canEdit ? (song) => deleteSong(song.id) : undefined}
          showIndex={query.trim() === '' && !selectMode}
          selectable={selectMode}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          ListEmptyComponent={
            <EmptyState
              title={
                query
                  ? 'Nessun risultato'
                  : filter === 'drafts'
                    ? 'Nessuna bozza'
                    : 'Il catalogo è vuoto'
              }
              body={
                query
                  ? 'Prova con un altro titolo o con il nome dell’artista.'
                  : filter === 'drafts'
                    ? 'Le bozze restano qui finché non le salvi nel catalogo.'
                    : 'Aggiungi il primo brano: scrivi il testo, poi tocca le lettere per posare gli accordi.'
              }
              action={
                query || filter === 'drafts' || !canEdit ? null : (
                  <PillButton
                    label="Aggiungi il primo brano"
                    tone="accent"
                    onPress={() => setImportOpen(true)}
                  />
                )
              }
            />
          }
        />
        </Reveal>
      )}

      {filter !== 'setlists' && selectMode && selectedIds.size > 0 ? (
        <FloatingBar bottomInset={general ? tabHeight : insets.bottom}>
          <PrimaryButton
            label={`Esporta · ${selectedIds.size}`}
            onPress={() => setExportSheetOpen(true)}
            style={{ alignSelf: 'stretch' }}
          />
        </FloatingBar>
      ) : null}

      {filter !== 'setlists' && !selectMode && canEdit ? (
        <FloatingBar bottomInset={general ? tabHeight : insets.bottom} align="end">
          <Tap
            onPress={() => setImportOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Nuovo brano"
            style={styles.fab}
          >
            <Plus size={17} color={palette.accentInk} strokeWidth={2.4} />
            <Text style={styles.fabText}>Nuovo brano</Text>
          </Tap>
        </FloatingBar>
      ) : null}

      {general ? <TabBar /> : null}

      <Sheet
        visible={exportSheetOpen}
        onClose={() => setExportSheetOpen(false)}
        title="Esporta"
        subtitle={`${selectedIds.size} ${selectedIds.size === 1 ? 'brano' : 'brani'}`}
      >
        <View style={styles.exportOptionRow}>
          <Chip label="Testo" active={exportFormat === 'text'} onPress={() => setExportFormat('text')} />
          <Chip label="PDF" active={exportFormat === 'pdf'} onPress={() => setExportFormat('pdf')} />
        </View>
        <View style={styles.exportOptionRow}>
          <Chip label="Con accordi" active={pdfChords} onPress={() => setPdfChords(true)} />
          <Chip label="Solo testo" active={!pdfChords} onPress={() => setPdfChords(false)} />
        </View>

        {pdfStatus ? <Text style={styles.pdfStatus}>{pdfStatus}</Text> : null}

        <PrimaryButton label="Esporta" onPress={exportSelected} disabled={pdfWorking} />
      </Sheet>

      <Sheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        title={general ? 'Opzioni' : `Opzioni · ${catalog!.name}`}
      >
        <View style={styles.menu}>
          {isBand ? (
            <SheetRow
              icon={<Person size={17} color={palette.accent} />}
              label={bandRole === 'owner' ? 'Gestisci la band' : 'La band'}
              value={`${catalog!.members.length} in formazione`}
              onPress={() => {
                setMenuOpen(false);
                router.push(`/band/${id}`);
              }}
            />
          ) : null}
          <SheetRow
            icon={<Export size={17} color={palette.accent} />}
            label="Esporta tutto il catalogo"
            last={!canEdit}
            onPress={() => {
              setMenuOpen(false);
              setQuery('');
              setFilter('songs');
              setSelectedIds(new Set(nonDraftSongs.map((song) => song.id)));
              setSelectMode(true);
            }}
          />
          {canEdit ? (
            <SheetRow
              icon={<Copy size={17} color={palette.accent} />}
              label="Duplica l’ultimo brano aperto"
              last={general || (isBand && bandRole !== 'owner')}
              onPress={() => {
                const first = visible[0];
                if (first) duplicateSong(first.id);
                setMenuOpen(false);
              }}
            />
          ) : null}
          {/* Deleting a band's catalog deletes the band for everyone in it, so
              it stays where the rest of that decision lives. */}
          {!general && (!isBand || bandRole === 'owner') ? (
            <SheetRow
              icon={<Trash size={17} color={palette.accent} />}
              label={isBand ? 'Elimina la band' : 'Elimina catalogo'}
              danger
              last
              onPress={() => {
                setMenuOpen(false);
                setConfirmDelete(true);
              }}
            />
          ) : null}
        </View>
      </Sheet>

      <ImportSheet
        visible={importOpen}
        onClose={() => setImportOpen(false)}
        onBlank={newSong}
        onImported={importedSong}
      />

      <SongMenu songId={songMenu} onClose={() => setSongMenu(null)} />

      <ConfirmDialog
        visible={confirmDelete}
        title={isBand ? 'Eliminare la band?' : 'Eliminare il catalogo?'}
        message={
          isBand
            ? 'Verranno eliminati anche i brani e le scalette, per tutti i membri. Non si può annullare.'
            : 'Il catalogo e i brani che contiene spariranno da questo dispositivo.'
        }
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          // Firestore first, and only then locally: once the catalog is gone
          // from the store the sync no longer knows this band is ours, and the
          // shared copy would come back at the next login.
          if (isBand && catalog!.ownerUid) {
            void removeBand(catalog!.id).catch(() => undefined);
          }
          deleteCatalog(id);
          router.replace('/');
        }}
      />
    </View>
  );
}

/** The setlists that belong to this catalog, behind the "Scalette" chip. */
function SetlistPane({ catalogId, canEdit }: { catalogId?: string; canEdit: boolean }) {
  const insets = useSafeAreaInsets();
  const setlists = useStore((state) => state.setlists);
  const createSetlist = useStore((state) => state.createSetlist);

  const visible = catalogId
    ? setlists.filter((setlist) => setlist.catalogId === catalogId)
    : setlists;

  return (
    <ScrollView
      contentContainerStyle={{
        paddingTop: 8,
        paddingHorizontal: 20,
        paddingBottom: insets.bottom + 40,
        gap: 8,
      }}
      showsVerticalScrollIndicator={false}
    >
      {visible.map((setlist) => (
        <Tap
          key={setlist.id}
          onPress={() => router.push(`/setlist/${setlist.id}`)}
          accessibilityRole="button"
          accessibilityLabel={setlist.name}
          style={styles.setlistRow}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.setlistName} numberOfLines={1}>
              {setlist.name}
            </Text>
            <Text style={styles.setlistMeta}>
              {setlist.items.filter((item) => item.type === 'song').length} brani
            </Text>
          </View>
        </Tap>
      ))}

      {canEdit ? (
        <DashedButton
          label="Nuova scaletta"
          compact
          icon={<Plus size={16} color={palette.textFaint} />}
          onPress={() => {
            const setlist = createSetlist({ catalogId: catalogId ?? '' });
            router.push(`/setlist/${setlist.id}`);
          }}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginTop: 14,
  },
  title: {
    flexShrink: 1,
    fontFamily: font.display,
    fontSize: 25,
    letterSpacing: -0.5,
    color: palette.text,
  },
  badge: {
    backgroundColor: palette.accent,
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  badgeText: {
    fontFamily: font.metaBold,
    fontSize: 9,
    letterSpacing: 0.9,
    color: palette.accentInk,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginTop: 6,
  },
  meta: {
    fontFamily: font.meta,
    fontSize: 13,
    color: palette.textDim,
  },
  invite: {
    fontFamily: font.metaSemi,
    fontSize: 13,
    color: palette.accent,
  },
  selectAction: {
    fontFamily: font.metaSemi,
    fontSize: 14,
    color: palette.accent,
    marginLeft: 16,
  },
  pdfStatus: {
    fontFamily: font.metaSemi,
    fontSize: 12.5,
    color: palette.accent,
  },
  exportOptionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  chips: {
    gap: 7,
    paddingRight: 20,
    marginTop: 11,
  },
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: palette.accent,
    paddingVertical: 13,
    paddingHorizontal: 19,
    borderRadius: radius.round,
    shadowColor: '#5A3A30',
    shadowOpacity: 0.24,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 9 },
    elevation: 10,
  },
  fabText: {
    fontFamily: font.display,
    fontSize: 14,
    color: palette.accentInk,
  },
  menu: {
    backgroundColor: palette.surface,
    borderRadius: radius.cardLg,
    overflow: 'hidden',
  },
  setlistRow: {
    backgroundColor: palette.surface,
    borderRadius: radius.card,
    paddingVertical: 12,
    paddingHorizontal: 13,
  },
  setlistName: {
    fontFamily: font.displaySemi,
    fontSize: 15,
    color: palette.text,
  },
  setlistMeta: {
    fontFamily: font.meta,
    fontSize: 11,
    color: palette.textDim,
    marginTop: 2,
  },
});
