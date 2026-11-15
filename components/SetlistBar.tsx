import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { font, palette, radius } from '../lib/theme';
import { ChevronLeft, ChevronRight } from './icons';
import { Tap } from './ui';

/**
 * Where you are in tonight's running order, pinned under the chart while a set
 * is being played.
 *
 * It answers the two questions you actually have between songs — which one is
 * this, and how much is left — and carries the note the setlist put after this
 * song, because "cambio chitarra" is worth more at that moment than anything
 * else on the screen. The arrows repeat what a swipe does: on a dark stage a
 * visible target beats a gesture you have to remember.
 */
export function SetlistBar({
  index,
  total,
  nextTitle,
  note,
  bottomInset,
  onPrev,
  onNext,
}: {
  /** Zero-based position of the song on screen. */
  index: number;
  total: number;
  /** Title of the song after this one, if there is one. */
  nextTitle?: string;
  /** A setlist note standing between this song and the next. */
  note?: string;
  bottomInset: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  const position = index + 1;
  const left = total - position;
  const first = index <= 0;
  const last = index >= total - 1;

  const remaining = last
    ? 'ultimo brano'
    : `ne manca${left === 1 ? '' : 'no'} ${left}`;

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(bottomInset, 8) + 8 }]}>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${(position / total) * 100}%` }]} />
      </View>

      <View style={styles.row}>
        <Tap
          onPress={onPrev}
          disabled={first}
          accessibilityRole="button"
          accessibilityLabel="Brano precedente"
          accessibilityState={{ disabled: first }}
          hitSlop={10}
          style={[styles.key, first && styles.keyOff]}
        >
          <ChevronLeft size={18} color={first ? palette.textGhost : palette.text} />
        </Tap>

        <View style={styles.center}>
          <Text style={styles.position} numberOfLines={1}>
            {`Brano ${position} di ${total} · ${remaining}`}
          </Text>

          {note ? (
            <Text style={styles.note} numberOfLines={1}>
              {note}
            </Text>
          ) : nextTitle ? (
            <Text style={styles.next} numberOfLines={1}>
              {`Poi · ${nextTitle}`}
            </Text>
          ) : null}
        </View>

        <Tap
          onPress={onNext}
          disabled={last}
          accessibilityRole="button"
          accessibilityLabel="Brano successivo"
          accessibilityState={{ disabled: last }}
          hitSlop={10}
          style={[styles.key, last && styles.keyOff]}
        >
          <ChevronRight size={18} color={last ? palette.textGhost : palette.text} />
        </Tap>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: palette.surfaceAlt,
    borderTopWidth: 1,
    borderTopColor: palette.borderCard,
  },
  track: {
    height: 3,
    backgroundColor: palette.surfaceControlHi,
  },
  fill: {
    height: 3,
    backgroundColor: palette.accent,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 9,
    paddingHorizontal: 14,
  },
  center: {
    flex: 1,
    alignItems: 'center',
  },
  position: {
    fontFamily: font.displaySemi,
    fontSize: 13,
    color: palette.text,
  },
  next: {
    fontFamily: font.meta,
    fontSize: 11.5,
    color: palette.textDim,
    marginTop: 2,
  },
  note: {
    fontFamily: font.metaItalic,
    fontSize: 11.5,
    color: palette.dynamics,
    marginTop: 2,
  },
  key: {
    width: 42,
    height: 42,
    borderRadius: radius.pillule,
    backgroundColor: palette.surfaceControl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyOff: {
    backgroundColor: 'transparent',
  },
});
