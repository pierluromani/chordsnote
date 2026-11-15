import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
} from 'react-native';
import { Gesture, GestureDetector, type PanGesture } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChordLine } from '../../../components/ChordLine';
import { Reveal } from '../../../components/Reveal';
import { SetlistBar } from '../../../components/SetlistBar';
import {
  AutoScroll,
  ChevronLeft,
  Ellipsis,
  Export,
  ListBullet,
  Minus,
  Pencil,
  Plus,
  TextSize,
} from '../../../components/icons';
import { Sheet, SheetRow } from '../../../components/Sheet';
import {
  Chip,
  CircleButton,
  DynamicsNote,
  EmptyState,
  PillButton,
  PrimaryButton,
  SecondaryButton,
  SectionRule,
  Tap,
} from '../../../components/ui';
import { formatChord, keyPrefersFlats, transposeKey } from '../../../lib/chords';
import { slugify, toChordPro, toPlainText } from '../../../lib/chordpro';
import { goBack } from '../../../lib/nav';
import { emailFiles, shareTextFile, type PdfOptions } from '../../../lib/pdfDelivery';
import { sectionTitle } from '../../../lib/sections';
import { useCanEditSong, useSetlist, useSong, useStore } from '../../../lib/store';
import { font, palette, radius, sectionColors } from '../../../lib/theme';
import { formatDuration, type Setlist, type Song } from '../../../lib/types';

/**
 * The viewer — the screen the app exists for.
 *
 * Deliberately bare: no permanent toolbar, no chrome competing with the chart.
 * Every action lives behind one button, and that button is the only coloured
 * thing in the header so it stays findable in the dark.
 */
export default function Viewer() {
  // `setlist` is present only while a set is being played: it turns the viewer
  // from one chart into one stop along a running order.
  const { id, setlist: setlistId } = useLocalSearchParams<{ id: string; setlist?: string }>();
  const song = useSong(id);
  const settings = useStore((state) => state.settings);
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  const [semitones, setSemitones] = useState(0);
  const [sheet, setSheet] = useState<'options' | 'export' | 'setlist' | 'text' | null>(null);
  const [autoScroll, setAutoScroll] = useState(false);

  // Where the chart is and how much of it there is: the auto-scroll needs both
  // to spread a song over its own length, and reading them from the scroll
  // events keeps it out of the render path.
  const offset = useRef(0);
  const contentHeight = useRef(0);
  const viewportHeight = useRef(0);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const run = useSetRun(setlistId, id);

  // Reset the transposition when opening a different song.
  useEffect(() => setSemitones(0), [id]);

  // Every song in a set starts from its own first line.
  useEffect(() => {
    offset.current = 0;
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [id]);

  useEffect(() => {
    if (!settings.keepAwake) return;
    const tag = 'viewer';
    activateKeepAwakeAsync(tag).catch(() => {});
    return () => {
      deactivateKeepAwake(tag).catch?.(() => {});
    };
  }, [settings.keepAwake]);

  /**
   * How fast the chart should travel, in points per second.
   *
   * A song with a duration is the honest case: spread whatever is below the
   * fold over exactly that many seconds and the last line arrives as the song
   * ends, however long the chart happens to be. Without one there is nothing to
   * spread, so it falls back to the tempo — faster song, faster page.
   */
  const scrollSpeed = (travel: number) => {
    if (song?.duration && song.duration > 4 && travel > 0) return travel / song.duration;
    return Math.max(0.4, (song?.bpm ?? 90) / 90) * 19;
  };

  useEffect(() => {
    if (!autoScroll || !song) return;
    // Picks up where the reader left off instead of snapping back to the top.
    let y = offset.current;
    let last = Date.now();

    const timer = setInterval(() => {
      const now = Date.now();
      // Time-based, so a busy frame slows nothing down and a backgrounded
      // screen doesn't come back with a jump saved up.
      const elapsed = Math.min(0.25, (now - last) / 1000);
      last = now;

      const travel = Math.max(0, contentHeight.current - viewportHeight.current);
      if (travel <= 0) return;

      y = Math.min(travel, y + scrollSpeed(travel) * elapsed);
      scrollRef.current?.scrollTo({ y, animated: false });
      if (y >= travel) setAutoScroll(false);
    }, 32);

    return () => clearInterval(timer);
    // `id` restarts the run from the top when the set moves to the next song,
    // which two songs at the same tempo would otherwise skip.
  }, [autoScroll, song?.bpm, song?.duration, id]);

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

  const currentKey = transposeKey(song.key, semitones);
  const useFlats = keyPrefersFlats(currentKey);

  /** Moves the set to another song, in place — a set isn't a stack of screens. */
  const goToSong = (target: string | undefined) => {
    if (!target || !run) return;
    Haptics.selectionAsync().catch(() => {});
    router.replace({ pathname: '/song/[id]', params: { id: target, setlist: run.setlistId } });
  };

  /**
   * Swipe across the chart to move through the set. It has to share the screen
   * with a vertical scroll, so it only claims the gesture once the finger has
   * clearly gone sideways, and gives up the moment it goes down the page —
   * scrolling a long song must never be mistaken for changing songs.
   */
  const swipe = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!!run)
        .activeOffsetX([-28, 28])
        .failOffsetY([-18, 18])
        .runOnJS(true)
        .onEnd((event) => {
          if (!run) return;
          const far = Math.abs(event.translationX) > 60 || Math.abs(event.velocityX) > 550;
          if (!far) return;
          goToSong(event.translationX < 0 ? run.nextId : run.prevId);
        }),
    [run]
  );

  const onChartTouchStart = (event: GestureResponderEvent) => {
    if (autoScroll) setAutoScroll(false);
    const touch = event.nativeEvent.touches?.[0];
    touchStart.current = touch ? { x: touch.pageX, y: touch.pageY } : null;
  };

  /**
   * The same swipe, read straight off the touch on the web. A gesture handler
   * there has to take the touch away from the browser to watch it, which turns
   * the chart into a page that can't be scrolled with a finger — so on the web
   * the set is navigated by looking at where the touch ended instead, and the
   * browser keeps its scrolling.
   */
  const onChartTouchEnd = (event: GestureResponderEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (Platform.OS !== 'web' || !start || !run) return;

    const touch = event.nativeEvent.changedTouches?.[0];
    if (!touch) return;
    const dx = touch.pageX - start.x;
    const dy = touch.pageY - start.y;
    // Clearly sideways, and clearly not the beginning of a scroll.
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    goToSong(dx < 0 ? run.nextId : run.prevId);
  };

  const meta = [
    `Tono ${formatChord(currentKey, { notation: settings.notation })}`,
    song.bpm ? `${song.bpm} bpm` : null,
    formatDuration(song.duration),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <CircleButton
          label={run ? 'Torna alla scaletta' : 'Indietro'}
          onPress={() => goBack(run ? `/setlist/${run.setlistId}` : '/')}
        >
          <ChevronLeft size={18} color={palette.text} />
        </CircleButton>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {song.title || 'Senza titolo'}
          </Text>
          <Text style={styles.headerMeta} numberOfLines={1}>
            {meta}
          </Text>
        </View>

        <CircleButton label="Opzioni brano" tone="accent" onPress={() => setSheet('options')}>
          <Ellipsis size={18} color={palette.accentInk} />
        </CircleButton>
      </View>

      <Chart swipe={swipe} native={Platform.OS !== 'web'}>
        <ScrollView
          ref={scrollRef}
          style={styles.chart}
          contentContainerStyle={{
            paddingTop: 6,
            paddingHorizontal: 24,
            paddingBottom: (run ? 24 : insets.bottom + 40),
          }}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={(event) => {
            offset.current = event.nativeEvent.contentOffset.y;
          }}
          onLayout={(event) => {
            viewportHeight.current = event.nativeEvent.layout.height;
          }}
          onContentSizeChange={(_, height) => {
            contentHeight.current = height;
          }}
          onTouchStart={onChartTouchStart}
          onTouchEnd={onChartTouchEnd}
        >
          {song.sections.map((section, order) => (
            <Reveal key={section.id} delay={Math.min(order * 28, 140)} style={styles.section}>
              <SectionRule
                label={sectionTitle(section, song.sections)}
                color={sectionColors[section.kind]}
              />

              {section.dynamics ? (
                <View style={styles.dynamics}>
                  <DynamicsNote text={section.dynamics} />
                </View>
              ) : null}

              <View style={styles.lines}>
                {section.lines.map((line) => (
                  <React.Fragment key={line.id}>
                    <ChordLine
                      line={line}
                      notation={settings.notation}
                      semitones={semitones}
                      useFlats={useFlats}
                      fontScale={settings.fontScale}
                      showChords={settings.showChords}
                    />
                    {line.dynamics ? (
                      <View style={styles.lineDynamics}>
                        <DynamicsNote text={line.dynamics} />
                      </View>
                    ) : null}
                  </React.Fragment>
                ))}
              </View>
            </Reveal>
          ))}
        </ScrollView>
      </Chart>

      {run ? (
        <SetlistBar
          index={run.index}
          total={run.total}
          nextTitle={run.nextTitle}
          note={run.note}
          bottomInset={insets.bottom}
          onPrev={() => goToSong(run.prevId)}
          onNext={() => goToSong(run.nextId)}
        />
      ) : null}

      <OptionsSheet
        visible={sheet === 'options'}
        onClose={() => setSheet(null)}
        song={song}
        semitones={semitones}
        onTranspose={setSemitones}
        autoScroll={autoScroll}
        onToggleAutoScroll={() => {
          setAutoScroll((value) => !value);
          setSheet(null);
        }}
        onEdit={() => {
          setSheet(null);
          router.push(`/song/${song.id}/edit`);
        }}
        onExport={() => setSheet('export')}
        onAddToSetlist={() => setSheet('setlist')}
        onTextSize={() => setSheet('text')}
      />

      <ExportSheet
        visible={sheet === 'export'}
        onClose={() => setSheet(null)}
        song={song}
        semitones={semitones}
      />

      <SetlistSheet
        visible={sheet === 'setlist'}
        onClose={() => setSheet(null)}
        song={song}
      />

      <TextSizeSheet visible={sheet === 'text'} onClose={() => setSheet(null)} />
    </View>
  );
}

/**
 * The chart, wrapped in the swipe on the platforms where a gesture can share
 * the screen with a scroll.
 *
 * On the web it can't: to watch a finger the gesture handler has to take the
 * touch away from the browser, and a chart whose touches are claimed is a chart
 * that no longer scrolls. There the detector is left out and the swipe is read
 * from the touch events on the scroll view itself.
 */
function Chart({
  swipe,
  native,
  children,
}: {
  swipe: PanGesture;
  native: boolean;
  children: React.ReactElement;
}) {
  if (!native) return children;
  return <GestureDetector gesture={swipe}>{children}</GestureDetector>;
}

/**
 * Where the song on screen sits in the set being played, or null when it's
 * just being read on its own.
 *
 * The running order mixes songs and notes; only songs are counted, since "brano
 * 3 di 12" has to mean what a musician means by it. A note is carried along
 * with the song it follows, which is where it was written to be read.
 */
function useSetRun(setlistId: string | undefined, songId: string | undefined) {
  const setlist = useSetlist(setlistId);
  const songs = useStore((state) => state.songs);

  return useMemo(() => {
    if (!setlist || !songId) return null;

    const byId = new Map(songs.map((song) => [song.id, song]));
    const order: { song: Song; note?: string }[] = [];

    for (const item of setlist.items) {
      if (item.type === 'song') {
        const song = byId.get(item.songId);
        if (song) order.push({ song });
      } else if (order.length > 0 && !order[order.length - 1].note) {
        // A note belongs to the gap after the song above it.
        order[order.length - 1].note = item.text;
      }
    }

    const index = order.findIndex((entry) => entry.song.id === songId);
    if (index === -1 || order.length === 0) return null;

    return {
      setlistId: setlist.id,
      index,
      total: order.length,
      note: order[index].note,
      nextTitle: order[index + 1]?.song.title,
      prevId: order[index - 1]?.song.id,
      nextId: order[index + 1]?.song.id,
    };
  }, [setlist, songs, songId]);
}

/**
 * The one menu. Transposition sits at the top in a card of its own because it's
 * the thing you reach for mid-song; everything else is a plain row.
 */
function OptionsSheet({
  visible,
  onClose,
  song,
  semitones,
  onTranspose,
  autoScroll,
  onToggleAutoScroll,
  onEdit,
  onExport,
  onAddToSetlist,
  onTextSize,
}: {
  visible: boolean;
  onClose: () => void;
  song: Song;
  semitones: number;
  onTranspose: (value: number) => void;
  autoScroll: boolean;
  onToggleAutoScroll: () => void;
  onEdit: () => void;
  onExport: () => void;
  onAddToSetlist: () => void;
  onTextSize: () => void;
}) {
  const notation = useStore((state) => state.settings.notation);
  const current = transposeKey(song.key, semitones);
  // Transposing, auto-scroll and text size are how *you* read the song and
  // touch nobody else's copy, so they stay. Editing it is what doesn't.
  const canEdit = useCanEditSong(song);

  const step = (delta: number) => {
    Haptics.selectionAsync().catch(() => {});
    onTranspose(Math.max(-11, Math.min(11, semitones + delta)));
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Opzioni brano">
      <View style={styles.transposeCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.transposeTitle}>Trasponi</Text>
          <Text style={styles.transposeMeta}>
            originale {formatChord(song.key, { notation })} ·{' '}
            {semitones >= 0 ? '+' : ''}
            {semitones} semitoni
          </Text>
        </View>

        <Tap
          onPress={() => step(-1)}
          onLongPress={() => onTranspose(0)}
          accessibilityRole="button"
          accessibilityLabel="Un semitono più giù"
          style={styles.stepperKey}
        >
          <Minus size={18} color={palette.text} />
        </Tap>
        <Text style={styles.stepperValue}>{formatChord(current, { notation })}</Text>
        <Tap
          onPress={() => step(1)}
          onLongPress={() => onTranspose(0)}
          accessibilityRole="button"
          accessibilityLabel="Un semitono più su"
          style={styles.stepperKey}
        >
          <Plus size={18} color={palette.text} />
        </Tap>
      </View>

      <View style={styles.menu}>
        {canEdit ? (
          <SheetRow
            icon={<Pencil size={17} color={palette.accent} />}
            label="Modifica brano"
            onPress={onEdit}
          />
        ) : null}
        <SheetRow
          icon={<Export size={17} color={palette.accent} />}
          label="Esporta"
          onPress={onExport}
        />
        <SheetRow
          icon={<ListBullet size={17} color={palette.accent} />}
          label="Aggiungi a scaletta"
          onPress={onAddToSetlist}
        />
        <SheetRow
          icon={<AutoScroll size={17} color={palette.accent} />}
          label={autoScroll ? 'Ferma l’auto-scroll' : 'Auto-scroll'}
          // What is setting the pace, so it's clear which number to change if
          // the chart runs ahead of the band.
          value={
            (song.duration ? formatDuration(song.duration) : song.bpm ? `${song.bpm} bpm` : null) ??
            undefined
          }
          onPress={onToggleAutoScroll}
        />
        <SheetRow
          icon={<TextSize size={17} color={palette.accent} />}
          label="Dimensione testo"
          last
          onPress={onTextSize}
        />
      </View>
    </Sheet>
  );
}

function TextSizeSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const settings = useStore((state) => state.settings);
  const setSettings = useStore((state) => state.setSettings);

  return (
    <Sheet visible={visible} onClose={onClose} title="Lettura">
      <View style={styles.transposeCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.transposeTitle}>Dimensione testo</Text>
          <Text style={styles.transposeMeta}>
            {Math.round(settings.fontScale * 100)}% della misura di stampa
          </Text>
        </View>

        <Tap
          onPress={() => setSettings({ fontScale: Math.max(0.8, settings.fontScale - 0.1) })}
          accessibilityRole="button"
          accessibilityLabel="Riduci il testo"
          style={styles.stepperKey}
        >
          <Minus size={18} color={palette.text} />
        </Tap>
        <Tap
          onPress={() => setSettings({ fontScale: Math.min(1.8, settings.fontScale + 0.1) })}
          accessibilityRole="button"
          accessibilityLabel="Ingrandisci il testo"
          style={styles.stepperKey}
        >
          <Plus size={18} color={palette.text} />
        </Tap>
      </View>

      <View style={styles.optionRow}>
        <Chip
          label="C D E"
          active={settings.notation === 'anglo'}
          onPress={() => setSettings({ notation: 'anglo' })}
        />
        <Chip
          label="Do Re Mi"
          active={settings.notation === 'italiano'}
          onPress={() => setSettings({ notation: 'italiano' })}
        />
        <Chip
          label={settings.showChords ? 'Accordi visibili' : 'Solo testo'}
          active={settings.showChords}
          onPress={() => setSettings({ showChords: !settings.showChords })}
        />
      </View>
    </Sheet>
  );
}

function SetlistSheet({
  visible,
  onClose,
  song,
}: {
  visible: boolean;
  onClose: () => void;
  song: Song;
}) {
  const setlists = useStore((state) => state.setlists);
  const addToSetlist = useStore((state) => state.addToSetlist);
  const createSetlist = useStore((state) => state.createSetlist);

  const add = (setlist: Setlist) => {
    addToSetlist(setlist.id, {
      id: `${Date.now()}`,
      type: 'song',
      songId: song.id,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Aggiungi a scaletta">
      <View style={styles.menu}>
        {setlists.map((setlist, index) => (
          <SheetRow
            key={setlist.id}
            icon={<ListBullet size={17} color={palette.accent} />}
            label={setlist.name}
            value={`${setlist.items.filter((item) => item.type === 'song').length} brani`}
            last={index === setlists.length - 1}
            onPress={() => add(setlist)}
          />
        ))}
      </View>

      <PrimaryButton
        label="Nuova scaletta con questo brano"
        onPress={() => {
          const setlist = createSetlist({
            catalogId: song.catalogId,
            name: 'Nuova scaletta',
          });
          add(setlist);
          router.push(`/setlist/${setlist.id}`);
        }}
      />
    </Sheet>
  );
}

function ExportSheet({
  visible,
  onClose,
  song,
  semitones,
}: {
  visible: boolean;
  onClose: () => void;
  song: Song;
  semitones: number;
}) {
  const notation = useStore((state) => state.settings.notation);
  const [format, setFormat] = useState<'plain' | 'chordpro' | 'pdf'>('plain');
  const [chords, setChords] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const text = useMemo(
    () =>
      format === 'pdf'
        ? ''
        : format === 'plain'
          ? toPlainText(song, { semitones, notation, chords })
          : toChordPro(song, { semitones, notation: 'anglo' }),
    [song, semitones, notation, format, chords]
  );

  const copy = async () => {
    await Clipboard.setStringAsync(text);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setStatus('Copiato negli appunti');
    setTimeout(() => setStatus(null), 2200);
  };

  const share = async () => {
    const extension = format === 'plain' ? 'txt' : 'cho';
    const result = await shareTextFile(`${slugify(song.title)}.${extension}`, text);
    if (result) setStatus(result);
    else Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  const deliver = async (action: (songs: Song[], options: PdfOptions) => Promise<string>) => {
    setWorking(true);
    setStatus(null);
    const result = await action([song], { notation, semitones, chords });
    setWorking(false);
    if (result) setStatus(result);
    else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onClose();
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Esporta"
      subtitle={
        semitones === 0
          ? 'Nella tonalità originale'
          : `Trasportato di ${semitones > 0 ? '+' : ''}${semitones} semitoni`
      }
    >
      <View style={styles.optionRow}>
        <Chip
          label="Testo"
          active={format === 'plain'}
          onPress={() => setFormat('plain')}
        />
        <Chip
          label="ChordPro"
          active={format === 'chordpro'}
          onPress={() => setFormat('chordpro')}
        />
        <Chip label="PDF" active={format === 'pdf'} onPress={() => setFormat('pdf')} />
      </View>

      {format !== 'chordpro' ? (
        <View style={styles.optionRow}>
          <Chip label="Con accordi" active={chords} onPress={() => setChords(true)} />
          <Chip label="Solo testo" active={!chords} onPress={() => setChords(false)} />
        </View>
      ) : null}

      {format === 'pdf' ? (
        <Text style={styles.pdfHint}>
          Il brano impaginato su due colonne, come nella vista accordi, con numeri di pagina.
        </Text>
      ) : (
        <View style={styles.preview}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} nestedScrollEnabled>
            <Text style={styles.previewText}>{text}</Text>
          </ScrollView>
        </View>
      )}

      {status ? <Text style={styles.status}>{status}</Text> : null}

      <View style={{ flexDirection: 'row', gap: 8 }}>
        {format === 'pdf' ? (
          <PrimaryButton
            label="Esporta"
            onPress={() => deliver(emailFiles)}
            disabled={working}
            style={{ flex: 1 }}
          />
        ) : (
          <>
            <SecondaryButton label="Copia" onPress={copy} style={{ flex: 1 }} />
            <PrimaryButton label="Condividi" onPress={share} style={{ flex: 1 }} />
          </>
        )}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: font.displaySemi,
    fontSize: 14,
    color: palette.text,
  },
  chart: {
    // Without this the chart is sized by its own content, so a long song grows
    // past the bottom of the screen instead of scrolling inside it — and takes
    // the setlist bar with it.
    flex: 1,
  },
  headerMeta: {
    fontFamily: font.meta,
    fontSize: 11,
    color: palette.textFaint,
    marginTop: 2,
  },
  section: {
    marginBottom: 32,
  },
  dynamics: {
    marginTop: 3,
    marginBottom: 12,
  },
  lineDynamics: {
    marginTop: 2,
    marginBottom: 4,
  },
  lines: {
    gap: 8,
    marginTop: 12,
  },
  transposeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: palette.surface,
    borderRadius: radius.cardLg,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  transposeTitle: {
    fontFamily: font.displaySemi,
    fontSize: 14,
    color: palette.text,
  },
  transposeMeta: {
    fontFamily: font.meta,
    fontSize: 11,
    color: palette.textDim,
    marginTop: 2,
  },
  stepperKey: {
    width: 34,
    height: 34,
    borderRadius: radius.pillule,
    backgroundColor: palette.surfaceControlHi,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    width: 34,
    textAlign: 'center',
    fontFamily: font.display,
    fontSize: 16,
    color: palette.accent,
  },
  menu: {
    backgroundColor: palette.surfaceRaised,
    borderRadius: radius.cardLg,
    overflow: 'hidden',
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  preview: {
    backgroundColor: palette.surface,
    borderRadius: radius.field,
    padding: 12,
    maxHeight: 190,
  },
  previewText: {
    fontFamily: font.mono,
    fontSize: 11,
    lineHeight: 16,
    color: palette.textMuted,
  },
  pdfHint: {
    fontFamily: font.meta,
    fontSize: 12.5,
    lineHeight: 18,
    color: palette.textFaint,
  },
  status: {
    fontFamily: font.metaSemi,
    fontSize: 12.5,
    color: palette.accent,
  },
});
