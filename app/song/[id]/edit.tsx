import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { GestureDetector, type PanGesture } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChordLine } from '../../../components/ChordLine';
import { ChordPicker } from '../../../components/ChordPicker';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { DragRow, useDragReorder } from '../../../components/DragList';
import { DurationSheet } from '../../../components/DurationSheet';
import { Check, Close, Copy, Ellipsis, Grip, Note, Plus, Trash } from '../../../components/icons';
import { Sheet, SheetRow } from '../../../components/Sheet';
import {
  Chip,
  DashedButton,
  DataField,
  EmptyState,
  PillButton,
  Tap,
} from '../../../components/ui';
import { sectionToChordProLines } from '../../../lib/chordpro';
import { formatChord, keyOptions, keyPrefersFlats, parseKey } from '../../../lib/chords';
import { goBack } from '../../../lib/nav';
import { inferSectionKind, sectionTitle } from '../../../lib/sections';
import { useCanEditSong, useSong, useStore } from '../../../lib/store';
import { font, palette, radius, sectionColors, shadow } from '../../../lib/theme';
import {
  formatDuration,
  type ChordAnchor,
  type Line,
  type Song,
} from '../../../lib/types';

type Mode = 'text' | 'chords' | 'structure' | 'dynamics';

const MODES: { value: Mode; label: string }[] = [
  { value: 'text', label: 'Testo' },
  { value: 'chords', label: 'Accordi' },
  { value: 'structure', label: 'Struttura' },
  { value: 'dynamics', label: 'Dinamica' },
];

/** Vertical space between two section cards, and part of one drag step. */
const CARD_GAP = 10;

/** What the chord picker is currently pointed at. */
type Target = {
  sectionId: string;
  lineId: string;
  pos: number;
  chordId?: string;
  initial?: string;
  context?: string;
};

/**
 * The editor. The page never changes shape between modes — the same stack of
 * section cards is always on screen — only what responds to a tap does. That's
 * what makes text, chords, structure and dynamics feel like four views of one
 * document rather than four different forms.
 */
export default function Editor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const song = useSong(id);
  const insets = useSafeAreaInsets();

  const canEdit = useCanEditSong(song);
  const updateSong = useStore((state) => state.updateSong);
  const publishSong = useStore((state) => state.publishSong);
  const deleteSong = useStore((state) => state.deleteSong);
  const addSection = useStore((state) => state.addSection);
  const settings = useStore((state) => state.settings);

  const [mode, setMode] = useState<Mode>('text');
  const [keyOpen, setKeyOpen] = useState(false);
  // What the picker acts on: a syllable, or a chord already placed on one.
  const [selected, setSelected] = useState<Target | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [exitOpen, setExitOpen] = useState(false);
  const [durationOpen, setDurationOpen] = useState(false);

  // Dragging a section by its grip, live only in "Struttura".
  const { drag, pan, heights, setHeight, startDrag, dragOver, dropDrag } = useDragReorder(
    (from, to) => {
      if (song) useStore.getState().reorderSections(song.id, from, to);
    }
  );

  // Snapshot taken on entry, so "Annulla" can put everything back.
  const original = useRef<Song | undefined>(song);

  /**
   * Chords already used in this song, the most used first. The picker leads
   * with the seven of the key, and adds these on the end: a slash chord or a
   * borrowed dominant that the song leans on is reached as fast as a I or a V,
   * instead of being dialled in on the wheels every single time.
   */
  const used = useMemo(() => {
    const counts = new Map<string, number>();
    for (const section of song?.sections ?? []) {
      for (const line of section.lines) {
        for (const chord of line.chords) {
          counts.set(chord.chord, (counts.get(chord.chord) ?? 0) + 1);
        }
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([chord]) => chord);
  }, [song?.sections]);

  if (!song) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 40 }]}>
        <EmptyState
          title="Canzone non trovata"
          body="Forse è stata eliminata dal catalogo."
          action={<PillButton label="Torna indietro" onPress={() => router.replace('/')} />}
        />
      </View>
    );
  }

  // Nothing normally routes here without the right, but a link or a back
  // button can, and losing the ability to edit mid-session is a real case:
  // being demoted while the editor is open lands exactly here.
  if (!canEdit) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 40 }]}>
        <EmptyState
          title="Solo lettura"
          body="In questa band puoi leggere il repertorio ma non modificarlo. Chiedi a chi l’ha fondata di promuoverti a editor."
          action={
            <PillButton label="Torna al brano" onPress={() => router.replace(`/song/${song.id}`)} />
          }
        />
      </View>
    );
  }

  const dirty = original.current ? original.current.updatedAt !== song.updatedAt : false;
  /**
   * A song that has never been saved into the catalog. Leaving one behind is a
   * decision either way, so backing out always asks — otherwise an abandoned
   * "Nuovo brano" would quietly pile up.
   */
  const unsaved = original.current?.draft ?? song.draft ?? false;

  const cancel = () => {
    if (!dirty && !unsaved) {
      goBack(`/song/${song.id}`);
      return;
    }
    setExitOpen(true);
  };

  /**
   * Saves into the catalog proper and opens the song. Replaced rather than
   * popped: the editor can be reached from a catalog or from a brand new
   * draft, and after saving there is only one place worth landing on — the
   * brano you just finished.
   */
  const save = () => {
    publishSong(song.id);
    router.replace(`/song/${song.id}` as never);
  };

  /**
   * Keeps the work without adding it to the repertoire. The edits are already
   * in the store, so this only has to make sure it stays flagged as a draft.
   */
  const keepAsDraft = () => {
    if (unsaved) updateSong(song.id, { draft: true });
    setExitOpen(false);
    goBack(unsaved ? '/' : `/song/${song.id}`);
  };

  /**
   * A draft that was never saved has nothing to go back to, so discarding it
   * removes it outright; an existing song is put back the way it was found.
   */
  const discardAndExit = () => {
    setExitOpen(false);
    if (unsaved) {
      const home = song.catalogId ? `/catalog/${song.catalogId}` : '/';
      deleteSong(song.id);
      // Replaced rather than popped: going back would land on the viewer of
      // the song we just deleted.
      router.replace(home as never);
      return;
    }
    if (original.current) updateSong(song.id, original.current);
    goBack(`/song/${song.id}`);
  };

  const savedAt = new Date(song.updatedAt);
  const savedLabel = `salvato ${savedAt.getHours()}:${String(savedAt.getMinutes()).padStart(2, '0')}`;

  const selectSyllable = (sectionId: string, lineId: string, text: string, pos: number) => {
    Haptics.selectionAsync().catch(() => {});
    setSelected({ sectionId, lineId, pos, context: wordAround(text, pos) });
    setPickerOpen(true);
  };

  const selectChord = (
    sectionId: string,
    lineId: string,
    text: string,
    chord: ChordAnchor
  ) => {
    Haptics.selectionAsync().catch(() => {});
    setSelected({
      sectionId,
      lineId,
      pos: chord.pos,
      chordId: chord.id,
      initial: chord.chord,
      context: wordAround(text, chord.pos),
    });
    setPickerOpen(true);
  };

  /**
   * Slides the selected chord to the previous or next syllable of its line.
   * Moving by syllable rather than by character is what keeps a chord landing
   * where it can actually be sung.
   */
  const moveSelected = (delta: -1 | 1) => {
    if (!selected?.chordId) return;
    const section = song.sections.find((entry) => entry.id === selected.sectionId);
    const line = section?.lines.find((entry) => entry.id === selected.lineId);
    if (!line) return;

    const stops = syllableStops(line);
    const index = stops.indexOf(selected.pos);
    const target = stops[(index === -1 ? 0 : index) + delta];
    if (target === undefined) return;

    useStore
      .getState()
      .moveChord(song.id, selected.sectionId, selected.lineId, selected.chordId, target);
    Haptics.selectionAsync().catch(() => {});
    setSelected({ ...selected, pos: target });
  };

  /** Writes a chord onto the current selection, replacing one if it's there. */
  const placeChord = (chord: string) => {
    if (!selected) return;
    const store = useStore.getState();
    if (selected.chordId) {
      store.updateChord(song.id, selected.sectionId, selected.lineId, selected.chordId, chord);
    } else {
      store.addChord(song.id, selected.sectionId, selected.lineId, selected.pos, chord);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}
    >
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <Tap onPress={cancel} accessibilityRole="button" hitSlop={10} style={{ minWidth: 64 }}>
          <Text style={styles.cancel}>Annulla</Text>
        </Tap>

        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.headerTitle}>{unsaved ? 'Bozza' : 'Modifica brano'}</Text>
          <Text style={styles.headerMeta}>{unsaved ? 'non ancora nel catalogo' : savedLabel}</Text>
        </View>

        <Tap
          onPress={save}
          accessibilityRole="button"
          accessibilityLabel={
            unsaved ? 'Salva il brano nel catalogo' : 'Salva e torna alla lettura'
          }
          style={styles.save}
        >
          <Text style={styles.saveText}>Salva</Text>
        </Tap>
      </View>

      <View style={styles.metaBlock}>
        <TextInput
          value={song.title}
          onChangeText={(title) => updateSong(song.id, { title })}
          placeholder="Titolo del brano"
          placeholderTextColor={palette.textGhost}
          style={styles.titleInput}
        />
        <TextInput
          value={song.artist}
          onChangeText={(artist) => updateSong(song.id, { artist })}
          placeholder="Artista"
          placeholderTextColor={palette.textGhost}
          style={styles.artistInput}
        />

        <View style={styles.dataRow}>
          <DataField
            label="Tonalità"
            value={formatChord(song.key, { notation: settings.notation })}
            suffix="orig."
            accent
            onPress={() => setKeyOpen(true)}
          />
          <DataField
            label="BPM"
            value={song.bpm ? String(song.bpm) : ''}
            keyboardType="number-pad"
            onChangeText={(text) =>
              updateSong(song.id, {
                bpm: text ? Number(text.replace(/\D/g, '')) || undefined : undefined,
              })
            }
          />
          <DataField
            label="Durata"
            value={formatDuration(song.duration) ?? '—'}
            onPress={() => setDurationOpen(true)}
          />
        </View>
      </View>

      <View style={styles.modes}>
        {MODES.map((entry) => (
          <Chip
            key={entry.value}
            label={entry.label}
            active={mode === entry.value}
            onPress={() => setMode(entry.value)}
          />
        ))}
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingTop: 4,
          paddingHorizontal: 18,
          // The chord toolbar used to hold the bottom of the page open; with
          // it gone the list has to clear the home indicator itself.
          paddingBottom: 16 + insets.bottom,
          gap: CARD_GAP,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        scrollEnabled={drag === null}
      >
        {song.sections.map((section, index) => (
          <DragRow
            key={section.id}
            index={index}
            count={song.sections.length}
            // The grip drags in every mode. Reordering is something you decide
            // while writing the words or placing the chords, not only while
            // looking at the running order, and having to change tab to act on
            // a thought you already had is the whole friction.
            enabled
            drag={drag}
            pan={pan}
            rowHeight={heights[index] ?? 0}
            liftedStyle={styles.lifted}
            onMeasure={(height) => setHeight(index, height + CARD_GAP)}
            onStart={startDrag}
            onOver={dragOver}
            onDrop={dropDrag}
          >
            {(gesture) => (
              <SectionCard
                song={song}
                sectionIndex={index}
                mode={mode}
                useFlats={keyPrefersFlats(song.key)}
                notation={settings.notation}
                activeChordId={selected?.chordId}
                dragGesture={gesture}
                onOpenMenu={() => setMenuFor(section.id)}
                onPressSyllable={(lineId, text, pos) =>
                  selectSyllable(section.id, lineId, text, pos)
                }
                onPressChord={(lineId, text, chord) =>
                  selectChord(section.id, lineId, text, chord)
                }
              />
            )}
          </DragRow>
        ))}

        <DashedButton
          label="Aggiungi sezione"
          compact
          icon={<Plus size={16} color={palette.textFaint} />}
          onPress={() => addSection(song.id, 'verse')}
        />

        {mode === 'structure' ? (
          <Text style={styles.hint}>
            Scrivi il nome della sezione, trascina i puntini a sinistra per spostarla, i tre
            puntini per duplicarla o eliminarla.
          </Text>
        ) : null}

        {mode === 'chords' ? (
          <Text style={styles.hint}>
            Tocca una sillaba per mettere un accordo, toccane uno per cambiarlo. Tieni premuto
            un accordo e trascinalo per spostarlo sulla sua riga. Tocca oltre l’ultima parola
            per un accordo che entra dopo il canto.
          </Text>
        ) : null}

        {mode === 'dynamics' ? (
          <Text style={styles.hint}>
            Scrivi una nota all’inizio della sezione oppure tocca qualsiasi riga per inserire una
            nota di dinamica in quel punto del brano.
          </Text>
        ) : null}
      </ScrollView>

      <KeySheet
        visible={keyOpen}
        onClose={() => setKeyOpen(false)}
        value={song.key}
        onChange={(key) => updateSong(song.id, { key })}
      />

      <DurationSheet
        visible={durationOpen}
        onClose={() => setDurationOpen(false)}
        seconds={song.duration}
        onChange={(duration) => updateSong(song.id, { duration })}
      />

      <SectionMenu
        songId={song.id}
        sectionId={menuFor}
        onClose={() => setMenuFor(null)}
        onDeleted={(deletedId) => {
          if (selected?.sectionId === deletedId) setSelected(null);
        }}
      />

      <ExitSheet
        visible={exitOpen}
        unsaved={unsaved}
        onClose={() => setExitOpen(false)}
        onKeep={keepAsDraft}
        onDiscard={discardAndExit}
      />

      <ChordPicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        songKey={song.key}
        notation={settings.notation}
        nashville={settings.nashville}
        songChords={used}
        initialChord={selected?.initial}
        context={selected?.context}
        onMove={selected?.chordId ? moveSelected : undefined}
        onSubmit={placeChord}
        onDelete={
          selected?.chordId
            ? () => {
                useStore
                  .getState()
                  .deleteChord(song.id, selected.sectionId, selected.lineId, selected.chordId!);
                setSelected(null);
              }
            : undefined
        }
      />
    </KeyboardAvoidingView>
  );
}

/* ------------------------------------------------------------------- Card */

/**
 * One section, shown through whichever mode is active. Each mode puts exactly
 * one thing on the card and hides the rest: writing words, placing chords,
 * ordering sections, noting dynamics. Nothing you cannot act on is on screen.
 */
function SectionCard({
  song,
  sectionIndex,
  mode,
  notation,
  useFlats,
  activeChordId,
  dragGesture,
  onOpenMenu,
  onPressSyllable,
  onPressChord,
}: {
  song: Song;
  sectionIndex: number;
  mode: Mode;
  notation: 'anglo' | 'italiano';
  useFlats: boolean;
  activeChordId?: string;
  /** The grip's drag gesture. */
  dragGesture?: PanGesture;
  onOpenMenu: () => void;
  onPressSyllable: (lineId: string, text: string, pos: number) => void;
  onPressChord: (lineId: string, text: string, chord: ChordAnchor) => void;
}) {
  const section = song.sections[sectionIndex];
  const setSectionText = useStore((state) => state.setSectionText);
  const updateSection = useStore((state) => state.updateSection);
  const setLineDynamics = useStore((state) => state.setLineDynamics);
  const addLine = useStore((state) => state.addLine);
  const deleteLine = useStore((state) => state.deleteLine);
  // Grows the field to fit its content, so the card resizes with it instead
  // of the text scrolling inside a fixed-height box.
  const [lyricsHeight, setLyricsHeight] = useState<number | undefined>(undefined);
  const [openDynamicsLineId, setOpenDynamicsLineId] = useState<string | null>(null);

  const hasLinesToDisplay =
    section.lines.length > 1 ||
    section.lines.some(
      (l) => l.text.trim() !== '' || l.chords.length > 0 || Boolean(l.dynamics)
    );

  const color = sectionColors[section.kind];
  const title = sectionTitle(section, song.sections);
  // The name is the one thing both the text and the structure tab let you
  // rename, because in both you're looking at the section as a whole.
  const renaming = mode === 'text' || mode === 'structure';

  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        {dragGesture ? (
          <GestureDetector gesture={dragGesture}>
            <View accessibilityLabel="Trascina per spostare la sezione" style={styles.handle}>
              <Grip size={16} color={palette.textFaint} />
            </View>
          </GestureDetector>
        ) : (
          <Grip size={16} color={palette.textGhost} />
        )}

        {renaming ? (
          <TextInput
            value={section.label ?? ''}
            onChangeText={(label) => {
              // No type picker anymore — the colour has to keep tracking what
              // the section actually is, so a recognisable name ("Ritornello
              // 2", "Bridge") still repaints it, while a name that doesn't
              // match anything just leaves the last colour alone.
              const inferred = inferSectionKind(label);
              updateSection(song.id, section.id, {
                label: label.trim() ? label : undefined,
                ...(inferred ? { kind: inferred } : null),
              });
            }}
            placeholder={title.toUpperCase()}
            placeholderTextColor={`${color}70`}
            autoCapitalize="characters"
            autoCorrect={false}
            accessibilityLabel="Nome della sezione"
            style={[styles.nameInput, { color }]}
          />
        ) : (
          <>
            <Text style={[styles.cardLabel, { color }]}>{title.toUpperCase()}</Text>
            <View style={{ flex: 1 }} />
          </>
        )}

        <Tap
          onPress={onOpenMenu}
          accessibilityRole="button"
          accessibilityLabel="Opzioni sezione"
          hitSlop={10}
          style={{ marginLeft: 10 }}
        >
          <Ellipsis size={16} color={palette.textFainter} />
        </Tap>
      </View>

      {/* Dinamica — all'inizio della sezione o dopo qualsiasi riga */}
      {mode === 'dynamics' ? (
        <View style={{ gap: 8 }}>
          <View style={styles.dynamicsField}>
            <View style={{ marginTop: 2 }}>
              <Note size={13} color={palette.dynamicsDim} />
            </View>
            <TextInput
              value={section.dynamics ?? ''}
              onChangeText={(dynamics) =>
                updateSection(song.id, section.id, { dynamics: dynamics || undefined })
              }
              placeholder="Inizio sezione · es. carica · entra batteria"
              placeholderTextColor={palette.textGhost}
              multiline
              style={styles.dynamicsInput}
            />
            {section.dynamics ? (
              <Tap
                onPress={() => updateSection(song.id, section.id, { dynamics: undefined })}
                accessibilityRole="button"
                accessibilityLabel="Rimuovi nota dinamica iniziale"
                hitSlop={10}
                style={{ marginTop: 2 }}
              >
                <Close size={12} color={palette.textFainter} />
              </Tap>
            ) : null}
          </View>

          {hasLinesToDisplay
            ? section.lines.map((line) => {
                const isOpen = Boolean(line.dynamics) || openDynamicsLineId === line.id;
                const sortedChords = [...line.chords].sort((a, b) => a.pos - b.pos);
                const chordSummary = sortedChords
                  .map((c) => formatChord(c.chord, { notation, useFlats }))
                  .join('   ');

                return (
                  <View key={line.id} style={styles.dynamicsLineBlock}>
                    <Tap
                      onPress={() => setOpenDynamicsLineId(line.id)}
                      accessibilityRole="button"
                      accessibilityLabel="Inserisci nota di dinamica dopo questa riga"
                      style={styles.dynamicsLineRow}
                    >
                      <View style={{ flex: 1 }}>
                        {line.text.trim() ? (
                          <Text style={styles.dynamicsLineText} numberOfLines={2}>
                            {line.text}
                          </Text>
                        ) : chordSummary ? (
                          <Text style={styles.dynamicsLineChords} numberOfLines={1}>
                            {chordSummary}
                          </Text>
                        ) : (
                          <Text style={styles.dynamicsLineEmpty}>— riga strumentale —</Text>
                        )}
                      </View>

                      {!isOpen ? (
                        <View style={styles.dynamicsAddBadge}>
                          <Plus size={10} color={palette.dynamicsDim} />
                          <Text style={styles.dynamicsAddText}>nota</Text>
                        </View>
                      ) : null}
                    </Tap>

                    {isOpen ? (
                      <View style={styles.dynamicsField}>
                        <View style={{ marginTop: 2 }}>
                          <Note size={13} color={palette.dynamicsDim} />
                        </View>
                        <TextInput
                          value={line.dynamics ?? ''}
                          onChangeText={(dynamics) =>
                            setLineDynamics(song.id, section.id, line.id, dynamics)
                          }
                          onBlur={() => {
                            if (!line.dynamics?.trim()) {
                              setOpenDynamicsLineId((prev) => (prev === line.id ? null : prev));
                            }
                          }}
                          autoFocus={openDynamicsLineId === line.id && !line.dynamics}
                          placeholder="Nota dinamica qui (es. entra batteria, crescendo)…"
                          placeholderTextColor={palette.textGhost}
                          multiline
                          style={styles.dynamicsInput}
                        />
                        <Tap
                          onPress={() => {
                            setLineDynamics(song.id, section.id, line.id, undefined);
                            setOpenDynamicsLineId((prev) => (prev === line.id ? null : prev));
                          }}
                          accessibilityRole="button"
                          accessibilityLabel="Rimuovi nota dinamica"
                          hitSlop={10}
                          style={{ marginTop: 2 }}
                        >
                          <Close size={12} color={palette.textFainter} />
                        </Tap>
                      </View>
                    ) : null}
                  </View>
                );
              })
            : null}
        </View>
      ) : null}

      {/* Testo — the whole section as one block. One line of text per verse;
          leave a line empty to make it a bar of chords only. */}
      {mode === 'text' ? (
        <TextInput
          value={section.lines.map((line) => line.text).join('\n')}
          onChangeText={(text) => setSectionText(song.id, section.id, text)}
          multiline
          placeholder="Scrivi qui il testo della sezione…"
          placeholderTextColor={palette.textGhost}
          textAlignVertical="top"
          scrollEnabled={false}
          onContentSizeChange={(event) =>
            setLyricsHeight(event.nativeEvent.contentSize.height)
          }
          style={[styles.lyricsInput, lyricsHeight ? { height: lyricsHeight } : null]}
        />
      ) : null}

      {/* Accordi — tap a syllable to place one, tap a chord to change it,
          hold a chord to drag it somewhere else on its line. */}
      {mode === 'chords' ? (
        <View style={{ gap: 6 }}>
          {section.lines.map((line) => (
            <View key={line.id} style={styles.chordRow}>
              <View style={{ flex: 1 }}>
                <ChordLine
                  line={line}
                  variant="editor"
                  notation={notation}
                  semitones={0}
                  useFlats={useFlats}
                  editing
                  activeChordId={activeChordId}
                  onPressSyllable={(pos) => onPressSyllable(line.id, line.text, pos)}
                  onPressChord={(chord) => onPressChord(line.id, line.text, chord)}
                  onDragChord={(chord, pos) =>
                    useStore
                      .getState()
                      .moveChord(song.id, section.id, line.id, chord.id, pos)
                  }
                  onDragRank={(from, to) =>
                    useStore.getState().reorderChords(song.id, section.id, line.id, from, to)
                  }
                />
              </View>

              {/* Only on a line with no words: one added by mistake here would
                  otherwise have to be hunted down in the text tab. */}
              {!line.text.trim() && section.lines.length > 1 ? (
                <Tap
                  onPress={() => deleteLine(song.id, section.id, line.id)}
                  accessibilityRole="button"
                  accessibilityLabel="Elimina la riga"
                  hitSlop={10}
                  style={styles.lineRemove}
                >
                  <Close size={12} color={palette.textFainter} />
                </Tap>
              ) : null}
            </View>
          ))}

          {/* A section with no words has no way to grow a line from the text
              field — an empty line is invisible to it — so it gets one here. */}
          <Tap
            onPress={() => addLine(song.id, section.id)}
            accessibilityRole="button"
            accessibilityLabel="Aggiungi una riga alla sezione"
            style={styles.lineAdd}
          >
            <Plus size={12} color={palette.textFaint} />
            <Text style={styles.lineAddText}>Riga</Text>
          </Tap>
        </View>
      ) : null}
    </View>
  );
}

/**
 * Asked when backing out of the editor. What the two ways out mean depends on
 * whether the song is already in the catalog: a draft can be parked or thrown
 * away whole, while a song that's already there can only keep or undo the
 * edits — it must never disappear out of the repertoire by accident.
 */
function ExitSheet({
  visible,
  unsaved,
  onClose,
  onKeep,
  onDiscard,
}: {
  visible: boolean;
  unsaved: boolean;
  onClose: () => void;
  onKeep: () => void;
  onDiscard: () => void;
}) {
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={unsaved ? 'Uscire senza salvare?' : 'Uscire dalla modifica?'}
      subtitle={
        unsaved
          ? 'Il brano non è ancora nel catalogo.'
          : 'Hai delle modifiche non salvate.'
      }
    >
      <View style={styles.menu}>
        <SheetRow
          icon={<Check size={17} color={palette.accent} />}
          label={unsaved ? 'Tieni fra le bozze' : 'Mantieni le modifiche'}
          value={unsaved ? 'non va nel catalogo' : undefined}
          onPress={onKeep}
        />
        <SheetRow
          icon={<Trash size={17} color={palette.accent} />}
          label={unsaved ? 'Elimina la bozza' : 'Scarta le modifiche'}
          danger
          last
          onPress={onDiscard}
        />
      </View>
    </Sheet>
  );
}

function SectionMenu({
  songId,
  sectionId,
  onClose,
  onDeleted,
}: {
  songId: string;
  sectionId: string | null;
  onClose: () => void;
  onDeleted?: (sectionId: string) => void;
}) {
  const duplicateSection = useStore((state) => state.duplicateSection);
  const deleteSection = useStore((state) => state.deleteSection);
  const notation = useStore((state) => state.settings.notation);
  const song = useSong(songId);
  const section = song?.sections.find((entry) => entry.id === sectionId);

  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  return (
    <>
      <Sheet
        visible={sectionId !== null}
        onClose={onClose}
        title={section && song ? sectionTitle(section, song.sections) : 'Sezione'}
      >
        <View style={styles.menu}>
          <SheetRow
            icon={<Copy size={17} color={palette.accent} />}
            label="Duplica sezione"
            onPress={() => {
              if (sectionId) duplicateSection(songId, sectionId);
              onClose();
            }}
          />
          <SheetRow
            icon={<Copy size={17} color={palette.accent} />}
            label="Copia testo e accordi"
            value="negli appunti"
            onPress={() => {
              if (song && section) {
                const text = sectionToChordProLines(song, section, { notation });
                void Clipboard.setStringAsync(text);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              }
              onClose();
            }}
          />
          <SheetRow
            icon={<Trash size={17} color={palette.accent} />}
            label="Elimina sezione"
            danger
            last
            onPress={() => {
              const target = sectionId;
              onClose();
              if (target) setConfirmingId(target);
            }}
          />
        </View>
      </Sheet>

      <ConfirmDialog
        visible={confirmingId !== null}
        title="Eliminare la sezione?"
        message="Il testo e gli accordi di questa sezione spariranno dal brano. Non si può annullare."
        confirmLabel="Elimina"
        onCancel={() => setConfirmingId(null)}
        onConfirm={() => {
          const target = confirmingId;
          setConfirmingId(null);
          if (target) {
            deleteSection(songId, target);
            onDeleted?.(target);
          }
        }}
      />
    </>
  );
}

function KeySheet({
  visible,
  onClose,
  value,
  onChange,
}: {
  visible: boolean;
  onClose: () => void;
  value: string;
  onChange: (key: string) => void;
}) {
  const notation = useStore((state) => state.settings.notation);
  const minor = parseKey(value).minor;

  return (
    <Sheet visible={visible} onClose={onClose} title="Tonalità del brano">
      <View style={{ flexDirection: 'row', gap: 7 }}>
        <Chip
          label="Maggiore"
          active={!minor}
          onPress={() => onChange(keyOptions(false)[keyIndexOf(value)])}
        />
        <Chip
          label="Minore"
          active={minor}
          onPress={() => onChange(keyOptions(true)[keyIndexOf(value)])}
        />
      </View>

      <View style={styles.keyGrid}>
        {keyOptions(minor).map((key) => (
          <Tap
            key={key}
            onPress={() => {
              onChange(key);
              onClose();
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: key === value }}
            style={[styles.keyCell, key === value && styles.keyCellActive]}
          >
            <Text
              style={[styles.keyCellText, key === value && { color: palette.accentInk }]}
            >
              {formatChord(key, { notation })}
            </Text>
          </Tap>
        ))}
      </View>
    </Sheet>
  );
}

/** Pitch-class index of a key, used to keep the tonic when flipping the mode. */
function keyIndexOf(key: string): number {
  const major = keyOptions(false);
  const minor = keyOptions(true);
  const inMajor = major.indexOf(key);
  if (inMajor !== -1) return inMajor;
  const inMinor = minor.indexOf(key);
  return inMinor === -1 ? 0 : inMinor;
}

/**
 * The positions a chord is allowed to sit on: every character of the line,
 * matching what tapping a letter does, so the arrows nudge a chord by exactly
 * the step the finger can't manage.
 */
function syllableStops(line: Line): number[] {
  if (line.instrumental || line.text.trim() === '') {
    // A bar of chords has no words; ordering is all `pos` means there.
    return [...line.chords].map((chord) => chord.pos).sort((a, b) => a - b);
  }
  return Array.from({ length: line.text.length }, (_, index) => index);
}

/** Where the chord is going, said in words, for the picker's subtitle. */
function wordAround(text: string, pos: number): string {
  if (!text.trim()) return 'battuta strumentale';
  // Past the last letter there is no word to name, and none is needed: what
  // matters about a chord there is that it comes in after the singing.
  if (pos >= text.length) return 'dopo le parole';

  let start = pos;
  let end = pos;
  while (start > 0 && !/\s/.test(text[start - 1])) start -= 1;
  while (end < text.length && !/\s/.test(text[end])) end += 1;
  const word = text.slice(start, end).trim() || text.trim().slice(0, 20);
  return `su «${word}»`;
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
    paddingHorizontal: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  cancel: {
    fontFamily: font.meta,
    fontSize: 15,
    color: palette.textDim,
  },
  headerTitle: {
    fontFamily: font.displaySemi,
    fontSize: 14,
    color: palette.text,
  },
  headerMeta: {
    fontFamily: font.meta,
    fontSize: 11,
    color: palette.textFainter,
    marginTop: 2,
  },
  save: {
    minWidth: 64,
    alignItems: 'center',
    backgroundColor: palette.accent,
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: radius.round,
  },
  saveText: {
    fontFamily: font.display,
    fontSize: 13,
    color: palette.accentInk,
  },
  metaBlock: {
    paddingTop: 14,
    paddingHorizontal: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  titleInput: {
    fontFamily: font.displayMid,
    fontSize: 20,
    letterSpacing: -0.2,
    color: palette.text,
    padding: 0,
  },
  artistInput: {
    fontFamily: font.meta,
    fontSize: 13,
    color: palette.textDim,
    padding: 0,
    marginTop: 2,
  },
  dataRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  modes: {
    flexDirection: 'row',
    gap: 5,
    paddingTop: 11,
    paddingHorizontal: 18,
    paddingBottom: 10,
  },
  card: {
    backgroundColor: palette.surfaceAlt,
    borderWidth: 1,
    borderColor: palette.borderCard,
    borderRadius: radius.section,
    paddingTop: 12,
    paddingHorizontal: 13,
    paddingBottom: 14,
    gap: 10,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardLabel: {
    fontFamily: font.metaBold,
    fontSize: 12.5,
    letterSpacing: 1.5,
  },
  nameInput: {
    flex: 1,
    minWidth: 0,
    fontFamily: font.metaBold,
    fontSize: 12.5,
    letterSpacing: 1.5,
    padding: 0,
  },
  /** Widened well past the glyph — a 16 pt handle is not something to aim at. */
  handle: {
    paddingVertical: 6,
    paddingRight: 6,
    marginVertical: -6,
  },
  lifted: {
    zIndex: 20,
    borderRadius: radius.section,
    ...shadow.floating,
  },
  dynamicsField: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: palette.surfaceRaised,
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  dynamicsInput: {
    flex: 1,
    fontFamily: font.metaItalic,
    fontSize: 12,
    lineHeight: 18,
    color: palette.dynamics,
    padding: 0,
  },
  dynamicsText: {
    flex: 1,
    fontFamily: font.metaItalic,
    fontSize: 12,
    lineHeight: 18,
    color: palette.dynamics,
  },
  dynamicsLineBlock: {
    gap: 5,
  },
  dynamicsLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.hairlineSubtle,
  },
  dynamicsLineText: {
    fontFamily: font.mono,
    fontSize: 14,
    lineHeight: 20,
    color: palette.text,
  },
  dynamicsLineChords: {
    fontFamily: font.chord,
    fontSize: 13,
    lineHeight: 18,
    color: palette.accent,
  },
  dynamicsLineEmpty: {
    fontFamily: font.metaItalic,
    fontSize: 12,
    lineHeight: 18,
    color: palette.textFaint,
  },
  dynamicsAddBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.round,
    backgroundColor: palette.surfaceRaised,
  },
  dynamicsAddText: {
    fontFamily: font.meta,
    fontSize: 11,
    color: palette.dynamicsDim,
  },
  lyricsInput: {
    fontFamily: font.mono,
    fontSize: 16,
    lineHeight: 24,
    color: palette.text,
    paddingHorizontal: 0,
    paddingVertical: 2,
    minHeight: 60,
  },
  hint: {
    fontFamily: font.meta,
    fontSize: 12,
    lineHeight: 18,
    color: palette.textFaint,
  },
  chordRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  lineRemove: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.round,
    backgroundColor: palette.surfaceControl,
  },
  lineAdd: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    marginTop: 2,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.round,
    backgroundColor: palette.surfaceControl,
  },
  lineAddText: {
    fontFamily: font.meta,
    fontSize: 12,
    color: palette.textFaint,
  },
  menu: {
    backgroundColor: palette.surface,
    borderRadius: radius.cardLg,
    overflow: 'hidden',
  },
  keyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  keyCell: {
    minWidth: 56,
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderRadius: radius.pillule,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.borderControl,
  },
  keyCellActive: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
  },
  keyCellText: {
    fontFamily: font.monoBold,
    fontSize: 14,
    color: palette.accent,
  },
});
