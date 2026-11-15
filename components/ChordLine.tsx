import * as Haptics from 'expo-haptics';
import React, { useMemo, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutRectangle,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { formatChord } from '../lib/chords';
import { applyAnchors, splitLine } from '../lib/syllables';
import { font, palette } from '../lib/theme';
import type { ChordAnchor, Line, Notation } from '../lib/types';

/**
 * Chords sitting over the exact syllable they belong to — the pattern the whole
 * design turns on.
 *
 * A line is a wrapping row of columns aligned to their bottom edge. Each column
 * holds two things: a chord box of fixed height, and the fragment of text under
 * it. When a fragment carries no chord the box is still emitted, empty, so the
 * lyric baseline never moves between one word and the next; a chord wider than
 * its syllable pushes the following text along, exactly as a printed chart
 * does. No monospaced padding and no measurement pass, so it survives a change
 * of font size or a Dynamic Type setting.
 */

export type ChordLineVariant = 'viewer' | 'editor';

export type ChordLineProps = {
  line: Line;
  notation: Notation;
  semitones: number;
  useFlats: boolean;
  fontScale?: number;
  showChords?: boolean;
  variant?: ChordLineVariant;
  editing?: boolean;
  /** Character offset the user tapped, for placing a new chord. */
  onPressSyllable?: (pos: number) => void;
  onPressChord?: (chord: ChordAnchor) => void;
  /** Press and drag a chord onto another syllable of the same line. */
  onDragChord?: (chord: ChordAnchor, pos: number) => void;
  /** Same gesture on a chords-only line, where all a chord has is its rank. */
  onDragRank?: (from: number, to: number) => void;
  /** Highlighted while its editor is open. */
  activeChordId?: string;
};

/**
 * Chords read close to lyric size in the viewer: on a stand at arm's length
 * the chord is what you're hunting for, so it can't be the smaller of the
 * two. The editor keeps the tighter gap — there it's read up close.
 */
const METRICS = {
  viewer: { lyric: 19, lyricLine: 27, chord: 17, chordLine: 22, box: 24 },
  editor: { lyric: 16, lyricLine: 24, chord: 13, chordLine: 18, box: 21 },
} as const;

/** How far above the finger a chord rides while it's being carried. */
const LIFT = 26;

/** How wide the end-of-line drop spot counts as, however far the paper runs. */
const TAIL_SPOT = 10;

export function ChordLine({
  line,
  notation,
  semitones,
  useFlats,
  fontScale = 1,
  showChords = true,
  variant = 'viewer',
  editing = false,
  onPressSyllable,
  onPressChord,
  onDragChord,
  onDragRank,
  activeChordId,
}: ChordLineProps) {
  const metrics = METRICS[variant];
  const lyricSize = metrics.lyric * fontScale;
  const lyricLine = metrics.lyricLine * fontScale;
  const chordSize = metrics.chord * fontScale;
  const boxHeight = metrics.box * fontScale;

  const chordAt = useMemo(() => {
    const map = new Map<number, ChordAnchor>();
    for (const chord of line.chords) map.set(chord.pos, chord);
    return map;
  }, [line.chords]);

  const words = useMemo(() => {
    const base = splitLine(line.text);
    if (!editing) return applyAnchors(base, line.chords.map((chord) => chord.pos));

    // While editing, every letter is its own target: a chord belongs over the
    // exact character you pointed at, not over the syllable that contains it.
    // Words stay whole rows, so this changes what you can hit, not how the
    // line wraps — and the editor's font is monospaced, so the letters sit
    // exactly where they did before they were split apart.
    return base.map((word) => ({
      ...word,
      syllables: Array.from(word.text).map((character, index) => ({
        text: character,
        start: word.start + index,
      })),
    }));
  }, [line.text, line.chords, editing]);

  const label = (chord: ChordAnchor) =>
    formatChord(chord.chord, { notation, semitones, useFlats });

  // Kept above the early return so the hook order never changes between a line
  // that has words and the same line once they're deleted.
  const drag = useChordDrag((from, to) => {
    const chord = line.chords.find((entry) => entry.pos === from);
    if (chord) onDragChord?.(chord, to);
  });

  if (line.instrumental || line.text.trim() === '') {
    return (
      <InstrumentalLine
        line={line}
        label={label}
        size={(variant === 'viewer' ? 19 : 14) * fontScale}
        editing={editing}
        showChords={showChords}
        onPressChord={onPressChord}
        onPressSyllable={onPressSyllable}
        onDragRank={onDragRank}
      />
    );
  }

  const lyricStyle = [
    variant === 'viewer' ? styles.lyricViewer : styles.lyricEditor,
    { fontSize: lyricSize, lineHeight: lyricLine },
  ];

  /** Chords parked past the end of the line get their own trailing column. */
  const trailing = line.chords
    .filter((chord) => chord.pos >= line.text.length && line.text.length > 0)
    .sort((a, b) => a.pos - b.pos);

  // Only reserve the chord row on lines that actually carry chords, so plain
  // verses don't grow a band of empty space above them.
  const hasChords = showChords && line.chords.length > 0;

  /**
   * Where a chord that falls after the last word goes — the first free spot
   * past the end of the line, so a second one parks beside the first instead
   * of on top of it. Music doesn't stop with the words: a turnaround under the
   * last held note has nowhere else to be written.
   */
  const tailPos = Math.max(line.text.length, ...trailing.map((chord) => chord.pos + 1));

  /**
   * Everywhere a dragged chord may land: one stop per character, the parked
   * positions past the end of the words, and the free spot after them. Handed
   * to the drag as it starts, so a stop that belonged to text since deleted
   * can't attract it.
   */
  const stops = [
    ...Array.from({ length: line.text.length }, (_, index) => index),
    ...trailing.map((chord) => chord.pos),
    tailPos,
  ];

  /**
   * `floating` chords are laid out over the text instead of alongside it.
   *
   * A chord wider than the syllable under it has to go somewhere. At a word
   * boundary it pushes the next word along, which is what a printed chart
   * does and what the eye expects. Inside a word that same push opens a gap
   * mid-word — "acce si" instead of "accesi" — which reads as a typo, so
   * there the chord overflows to the right and the letters stay joined.
   */
  const renderBox = (chord: ChordAnchor | undefined, floating: boolean) => {
    if (!hasChords) return null;

    return (
      <View
        // A wide chord overflows its syllable and runs under the empty boxes
        // of the letters that follow, which are drawn after it. Those boxes
        // reserve space and nothing else, so they must not take the touch that
        // was meant for the chord underneath them.
        pointerEvents="box-none"
        style={[{ height: boxHeight, justifyContent: 'flex-start' }, floating && { width: 0 }]}
      >
        {chord ? (
          <ChordBox
            draggable={editing && !!onDragChord}
            dragging={drag.dragKey === chord.pos}
            pan={drag.pan}
            onDragStart={() => drag.begin(chord.pos, stops)}
            onDragMove={drag.move}
            onDragEnd={drag.end}
            onPress={
              editing ? () => (drag.justDragged() ? undefined : onPressChord?.(chord)) : undefined
            }
            accessibilityLabel={editing ? `Modifica accordo ${label(chord)}` : undefined}
            // Taking the chord out of the flow is the outermost thing about
            // it, so it stays on the outermost box whether or not that box is
            // the draggable wrapper.
            containerStyle={floating ? styles.chordFloating : undefined}
            style={[
              styles.chordHit,
              editing && styles.chordEditable,
              activeChordId === chord.id && styles.chordActive,
            ]}
          >
            <Text
              style={[styles.chord, { fontSize: chordSize, lineHeight: metrics.chordLine * fontScale }]}
            >
              {label(chord)}
            </Text>
          </ChordBox>
        ) : null}
      </View>
    );
  };

  /**
   * The bar that says "here". A dragged chord is under the finger and the
   * finger is over the words, so the answer to "where would this land?" has to
   * be readable in the one strip of the line the hand isn't covering: a mark
   * down the left edge of the target, from the chord row to the baseline.
   */
  const dropMark = (key: number) =>
    drag.dropKey === key ? <View pointerEvents="none" style={styles.dropMark} /> : null;

  return (
    <View
      style={styles.line}
      accessible
      accessibilityLabel={describe(line, label)}
    >
      {words.map((word) => (
        <View
          key={`w${word.start}`}
          // See the chord boxes below: only the chords and the syllables
          // themselves take a touch, never the boxes that hold them, or the
          // overflow of a wide chord would fall on deaf ears.
          pointerEvents="box-none"
          style={styles.word}
          // Syllables measure themselves inside their word, so the word's own
          // offset is what turns that into a place on the line.
          onLayout={(event) => drag.measureGroup(word.start, event.nativeEvent.layout)}
        >
          {word.syllables.map((syllable, index) => (
            <View
              key={`s${syllable.start}`}
              pointerEvents="box-none"
              style={styles.column}
              onLayout={(event) =>
                drag.measureSpot(syllable.start, word.start, event.nativeEvent.layout)
              }
            >
              {dropMark(syllable.start)}

              {renderBox(
                chordAt.get(syllable.start),
                index < word.syllables.length - 1
              )}

              <Pressable
                onPress={editing ? () => onPressSyllable?.(syllable.start) : undefined}
                disabled={!editing}
                accessibilityRole={editing ? 'button' : undefined}
                accessibilityLabel={
                  editing && syllable.text.trim()
                    ? `Inserisci accordo su ${syllable.text.trim()}`
                    : undefined
                }
                style={({ pressed }) => [pressed && editing && styles.syllablePressed]}
              >
                <Text
                  style={[
                    lyricStyle,
                    drag.dropKey === syllable.start && styles.syllableTarget,
                  ]}
                >
                  {syllable.text}
                </Text>
              </Pressable>
            </View>
          ))}
        </View>
      ))}

      {trailing.map((chord) => (
        <View
          key={chord.id}
          pointerEvents="box-none"
          style={styles.column}
          onLayout={(event) => drag.measureSpot(chord.pos, null, event.nativeEvent.layout)}
        >
          {dropMark(chord.pos)}
          {renderBox(chord, false)}
          <Text style={lyricStyle}> </Text>
        </View>
      ))}

      {/* Everything past the last word, while editing: bare paper, and tapping
          it writes the chord that comes in once the singing has stopped. No
          mark of its own — the empty end of a line is already the place you
          point at when you mean "and then". */}
      {editing ? (
        <View
          pointerEvents="box-none"
          style={styles.tail}
          onLayout={(event) =>
            drag.measureSpot(tailPos, null, {
              ...event.nativeEvent.layout,
              // The area runs to the right margin, but the chord lands right
              // after the last word: that near edge is what a drop aims at.
              width: TAIL_SPOT,
            })
          }
        >
          {dropMark(tailPos)}

          <Pressable
            onPress={() => onPressSyllable?.(tailPos)}
            accessibilityRole="button"
            accessibilityLabel="Inserisci un accordo dopo le parole"
            style={styles.tailHit}
          >
            {hasChords ? <View style={{ height: boxHeight }} /> : null}
            <Text style={lyricStyle}> </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

/**
 * A chords-only line — an intro, a turnaround, a stacco. Bare sigils spaced
 * well apart, no boxes and no rules: on stage this is a count, not a chart.
 */
function InstrumentalLine({
  line,
  label,
  size,
  editing,
  showChords,
  onPressChord,
  onPressSyllable,
  onDragRank,
}: {
  line: Line;
  label: (chord: ChordAnchor) => string;
  size: number;
  editing: boolean;
  showChords: boolean;
  onPressChord?: (chord: ChordAnchor) => void;
  onPressSyllable?: (pos: number) => void;
  onDragRank?: (from: number, to: number) => void;
}) {
  const chords = [...line.chords].sort((a, b) => a.pos - b.pos);
  // Here a chord has no syllable to sit on, so the stops are the chords
  // themselves: dragging one over another swaps their place in the bar.
  const drag = useChordDrag((from, to) => onDragRank?.(from, to));
  const ranks = chords.map((_, index) => index);

  if (!showChords) return null;

  return (
    <View style={styles.instrumental}>
      {chords.map((chord, index) => {
        // Where this one would end up if the chord in the air were dropped now.
        const target = drag.dropKey === index && drag.dragKey !== index;
        return (
        <View
          key={chord.id}
          onLayout={(event) => drag.measureSpot(index, null, event.nativeEvent.layout)}
        >
          <ChordBox
            draggable={editing && !!onDragRank}
            dragging={drag.dragKey === index}
            pan={drag.pan}
            onDragStart={() => drag.begin(index, ranks)}
            onDragMove={drag.move}
            onDragEnd={drag.end}
            onPress={
              editing ? () => (drag.justDragged() ? undefined : onPressChord?.(chord)) : undefined
            }
            accessibilityLabel={`Accordo ${label(chord)}`}
            hitSlop={10}
            style={[editing && styles.chordEditable, target && styles.chordTarget]}
          >
            <Text
              style={[
                styles.chord,
                { fontSize: size, lineHeight: size * 1.35 },
                target && { color: palette.accentInk },
              ]}
            >
              {label(chord)}
            </Text>
          </ChordBox>
        </View>
        );
      })}

      {/* The rest of the bar: tapping it writes the next chord. It only says
          so with a plus while the bar is still empty — there, blank paper with
          nothing on it at all would give the finger nothing to aim at. */}
      {editing ? (
        <Pressable
          onPress={() => onPressSyllable?.(chords.length ? chords[chords.length - 1].pos + 1 : 0)}
          accessibilityRole="button"
          accessibilityLabel="Aggiungi accordo"
          hitSlop={10}
          style={[styles.tail, { minHeight: size * 1.35 }]}
        >
          {chords.length === 0 ? (
            <Text style={[styles.chordAdd, { fontSize: size, lineHeight: size * 1.35 }]}>+</Text>
          ) : null}
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * A chord you can pick up. A tap still opens the editor; holding it for a
 * moment lifts it off the line and hands it to the finger, which is the one
 * gesture that says "this one goes over there" without a dialog in between.
 */
function ChordBox({
  draggable,
  dragging,
  pan,
  containerStyle,
  style,
  hitSlop = { top: 10, bottom: 4, left: 6, right: 10 },
  accessibilityLabel,
  onPress,
  onDragStart,
  onDragMove,
  onDragEnd,
  children,
}: {
  draggable: boolean;
  dragging: boolean;
  pan: Animated.ValueXY;
  /** Sits on whichever box is outermost — where the chord is on the line. */
  containerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  hitSlop?: React.ComponentProps<typeof Pressable>['hitSlop'];
  accessibilityLabel?: string;
  onPress?: () => void;
  onDragStart: () => void;
  onDragMove: (dx: number, dy: number) => void;
  onDragEnd: () => void;
  children: React.ReactNode;
}) {
  // The gestures are built once and read the current handlers through this,
  // so a re-render doesn't detach them mid-drag.
  const handlers = useRef({ onDragStart, onDragMove, onDragEnd, onPress });
  handlers.current = { onDragStart, onDragMove, onDragEnd, onPress };

  /**
   * Both the tap and the drag go through the gesture handler, and not through
   * a Pressable inside it: a detector swallows the touches of the views under
   * it, so a chord that could be dragged could no longer be tapped open. The
   * pan wins when it activates, which is the whole meaning of `Exclusive` —
   * hold it and it moves, let go straight away and it opens.
   */
  const gesture = useMemo(
    () =>
      Gesture.Exclusive(
        Gesture.Pan()
          // Held, not swiped: the page scrolls under a finger that's only
          // passing over a chord, and only a deliberate press picks one up.
          .activateAfterLongPress(220)
          .runOnJS(true)
          .onStart(() => handlers.current.onDragStart())
          .onUpdate((event) => handlers.current.onDragMove(event.translationX, event.translationY))
          .onFinalize(() => handlers.current.onDragEnd()),
        Gesture.Tap()
          .runOnJS(true)
          .onEnd(() => handlers.current.onPress?.())
      ),
    []
  );

  if (!draggable) {
    return (
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        hitSlop={hitSlop}
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={accessibilityLabel}
        style={[containerStyle, style]}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        accessible={!!onPress}
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={accessibilityLabel}
        hitSlop={hitSlop}
        style={[
          containerStyle,
          dragging && styles.chordLifted,
          dragging && {
            transform: [
              { translateX: pan.x },
              { translateY: pan.y },
              // Carried a little above the fingertip, or the hand covers the
              // very thing it's moving.
              { translateY: -LIFT },
            ],
          },
        ]}
      >
        <View style={style}>{children}</View>
      </Animated.View>
    </GestureDetector>
  );
}

/** A measured drop target, in the coordinates of whatever it was laid out in. */
type Spot = { x: number; y: number; width: number; group: number | null };

const ORIGIN = { x: 0, y: 0 };

/**
 * The mechanics of carrying a chord across a line: where every stop is, which
 * one the finger is over, and what to commit on release. Keys are whatever the
 * caller counts stops by — a character offset on a sung line, a rank on a bar
 * of chords — so both kinds of line share the same gesture.
 */
function useChordDrag(commit: (from: number, to: number) => void) {
  const spots = useRef(new Map<number, Spot>()).current;
  const groups = useRef(new Map<number, { x: number; y: number }>()).current;
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  const [dragKey, setDragKey] = useState<number | null>(null);
  const [dropKey, setDropKey] = useState<number | null>(null);
  // Live values the gesture reads and writes between renders.
  const live = useRef<{ from: number; to: number; x: number; y: number } | null>(null);
  const allowed = useRef<number[]>([]);
  const endedAt = useRef(0);

  const centerOf = (key: number) => {
    const spot = spots.get(key);
    if (!spot) return null;
    const base = spot.group === null ? ORIGIN : groups.get(spot.group) ?? ORIGIN;
    return { x: base.x + spot.x + spot.width / 2, y: base.y + spot.y };
  };

  /** The stop the finger is closest to, rows counting for more than columns. */
  const nearest = (x: number, y: number) => {
    let best: number | null = null;
    let bestScore = Infinity;
    for (const key of allowed.current) {
      const center = centerOf(key);
      if (!center) continue;
      const score = Math.abs(center.x - x) + Math.abs(center.y - y) * 3;
      if (score < bestScore) {
        bestScore = score;
        best = key;
      }
    }
    return best;
  };

  const measureGroup = (id: number, layout: LayoutRectangle) => {
    groups.set(id, { x: layout.x, y: layout.y });
  };

  const measureSpot = (key: number, group: number | null, layout: LayoutRectangle) => {
    spots.set(key, { x: layout.x, y: layout.y, width: layout.width, group });
  };

  const begin = (key: number, keys: number[]) => {
    const origin = centerOf(key);
    if (!origin) return;
    allowed.current = keys;
    live.current = { from: key, to: key, x: origin.x, y: origin.y };
    pan.setValue({ x: 0, y: 0 });
    setDragKey(key);
    setDropKey(key);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  };

  const move = (dx: number, dy: number) => {
    const current = live.current;
    if (!current) return;
    pan.setValue({ x: dx, y: dy });

    const next = nearest(current.x + dx, current.y + dy);
    if (next === null || next === current.to) return;
    current.to = next;
    setDropKey(next);
    Haptics.selectionAsync().catch(() => {});
  };

  const end = () => {
    const current = live.current;
    // The pan finalizes on every touch that reaches a chord, including the
    // quick ones that turn out to be taps. Only a press that actually got as
    // far as picking the chord up has anything to put down.
    if (!current) return;
    live.current = null;
    endedAt.current = Date.now();
    setDragKey(null);
    setDropKey(null);
    pan.setValue({ x: 0, y: 0 });
    if (current.to !== current.from) commit(current.from, current.to);
  };

  return {
    pan,
    dragKey,
    dropKey,
    measureGroup,
    measureSpot,
    begin,
    move,
    end,
    /** Swallows the tap that the release of a drag also fires. */
    justDragged: () => Date.now() - endedAt.current < 350,
  };
}

/** "accordo Em, Canta con me" — what a screen reader announces for the line. */
function describe(line: Line, label: (chord: ChordAnchor) => string): string {
  if (line.chords.length === 0) return line.text;
  const chords = [...line.chords].sort((a, b) => a.pos - b.pos).map(label).join(', ');
  return line.text.trim() ? `accordi ${chords}. ${line.text}` : `accordi ${chords}`;
}

const styles = StyleSheet.create({
  line: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
  },
  word: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  column: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  chordHit: {
    paddingRight: 8,
  },
  /**
   * The rest of the line after the last word. A zero basis keeps it out of the
   * wrapping arithmetic — the words break exactly where they did before it
   * existed — and the growth then hands it whatever is left of the row.
   */
  tail: {
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 24,
  },
  tailHit: {
    alignSelf: 'stretch',
  },
  chordFloating: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  chordEditable: {
    borderBottomWidth: 1.5,
    borderBottomColor: palette.chordUnderline,
    borderStyle: 'dashed',
  },
  chordActive: {
    backgroundColor: palette.chordHighlight,
    borderRadius: 4,
    paddingHorizontal: 3,
  },
  /** Off the line and under the finger: raised over everything around it. */
  chordLifted: {
    zIndex: 30,
    elevation: 6,
    // A card under the chord while it's in the air, so it reads as carried
    // rather than as one more chord printed on the line. Nothing here changes
    // its size: the words must not shuffle about while it's off the page.
    backgroundColor: palette.surface,
    borderRadius: 5,
  },
  chordTarget: {
    backgroundColor: palette.accent,
    borderRadius: 4,
    paddingHorizontal: 3,
  },
  chord: {
    fontFamily: font.monoBold,
    color: palette.accent,
  },
  chordAdd: {
    fontFamily: font.monoBold,
    color: palette.textGhost,
  },
  lyricViewer: {
    fontFamily: font.displayMid,
    color: palette.text,
  },
  lyricEditor: {
    fontFamily: font.mono,
    color: palette.text,
  },
  syllablePressed: {
    backgroundColor: palette.chordUnderline,
    borderRadius: 3,
  },
  /** The syllable a dragged chord would land on. */
  /** The syllable a dragged chord would land on, painted to be seen past a
   *  finger: filled in the accent, with the letter knocked out of it. */
  syllableTarget: {
    backgroundColor: palette.accent,
    color: palette.accentInk,
    borderRadius: 3,
  },
  /** Runs down the left edge of the target, from the chord row to the
   *  baseline — the one part of the drop that a hand never covers. */
  dropMark: {
    position: 'absolute',
    left: -1.5,
    top: 0,
    bottom: 0,
    width: 3,
    borderRadius: 2,
    backgroundColor: palette.accent,
    zIndex: 5,
  },
  instrumental: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 22,
    paddingVertical: 2,
  },
});
