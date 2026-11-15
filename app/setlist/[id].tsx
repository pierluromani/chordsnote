import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ConfirmDialog } from '../../components/ConfirmDialog';
import { DateTimeSheet } from '../../components/DateTimeSheet';
import { DragRow, useDragReorder } from '../../components/DragList';
import { ChevronLeft, Ellipsis, Grip, Pencil, Play, Plus, Trash } from '../../components/icons';
import { Sheet, SheetRow } from '../../components/Sheet';
import { SongRow } from '../../components/SongList';
import {
  CircleButton,
  DashedButton,
  Dot,
  DynamicsNote,
  EmptyState,
  Eyebrow,
  FloatingBar,
  LinkAction,
  PillButton,
  PrimaryButton,
  Tap,
} from '../../components/ui';
import { formatChord } from '../../lib/chords';
import { goBack } from '../../lib/nav';
import { published, useCanEdit, useCatalog, useSetlist, useStore } from '../../lib/store';
import { font, palette, radius, shadow } from '../../lib/theme';
import {
  formatDuration,
  formatGigDate,
  formatTotal,
  type SetlistItem,
  type Song,
} from '../../lib/types';

/**
 * A setlist: the running order for one night, plus the practical notes that
 * make it playable. Notes live between the cards rather than inside them,
 * because they belong to the gap — the tuning change, the bit of talking.
 */

/** Vertical space between two rows, and part of one drag step. */
const ROW_GAP = 7;

export default function SetlistScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();

  const setlist = useSetlist(id);
  const catalog = useCatalog(setlist?.catalogId);
  const songs = useStore((state) => state.songs);
  const notation = useStore((state) => state.settings.notation);
  const updateSetlist = useStore((state) => state.updateSetlist);
  const addToSetlist = useStore((state) => state.addToSetlist);
  const updateSetlistItem = useStore((state) => state.updateSetlistItem);
  const removeSetlistItem = useStore((state) => state.removeSetlistItem);
  const reorderSetlistItem = useStore((state) => state.reorderSetlistItem);
  const deleteSetlist = useStore((state) => state.deleteSetlist);
  // A band's setlist is the thing most likely to be read by someone who
  // mustn't change it: it's on a stand, mid-set, in front of the whole line-up.
  const canEdit = useCanEdit(setlist?.catalogId);

  const [reordering, setReordering] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editingNote, setEditingNote] = useState<string | null>(null);

  // Dragging a row by its grip, live only while "Riordina" is on.
  const { drag, pan, heights, setHeight, startDrag, dragOver, dropDrag } = useDragReorder(
    (from, to) => {
      if (setlist) reorderSetlistItem(setlist.id, from, to);
    }
  );

  const byId = useMemo(() => new Map(songs.map((song) => [song.id, song])), [songs]);

  if (!setlist) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 40 }]}>
        <EmptyState
          title="Scaletta non trovata"
          body="Forse è stata eliminata."
          action={<PillButton label="Torna indietro" onPress={() => router.replace('/setlists')} />}
        />
      </View>
    );
  }

  const setSongs = setlist.items
    .filter((item): item is Extract<SetlistItem, { type: 'song' }> => item.type === 'song')
    .map((item) => byId.get(item.songId))
    .filter((song): song is Song => !!song);

  const total = setSongs.reduce((sum, song) => sum + (song.duration ?? 0), 0);
  const length = `${setSongs.length} ${setSongs.length === 1 ? 'brano' : 'brani'}${
    total ? ` · ${formatTotal(total)}` : ''
  }`;

  // Numbering counts songs only, so a note between two songs doesn't shift it.
  let songNumber = 0;

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <View style={styles.headerTop}>
          <CircleButton label="Indietro" onPress={() => goBack('/setlists')}>
            <ChevronLeft size={18} color={palette.text} />
          </CircleButton>
          <View style={{ flex: 1 }} />
          <PillButton label="Condividi" onPress={() => setMenuOpen(true)} />
          <CircleButton label="Opzioni scaletta" onPress={() => setMenuOpen(true)}>
            <Ellipsis size={18} color={palette.textMuted} />
          </CircleButton>
        </View>

        <Text style={styles.eyebrow}>
          {catalog ? `Scaletta · ${catalog.name}`.toUpperCase() : 'SCALETTA'}
        </Text>

        <TextInput
          value={setlist.name}
          onChangeText={(name) => updateSetlist(setlist.id, { name })}
          placeholder="Nome della scaletta"
          placeholderTextColor={palette.textGhost}
          editable={canEdit}
          style={styles.title}
        />

        <View style={styles.metaRow}>
          {canEdit ? (
            <Tap
              onPress={() => setDateOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={
                setlist.date ? 'Cambia quando si suona' : 'Segna quando si suona'
              }
              hitSlop={8}
            >
              <Text style={[styles.meta, !!setlist.date && styles.metaDate]}>
                {formatGigDate(setlist.date) ?? 'Aggiungi una data'}
              </Text>
            </Tap>
          ) : formatGigDate(setlist.date) ? (
            <Text style={styles.meta}>{formatGigDate(setlist.date)}</Text>
          ) : null}

          {canEdit || setlist.date ? <Dot /> : null}
          <Text style={styles.meta}>{length}</Text>
        </View>

        <View style={{ marginTop: 13 }}>
          <View style={styles.noteBlock}>
            <Pencil size={13} color={palette.dynamicsDim} />
            <TextInput
              value={setlist.note ?? ''}
              onChangeText={(note) => updateSetlist(setlist.id, { note: note || undefined })}
              placeholder="Soundcheck, cambi di palco, chi parla e quando…"
              placeholderTextColor={palette.textGhost}
              multiline
              editable={canEdit}
              style={styles.noteInput}
            />
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingTop: 12,
          paddingHorizontal: 18,
          paddingBottom: insets.bottom + 110,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={drag === null}
      >
        <View style={styles.orderHead}>
          <Eyebrow>Ordine</Eyebrow>
          {canEdit ? (
            <LinkAction
              label={reordering ? 'Fatto' : 'Riordina'}
              onPress={() => setReordering((value) => !value)}
            />
          ) : null}
        </View>

        <View style={{ gap: ROW_GAP }}>
          {setlist.items.map((item, index) => {
            if (item.type === 'note') {
              return (
                <DragRow
                  key={item.id}
                  index={index}
                  count={setlist.items.length}
                  enabled={reordering}
                  drag={drag}
                  pan={pan}
                  rowHeight={heights[index] ?? 0}
                  liftedStyle={styles.liftedNote}
                  onMeasure={(height) => setHeight(index, height + ROW_GAP)}
                  onStart={startDrag}
                  onOver={dragOver}
                  onDrop={dropDrag}
                >
                  {(gesture) => (
                    <View style={styles.noteRow}>
                      {reordering ? (
                        <GestureDetector gesture={gesture}>
                          <View accessibilityLabel="Trascina per spostare la nota" style={styles.handle}>
                            <Grip size={14} color={palette.textFaint} />
                          </View>
                        </GestureDetector>
                      ) : (
                        <Pencil size={12} color={palette.dynamicsDim} />
                      )}
                      {editingNote === item.id ? (
                        <TextInput
                          value={item.text}
                          onChangeText={(text) => updateSetlistItem(setlist.id, item.id, { text })}
                          onBlur={() => setEditingNote(null)}
                          autoFocus
                          style={styles.noteRowInput}
                        />
                      ) : (
                        <Tap
                          onPress={canEdit ? () => setEditingNote(item.id) : undefined}
                          disabled={!canEdit}
                          accessibilityRole={canEdit ? 'button' : undefined}
                          accessibilityLabel={`Nota: ${item.text}`}
                          style={{ flex: 1 }}
                        >
                          <DynamicsNote text={item.text} />
                        </Tap>
                      )}
                      {reordering ? (
                        <Tap
                          onPress={() => removeSetlistItem(setlist.id, item.id)}
                          accessibilityRole="button"
                          accessibilityLabel="Togli"
                          hitSlop={8}
                        >
                          <Trash size={15} color={palette.accent} />
                        </Tap>
                      ) : null}
                    </View>
                  )}
                </DragRow>
              );
            }

            const song = byId.get(item.songId);
            if (!song) return null;
            songNumber += 1;
            const number = songNumber;

            const songMeta = [
              formatChord(song.key, { notation }),
              song.bpm ? `${song.bpm} bpm` : null,
              formatDuration(song.duration),
            ]
              .filter(Boolean)
              .join(' · ');

            return (
              <DragRow
                key={item.id}
                index={index}
                count={setlist.items.length}
                enabled={reordering}
                drag={drag}
                pan={pan}
                rowHeight={heights[index] ?? 0}
                liftedStyle={styles.liftedSong}
                onMeasure={(height) => setHeight(index, height + ROW_GAP)}
                onStart={startDrag}
                onOver={dragOver}
                onDrop={dropDrag}
              >
                {(gesture) => (
                  <View style={styles.songRow}>
                    {reordering ? (
                      <GestureDetector gesture={gesture}>
                        <View accessibilityLabel="Trascina per spostare il brano" style={styles.handle}>
                          <Grip size={16} color={palette.textFaint} />
                        </View>
                      </GestureDetector>
                    ) : (
                      <Grip size={16} color={palette.textGhost} />
                    )}
                    <Text style={styles.number}>{number}</Text>

                    <Tap
                      // Enters the running order at this song rather than
                      // opening the chart on its own.
                      onPress={() =>
                        router.push({
                          pathname: '/song/[id]',
                          params: { id: song.id, setlist: setlist.id },
                        })
                      }
                      accessibilityRole="button"
                      accessibilityLabel={`${number}. ${song.title}, ${songMeta}`}
                      style={{ flex: 1 }}
                    >
                      <Text style={styles.songTitle} numberOfLines={1}>
                        {song.title}
                      </Text>
                      <Text style={styles.songMeta} numberOfLines={1}>
                        {songMeta}
                      </Text>
                    </Tap>

                    {reordering ? (
                      <Tap
                        onPress={() => removeSetlistItem(setlist.id, item.id)}
                        accessibilityRole="button"
                        accessibilityLabel="Togli"
                        hitSlop={8}
                      >
                        <Trash size={15} color={palette.accent} />
                      </Tap>
                    ) : null}
                  </View>
                )}
              </DragRow>
            );
          })}
        </View>

        {canEdit ? (
          <View style={{ gap: 8, marginTop: 12 }}>
            <DashedButton
              label="Aggiungi brano"
              compact
              icon={<Plus size={16} color={palette.textFaint} />}
              onPress={() => setPickerOpen(true)}
            />
            <DashedButton
              label="Aggiungi nota"
              compact
              icon={<Pencil size={15} color={palette.textFaint} />}
              onPress={() => {
                const item: SetlistItem = {
                  id: `${Date.now()}`,
                  type: 'note',
                  text: 'Nuova nota',
                };
                addToSetlist(setlist.id, item);
                setEditingNote(item.id);
              }}
            />
          </View>
        ) : (
          <Text style={styles.readOnly}>
            Questa scaletta è della band: puoi leggerla e suonarla, non modificarla.
          </Text>
        )}
      </ScrollView>

      <FloatingBar bottomInset={insets.bottom}>
        <PrimaryButton
          label="Avvia il set"
          icon={<Play size={15} color={palette.accentInk} />}
          disabled={setSongs.length === 0}
          onPress={() =>
            router.push({
              pathname: '/song/[id]',
              params: { id: setSongs[0].id, setlist: setlist.id },
            })
          }
        />
      </FloatingBar>

      <AddSongSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        catalogId={setlist.catalogId}
        notation={notation}
        onPick={(song) => {
          addToSetlist(setlist.id, { id: `${Date.now()}`, type: 'song', songId: song.id });
          setPickerOpen(false);
        }}
      />

      <Sheet visible={menuOpen} onClose={() => setMenuOpen(false)} title="Opzioni scaletta">
        <View style={styles.menu}>
          {canEdit ? (
            <>
              <SheetRow
                icon={<Pencil size={17} color={palette.accent} />}
                label={reordering ? 'Fine riordino' : 'Riordina i brani'}
                onPress={() => {
                  setReordering((value) => !value);
                  setMenuOpen(false);
                }}
              />
              <SheetRow
                icon={<Trash size={17} color={palette.accent} />}
                label="Elimina scaletta"
                danger
                last
                onPress={() => {
                  setMenuOpen(false);
                  setConfirmDelete(true);
                }}
              />
            </>
          ) : (
            <SheetRow
              icon={<Play size={17} color={palette.accent} />}
              label="Avvia il set"
              last
              onPress={() => {
                setMenuOpen(false);
                if (setSongs[0]) {
                  router.push({
                    pathname: '/song/[id]',
                    params: { id: setSongs[0].id, setlist: setlist.id },
                  });
                }
              }}
            />
          )}
        </View>
      </Sheet>

      <DateTimeSheet
        visible={dateOpen}
        onClose={() => setDateOpen(false)}
        title="Quando si suona"
        value={setlist.date}
        onChange={(date) => updateSetlist(setlist.id, { date })}
      />

      <ConfirmDialog
        visible={confirmDelete}
        title="Eliminare la scaletta?"
        message="La scaletta e gli appunti sul palco spariranno. Non si può annullare."
        confirmLabel="Elimina"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          deleteSetlist(setlist.id);
          router.replace('/setlists');
        }}
      />
    </View>
  );
}


function AddSongSheet({
  visible,
  onClose,
  catalogId,
  notation,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  catalogId: string;
  notation: 'anglo' | 'italiano';
  onPick: (song: Song) => void;
}) {
  const songs = useStore((state) => state.songs);
  // Drafts stay out of setlists: an unfinished song has no business on stage.
  const candidates = published(songs)
    .filter((song) => !catalogId || song.catalogId === catalogId)
    .sort((a, b) => a.title.localeCompare(b.title, 'it'));

  return (
    <Sheet visible={visible} onClose={onClose} title="Aggiungi brano">
      <View style={styles.pickList}>
        {candidates.map((song) => (
          <SongRow key={song.id} song={song} notation={notation} onPress={() => onPick(song)} />
        ))}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  eyebrow: {
    fontFamily: font.metaSemi,
    fontSize: 10,
    letterSpacing: 2,
    color: palette.accent,
  },
  title: {
    fontFamily: font.display,
    fontSize: 24,
    lineHeight: 29,
    letterSpacing: -0.48,
    color: palette.text,
    marginTop: 4,
    padding: 0,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginTop: 4,
  },
  meta: {
    fontFamily: font.meta,
    fontSize: 13,
    color: palette.textDim,
  },
  metaDate: {
    fontFamily: font.metaSemi,
    color: palette.accent,
  },
  noteBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: palette.surfaceRaised,
    borderRadius: radius.field,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  noteInput: {
    flex: 1,
    fontFamily: font.meta,
    fontSize: 12,
    lineHeight: 18,
    color: palette.dynamics,
    padding: 0,
  },
  orderHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 9,
  },
  songRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: palette.surface,
    borderRadius: radius.card,
    paddingVertical: 12,
    paddingHorizontal: 13,
  },
  number: {
    width: 16,
    fontFamily: font.monoSemi,
    fontSize: 14,
    color: palette.accent,
  },
  songTitle: {
    fontFamily: font.displaySemi,
    fontSize: 15,
    color: palette.text,
  },
  songMeta: {
    fontFamily: font.meta,
    fontSize: 11,
    color: palette.textDim,
    marginTop: 2,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  noteRowInput: {
    flex: 1,
    fontFamily: font.metaItalic,
    fontSize: 11.5,
    color: palette.dynamicsDim,
    padding: 0,
  },
  /** Widened well past the glyph — a 16 pt handle is not something to aim at. */
  handle: {
    paddingVertical: 6,
    paddingRight: 6,
    marginVertical: -6,
  },
  liftedSong: {
    zIndex: 20,
    borderRadius: radius.card,
    ...shadow.floating,
  },
  liftedNote: {
    zIndex: 20,
    borderRadius: radius.card,
    backgroundColor: palette.surface,
    ...shadow.floating,
  },
  menu: {
    backgroundColor: palette.surface,
    borderRadius: radius.cardLg,
    overflow: 'hidden',
  },
  readOnly: {
    fontFamily: font.meta,
    fontSize: 12,
    lineHeight: 17,
    color: palette.textFaint,
    marginTop: 16,
  },
  pickList: {
    backgroundColor: palette.surface,
    borderRadius: radius.cardLg,
    paddingHorizontal: 13,
  },
});
