import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  QUALITY_OPTIONS,
  diatonicChords,
  formatChord,
  formatKey,
  keyPrefersFlats,
  parseChord,
  rootOptions,
} from '../lib/chords';
import { font, palette, radius } from '../lib/theme';
import type { Notation } from '../lib/types';
import { Sheet } from './Sheet';
import { Wheel } from './Wheel';
import { ChevronLeft, ChevronRight, Trash } from './icons';
import { Eyebrow, PrimaryButton, Tap } from './ui';

/**
 * Chord entry, opened by tapping a syllable or an existing chord.
 *
 * Two ways in, in the order they're reached for. The seven chords of the key
 * sit across one row at the top: nine times out of ten the chord is one of
 * them, and it's one tap away. Under them the whole chromatic space, spelled
 * out on three wheels — note, colour, bass — so anything else is dialled in
 * without a wall of buttons to read. The button that puts the chord on the
 * page stays pinned to the bottom of the sheet, out of the way of both.
 */
export function ChordPicker({
  visible,
  onClose,
  songKey,
  notation,
  nashville = false,
  songChords = [],
  initialChord,
  context,
  onMove,
  onSubmit,
  onDelete,
}: {
  visible: boolean;
  onClose: () => void;
  songKey: string;
  notation: Notation;
  /** Write the degree over each chord of the key. */
  nashville?: boolean;
  /** Every chord the song already uses, most used first. */
  songChords?: string[];
  /** Present when editing an existing chord. */
  initialChord?: string;
  /** Where the chord attaches, already phrased, shown as a subtitle. */
  context?: string;
  /** Present when editing a placed chord: slides it a syllable either way. */
  onMove?: (delta: -1 | 1) => void;
  onSubmit: (chord: string) => void;
  onDelete?: () => void;
}) {
  const useFlats = keyPrefersFlats(songKey);
  const key = useMemo(() => diatonicChords(songKey), [songKey]);

  /**
   * What the song uses that the seven don't already say: a slash chord, a
   * secondary dominant, a borrowed minor — but also a plain Dm7 where the key
   * offers Dm. They simply carry on the same list, unlabelled: "in this key"
   * and "in this song" are the same reflex when you're placing a chord, and a
   * song that leans on a D/F# leans on it in every verse.
   */
  const extra = useMemo(() => {
    const inKey = new Set(key.map((degree) => degree.chord));
    return songChords.filter((chord) => !inKey.has(chord)).slice(0, 8);
  }, [key, songChords]);

  const [root, setRoot] = useState('C');
  const [quality, setQuality] = useState('');
  const [bass, setBass] = useState('');
  // Non-null while the chord is being typed into the preview by hand, which is
  // the only way to write something the wheels can't say ("N.C.", "Cmaj9#11").
  const [typed, setTyped] = useState<string | null>(null);

  const roots = useMemo(
    () =>
      rootOptions(useFlats).map((note) => ({
        value: note,
        label: formatChord(note, { notation }),
      })),
    [useFlats, notation]
  );

  /**
   * The colours on offer, plus whatever the chord being edited already is:
   * a "maj9#11" typed in by hand keeps its place on the wheel instead of
   * reading as the plain triad at the top of the list.
   */
  const qualities = useMemo(() => {
    const options = QUALITY_OPTIONS.map((option) => ({
      value: option.value as string,
      label: option.label as string,
    }));
    return options.some((option) => option.value === quality)
      ? options
      : [...options, { value: quality, label: quality }];
  }, [quality]);

  const basses = useMemo(
    () => [
      { value: '', label: '—' },
      ...rootOptions(useFlats).map((note) => ({
        value: note,
        label: `/${formatChord(note, { notation })}`,
      })),
    ],
    [useFlats, notation]
  );

  // Re-seed the controls each time the sheet opens.
  useEffect(() => {
    if (!visible) return;

    const parsed = initialChord ? parseChord(initialChord) : null;
    if (parsed) {
      setRoot(parsed.root);
      setQuality(parsed.quality);
      setBass(parsed.bass ?? '');
      setTyped(null);
    } else {
      const tonic = key[0] ? parseChord(key[0].chord) : null;
      setRoot(tonic?.root ?? 'C');
      setQuality(tonic?.quality ?? '');
      setBass('');
      setTyped(initialChord ?? null);
    }
  }, [visible, initialChord]);

  const composed = root + quality + (bass ? `/${bass}` : '');
  const value = typed === null ? composed : typed.trim();
  const valid = value.length > 0;

  /** What the big field shows: the typed text as typed, otherwise the build. */
  const shown = typed === null ? formatChord(composed, { notation }) : typed;

  /** Picks a whole chord off the row of the key's own chords. */
  const pick = (chord: string) => {
    const parsed = parseChord(chord);
    if (!parsed) return;
    setRoot(parsed.root);
    setQuality(parsed.quality);
    setBass(parsed.bass ?? '');
    setTyped(null);
  };

  const submit = () => {
    if (!valid) return;
    // Store the canonical Anglo spelling when the text is a chord, so a hand
    // typed "Lam7" comes back out as Am7; leave anything else exactly as typed.
    const parsed = typed === null ? null : parseChord(value);
    onSubmit(
      parsed ? parsed.root + parsed.quality + (parsed.bass ? `/${parsed.bass}` : '') : value
    );
    onClose();
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={initialChord ? 'Modifica accordo' : 'Nuovo accordo'}
      subtitle={context}
      scroll={false}
      footer={
        <View style={styles.actions}>
          {onDelete ? (
            <Tap
              onPress={() => {
                onDelete();
                onClose();
              }}
              accessibilityRole="button"
              accessibilityLabel="Elimina accordo"
              style={styles.delete}
            >
              <Trash size={18} color={palette.accent} />
            </Tap>
          ) : null}
          <PrimaryButton
            label={initialChord ? 'Salva accordo' : 'Inserisci accordo'}
            onPress={submit}
            disabled={!valid}
            style={{ flex: 1 }}
          />
        </View>
      }
    >
      {/* The chord itself, flanked by the two keys that slide it along the
          line — the arrows point at the syllable it would move to. */}
      <View style={styles.previewRow}>
        {onMove ? (
          <Tap
            onPress={() => onMove(-1)}
            accessibilityRole="button"
            accessibilityLabel="Sposta l’accordo sulla sillaba precedente"
            style={styles.moveKey}
          >
            <ChevronLeft size={18} color={palette.textMuted} />
          </Tap>
        ) : null}

        <TextInput
          value={shown}
          onChangeText={setTyped}
          accessibilityLabel="Accordo"
          autoCapitalize="none"
          autoCorrect={false}
          selectTextOnFocus
          style={styles.preview}
        />

        {onMove ? (
          <Tap
            onPress={() => onMove(1)}
            accessibilityRole="button"
            accessibilityLabel="Sposta l’accordo sulla sillaba successiva"
            style={styles.moveKey}
          >
            <ChevronRight size={18} color={palette.textMuted} />
          </Tap>
        ) : null}
      </View>

      <View style={styles.row}>
        <Eyebrow>{`Tonalità di ${formatKey(songKey, notation)}`}</Eyebrow>
        <View style={styles.keyRow}>
          {key.map((degree) => {
            const active = typed === null && degree.chord === root + quality && !bass;
            return (
              <Pressable
                key={degree.chord}
                onPress={() => pick(degree.chord)}
                accessibilityRole="button"
                accessibilityLabel={`Accordo ${degree.chord}`}
                accessibilityState={{ selected: active }}
                style={[styles.cell, active && styles.cellActive]}
              >
                {nashville ? (
                  <Text style={[styles.cellNumber, active && { color: palette.onHeroLabel }]}>
                    {degree.number}
                  </Text>
                ) : null}
                <Text
                  style={[styles.cellText, active && { color: palette.accentInk }]}
                  numberOfLines={1}
                >
                  {formatChord(degree.chord, { notation })}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {extra.length ? (
          <View style={styles.extraRow}>
            {extra.map((chord) => {
              const active = typed === null && chord === composed;
              return (
                <Pressable
                  key={chord}
                  onPress={() => pick(chord)}
                  accessibilityRole="button"
                  accessibilityLabel={`Accordo ${chord}`}
                  accessibilityState={{ selected: active }}
                  style={[styles.cell, styles.extraCell, active && styles.cellActive]}
                >
                  <Text
                    style={[styles.cellText, active && { color: palette.accentInk }]}
                    numberOfLines={1}
                  >
                    {formatChord(chord, { notation })}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>

      {/* Anything else: the note, what's built on it, and what's under it. */}
      <View style={styles.wheels}>
        <Wheel
          label="nota"
          data={roots}
          value={root}
          onChange={(note) => {
            setRoot(note);
            setTyped(null);
          }}
          itemHeight={38}
        />
        <Wheel
          label="colore"
          data={qualities}
          value={quality}
          onChange={(next) => {
            setQuality(next);
            setTyped(null);
          }}
          style={{ flex: 1.35 }}
          itemHeight={38}
        />
        <Wheel
          label="basso"
          data={basses}
          value={bass}
          onChange={(note) => {
            setBass(note);
            setTyped(null);
          }}
          itemHeight={38}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  preview: {
    flex: 1,
    // Without this a text field refuses to shrink under its intrinsic width
    // and pushes the move keys off the edge of the sheet.
    minWidth: 0,
    height: 52,
    borderRadius: radius.cardLg,
    backgroundColor: palette.accent,
    textAlign: 'center',
    fontFamily: font.monoBold,
    fontSize: 23,
    color: palette.accentInk,
    paddingHorizontal: 8,
  },
  moveKey: {
    width: 46,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.cardLg,
    backgroundColor: palette.surfaceControl,
  },
  row: {
    gap: 6,
  },
  // Seven chords, one row, no scrolling: the whole key has to be readable at a
  // glance or it may as well be a menu.
  keyRow: {
    flexDirection: 'row',
    gap: 4,
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 2,
    borderRadius: radius.pillule,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.borderControl,
  },
  // The chords the song brought with it wrap under the key instead of sharing
  // its row: there can be one or eight of them, and the seven above have to
  // keep their even spacing whatever happens down here.
  extraRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  extraCell: {
    // Not `flex: 0`, which zeroes the basis too and leaves the chord no width
    // to be written in: these cells are as wide as what they say.
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
    paddingHorizontal: 11,
  },
  cellActive: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
  },
  cellNumber: {
    fontFamily: font.metaSemi,
    fontSize: 9,
    letterSpacing: 0.4,
    color: palette.textGhost,
    marginBottom: 1,
  },
  cellText: {
    fontFamily: font.monoBold,
    fontSize: 13,
    color: palette.accent,
  },
  wheels: {
    flexDirection: 'row',
    gap: 6,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  delete: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.cardLg,
    backgroundColor: palette.chordUnderline,
  },
});
