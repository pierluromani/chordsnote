import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { DateTimeWheels, tonight } from '../../../components/DateTimeSheet';
import { Sheet } from '../../../components/Sheet';
import {
  ChevronLeft,
  ChevronRight,
  Place,
  Plus,
  Setlists,
  Trash,
} from '../../../components/icons';
import {
  Chip,
  CircleButton,
  DashedButton,
  EmptyState,
  Eyebrow,
  PillButton,
  PrimaryButton,
  Tap,
} from '../../../components/ui';
import type { AgendaEntry } from '../../../lib/agenda';
import { deleteEvent, saveEvent, useBandPulse } from '../../../lib/bandEvents';
import { goBack } from '../../../lib/nav';
import { useCanEdit, useCatalog, useStore } from '../../../lib/store';
import { font, palette, radius } from '../../../lib/theme';
import {
  EVENT_LABELS,
  dayKey,
  formatMonth,
  formatTime,
  weekdayShort,
  type BandEventKind,
} from '../../../lib/types';

/** Lunedì per primo, come su ogni calendario appeso a un muro in Italia. */
const WEEKDAYS = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];

const KINDS: BandEventKind[] = ['gig', 'rehearsal', 'other'];

type Draft = {
  id?: string;
  kind: BandEventKind;
  title: string;
  at: string;
  place: string;
  note: string;
  setlistId?: string;
};

/**
 * Le date della band: il mese in griglia e, sotto, cosa c'è dentro. Prove e
 * concerti stanno insieme alle scalette che hanno già una data — sono la
 * stessa cosa vista da due parti, e una scaletta collegata a un evento compare
 * una volta sola.
 */
export default function BandCalendar() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();

  const catalog = useCatalog(id);
  const canEdit = useCanEdit(id);
  const setlists = useStore((state) => state.setlists);

  const shared = !!catalog?.ownerUid;
  const { agenda, events } = useBandPulse(catalog?.id, shared);

  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const today = dayKey(new Date());

  /** Che tipo di data cade in ogni giorno: serve al pallino sotto il numero. */
  const marks = useMemo(() => {
    const byDay = new Map<string, BandEventKind>();
    for (const entry of agenda) {
      const key = dayKey(new Date(entry.at));
      // Un concerto vince sulla prova: se in un giorno c'è entrambi, il
      // pallino è quello che fa alzare presto la mattina dopo.
      if (entry.kind === 'gig' || !byDay.has(key)) byDay.set(key, entry.kind);
    }
    return byDay;
  }, [agenda]);

  const cells = useMemo(() => monthCells(cursor), [cursor]);

  const month = cursor.getMonth();
  const year = cursor.getFullYear();
  const inMonth = agenda.filter((entry) => {
    const date = new Date(entry.at);
    return date.getMonth() === month && date.getFullYear() === year;
  });

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

  const step = (by: -1 | 1) => setCursor(new Date(year, month + by, 1));

  const openNew = (day?: string) =>
    setDraft({
      kind: 'rehearsal',
      title: '',
      at: day ? `${day}T21:00:00` : tonight(),
      place: '',
      note: '',
    });

  const openEntry = (entry: AgendaEntry) => {
    // Una scaletta datata si modifica dalla scaletta, non da qui.
    if (entry.fromSetlist) {
      router.push(`/setlist/${entry.setlistId}`);
      return;
    }
    const event = events.find((candidate) => candidate.id === entry.id);
    if (!event || !canEdit) return;
    setDraft({
      id: event.id,
      kind: event.kind,
      title: event.title,
      at: event.at,
      place: event.place ?? '',
      note: event.note ?? '',
      setlistId: event.setlistId,
    });
  };

  const save = async () => {
    if (!draft || !draft.title.trim()) return;
    setDraft(null);
    await saveEvent(catalog.id, {
      id: draft.id,
      kind: draft.kind,
      title: draft.title,
      at: draft.at,
      place: draft.place,
      note: draft.note,
      setlistId: draft.setlistId,
    }).catch(() => undefined);
  };

  const bandSetlists = setlists.filter((setlist) => setlist.catalogId === catalog.id);

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <CircleButton label="Indietro" onPress={() => goBack(`/band/${catalog.id}`)}>
          <ChevronLeft size={18} color={palette.text} />
        </CircleButton>
        <Text style={styles.headerTitle}>Calendario</Text>
        {canEdit && shared ? (
          <CircleButton label="Segna una data" onPress={() => openNew()}>
            <Plus size={17} color={palette.text} />
          </CircleButton>
        ) : (
          <View style={{ width: 36 }} />
        )}
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 6,
          paddingBottom: insets.bottom + 40,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.monthBar}>
          <Tap
            onPress={() => step(-1)}
            accessibilityRole="button"
            accessibilityLabel="Mese precedente"
            hitSlop={12}
          >
            <ChevronLeft size={18} color={palette.textFaint} />
          </Tap>
          <Text style={styles.monthName}>{formatMonth(year, month)}</Text>
          <Tap
            onPress={() => step(1)}
            accessibilityRole="button"
            accessibilityLabel="Mese successivo"
            hitSlop={12}
          >
            <ChevronRight size={18} color={palette.textFaint} />
          </Tap>
        </View>

        <View style={styles.calendar}>
          <View style={styles.week}>
            {WEEKDAYS.map((letter, index) => (
              <Text key={index} style={styles.weekday}>
                {letter}
              </Text>
            ))}
          </View>

          <View style={styles.days}>
            {cells.map((date) => {
              const key = dayKey(date);
              const mark = marks.get(key);
              const outside = date.getMonth() !== month;

              return (
                <Tap
                  key={key}
                  onPress={canEdit && shared ? () => openNew(key) : undefined}
                  disabled={!canEdit || !shared}
                  accessibilityRole="button"
                  accessibilityLabel={`${date.getDate()} ${formatMonth(
                    date.getFullYear(),
                    date.getMonth()
                  )}`}
                  style={styles.day}
                >
                  <View style={[styles.dayNumber, key === today && styles.dayToday]}>
                    <Text
                      style={[
                        styles.dayText,
                        outside && { color: palette.textGhost },
                        key === today && { color: palette.accentInk },
                      ]}
                    >
                      {date.getDate()}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.dot,
                      !mark && { opacity: 0 },
                      mark && mark !== 'gig' && { backgroundColor: palette.textGhost },
                    ]}
                  />
                </Tap>
              );
            })}
          </View>
        </View>

        <Eyebrow style={styles.groupLabel}>{formatMonth(year, month)}</Eyebrow>

        {inMonth.length === 0 ? (
          <Text style={styles.empty}>Nessuna data in questo mese.</Text>
        ) : (
          inMonth.map((entry) => (
            <Tap
              key={entry.id}
              onPress={() => openEntry(entry)}
              accessibilityRole="button"
              accessibilityLabel={`${entry.title}, ${EVENT_LABELS[entry.kind]}`}
              style={styles.entry}
            >
              <View style={styles.dateBlock}>
                <Text style={styles.dateNumber}>{new Date(entry.at).getDate()}</Text>
                <Text style={styles.dateWeekday}>{weekdayShort(entry.at)}</Text>
              </View>

              <View style={{ flex: 1 }}>
                <View style={styles.entryKind}>
                  <Text
                    style={[
                      styles.kindText,
                      entry.kind === 'gig' && { color: palette.accent },
                    ]}
                  >
                    {entry.fromSetlist ? 'Scaletta con data' : EVENT_LABELS[entry.kind]}
                  </Text>
                </View>
                <Text style={styles.entryTitle} numberOfLines={2}>
                  {entry.title}
                </Text>
                <Text style={styles.entryMeta} numberOfLines={1}>
                  {[formatTime(entry.at), entry.place].filter(Boolean).join(' · ')}
                </Text>

                {entry.setlistId && !entry.fromSetlist ? (
                  <Tap
                    onPress={() => router.push(`/setlist/${entry.setlistId}`)}
                    accessibilityRole="button"
                    accessibilityLabel="Apri la scaletta"
                    style={styles.entryLink}
                  >
                    <Setlists size={14} color={palette.textMuted} strokeWidth={1.8} />
                    <Text style={styles.entryLinkText} numberOfLines={1}>
                      {setlists.find((setlist) => setlist.id === entry.setlistId)?.name ??
                        'Scaletta'}
                    </Text>
                    <ChevronRight size={14} color={palette.textGhost} strokeWidth={1.6} />
                  </Tap>
                ) : null}
              </View>
            </Tap>
          ))
        )}

        {canEdit && shared ? (
          <DashedButton
            label="Segna una data"
            icon={<Plus size={17} color={palette.textFaint} />}
            onPress={() => openNew()}
          />
        ) : null}

        {!shared ? (
          <Text style={styles.footnote}>
            Questa band vive soltanto su questo dispositivo: le date restano qui e nessuno le
            vede. Accedi al tuo account per condividerle con chi suona con te.
          </Text>
        ) : null}
      </ScrollView>

      {/* --------------------------------------------------------- L'evento */}

      <Sheet
        visible={!!draft}
        onClose={() => setDraft(null)}
        title={draft?.id ? 'Modifica la data' : 'Segna una data'}
        subtitle={draft ? EVENT_LABELS[draft.kind] : ''}
        footer={
          <View style={styles.footer}>
            {draft?.id ? (
              <PillButton
                label="Elimina"
                onPress={() => setConfirmDelete(draft.id ?? null)}
                style={{ flex: 1 }}
              />
            ) : null}
            <PrimaryButton
              label="Salva"
              onPress={() => void save()}
              disabled={!draft?.title.trim()}
              style={{ flex: 1 }}
            />
          </View>
        }
      >
        {draft ? (
          <View style={styles.form}>
            <View style={styles.kinds}>
              {KINDS.map((kind) => (
                <Chip
                  key={kind}
                  label={EVENT_LABELS[kind]}
                  active={draft.kind === kind}
                  onPress={() => setDraft({ ...draft, kind })}
                />
              ))}
            </View>

            <TextInput
              value={draft.title}
              onChangeText={(title) => setDraft({ ...draft, title })}
              placeholder={draft.kind === 'gig' ? 'Live al Circolo Zeta' : 'Prova generale'}
              placeholderTextColor={palette.textGhost}
              accessibilityLabel="Che cosa è"
              style={styles.input}
            />

            <View style={styles.inputRow}>
              <Place size={16} color={palette.textFaint} strokeWidth={1.8} />
              <TextInput
                value={draft.place}
                onChangeText={(place) => setDraft({ ...draft, place })}
                placeholder="Dove"
                placeholderTextColor={palette.textGhost}
                accessibilityLabel="Dove"
                style={styles.inputInline}
              />
            </View>

            <DateTimeWheels value={draft.at} onChange={(at) => setDraft({ ...draft, at })} />

            {bandSetlists.length > 0 ? (
              <>
                <Eyebrow>Scaletta</Eyebrow>
                <View style={styles.setlistPicker}>
                  <Chip
                    label="Nessuna"
                    active={!draft.setlistId}
                    onPress={() => setDraft({ ...draft, setlistId: undefined })}
                  />
                  {bandSetlists.map((setlist) => (
                    <Chip
                      key={setlist.id}
                      label={setlist.name}
                      active={draft.setlistId === setlist.id}
                      onPress={() => setDraft({ ...draft, setlistId: setlist.id })}
                    />
                  ))}
                </View>
              </>
            ) : null}

            <TextInput
              value={draft.note}
              onChangeText={(note) => setDraft({ ...draft, note })}
              placeholder="Una nota: ritrovo alle 19, si porta il furgone…"
              placeholderTextColor={palette.textGhost}
              multiline
              textAlignVertical="top"
              accessibilityLabel="Nota"
              style={[styles.input, styles.inputTall]}
            />
          </View>
        ) : null}
      </Sheet>

      <ConfirmDialog
        visible={confirmDelete !== null}
        title="Togliere questa data?"
        message="Sparisce dal calendario di tutta la band."
        confirmLabel="Elimina"
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          const eventId = confirmDelete;
          setConfirmDelete(null);
          setDraft(null);
          if (eventId) void deleteEvent(catalog.id, eventId).catch(() => undefined);
        }}
      />
    </View>
  );
}

/**
 * Le 42 caselle del mese, lunedì per primo. Sempre sei righe: una griglia che
 * cambia altezza fra un mese e l'altro fa saltare tutto quello che ha sotto.
 */
function monthCells(cursor: Date): Date[] {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  // getDay() dà 0 per domenica; qui la settimana comincia di lunedì.
  const lead = (first.getDay() + 6) % 7;

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(first);
    date.setDate(1 - lead + index);
    return date;
  });
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
  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 2,
  },
  monthName: {
    fontFamily: font.displaySemi,
    fontSize: 17,
    letterSpacing: -0.2,
    color: palette.text,
  },
  calendar: {
    backgroundColor: palette.surface,
    borderRadius: radius.cardLg,
    paddingHorizontal: 10,
    paddingTop: 12,
    paddingBottom: 8,
    marginBottom: 22,
  },
  week: {
    flexDirection: 'row',
    paddingBottom: 6,
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontFamily: font.monoSemi,
    fontSize: 10,
    color: palette.textFainter,
  },
  days: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  day: {
    width: `${100 / 7}%`,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  dayNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayToday: {
    backgroundColor: palette.text,
  },
  dayText: {
    fontFamily: font.mono,
    fontSize: 13,
    color: palette.textSecondary,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: palette.accent,
  },
  groupLabel: {
    marginBottom: 9,
  },
  empty: {
    fontFamily: font.meta,
    fontSize: 13,
    color: palette.textFaint,
    marginBottom: 14,
  },
  entry: {
    flexDirection: 'row',
    gap: 14,
    backgroundColor: palette.surface,
    borderRadius: radius.cardLg,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  dateBlock: {
    width: 40,
    alignItems: 'center',
  },
  dateNumber: {
    fontFamily: font.monoBold,
    fontSize: 20,
    letterSpacing: -0.4,
    color: palette.text,
  },
  dateWeekday: {
    fontFamily: font.monoSemi,
    fontSize: 9.5,
    letterSpacing: 0.6,
    color: palette.textFainter,
  },
  entryKind: {
    flexDirection: 'row',
  },
  kindText: {
    fontFamily: font.metaSemi,
    fontSize: 10.5,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: palette.textFaint,
  },
  entryTitle: {
    fontFamily: font.displaySemi,
    fontSize: 15.5,
    color: palette.text,
    marginTop: 2,
  },
  entryMeta: {
    fontFamily: font.meta,
    fontSize: 12.5,
    color: palette.textDim,
    marginTop: 1,
  },
  entryLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 9,
    paddingTop: 9,
    borderTopWidth: 1,
    borderTopColor: palette.borderCard,
  },
  entryLinkText: {
    flex: 1,
    fontFamily: font.meta,
    fontSize: 12.5,
    color: palette.textMuted,
  },
  footnote: {
    fontFamily: font.meta,
    fontSize: 11.5,
    lineHeight: 17,
    color: palette.textFaint,
    marginTop: 12,
  },
  form: {
    gap: 12,
  },
  kinds: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    fontFamily: font.meta,
    fontSize: 15,
    color: palette.text,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.borderControl,
    borderRadius: radius.field,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inputTall: {
    minHeight: 70,
    fontSize: 13.5,
    lineHeight: 20,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.borderControl,
    borderRadius: radius.field,
    paddingHorizontal: 14,
  },
  inputInline: {
    flex: 1,
    fontFamily: font.meta,
    fontSize: 15,
    color: palette.text,
    paddingVertical: 12,
  },
  setlistPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  footer: {
    flexDirection: 'row',
    gap: 8,
  },
});
