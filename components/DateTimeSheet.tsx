import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { dayKey, formatDay, formatGigDate } from '../lib/types';
import { Sheet } from './Sheet';
import { Wheel } from './Wheel';
import { PillButton, PrimaryButton } from './ui';

/**
 * Quando si suona. Tre colonne — il giorno per intero, l'ora, i minuti —
 * invece di giorno, mese e anno separati: un mese ha un numero di giorni che
 * dipende dal mese, e nessuno segna una prova fra due anni.
 *
 * Le ruote stanno per conto loro perché servono in due posti: dentro lo sheet
 * di un evento, dove sono in mezzo agli altri campi, e da sole sopra una
 * scaletta, dove lo sheet ci vuole.
 */

const HOURS = Array.from({ length: 24 }, (_, index) => ({
  value: index,
  label: String(index).padStart(2, '0'),
}));

/** Di cinque in cinque: le prove iniziano alle 21, non alle 21:07. */
const MINUTES = Array.from({ length: 12 }, (_, index) => ({
  value: index * 5,
  label: String(index * 5).padStart(2, '0'),
}));

const DAYS_AHEAD = 400;
const DAYS_BACK = 30;

const pad = (value: number) => String(value).padStart(2, '0');

/** Le 21 di stasera — il valore di partenza quando una data non c'è ancora. */
export function tonight(): string {
  return `${dayKey(new Date())}T21:00:00`;
}

export function DateTimeWheels({
  value,
  onChange,
}: {
  /** ISO locale, `AAAA-MM-GGTHH:MM:00`. */
  value: string;
  onChange: (iso: string) => void;
}) {
  const date = new Date(value);
  const valid = Number.isNaN(date.getTime()) ? new Date() : date;
  const day = dayKey(valid);

  // La finestra parte dal più indietro fra oggi e il giorno già scelto, così
  // una data vecchia che si sta correggendo è sempre in mezzo alle scelte.
  const days = useMemo(() => {
    const first = new Date();
    first.setHours(0, 0, 0, 0);
    if (valid < first) first.setTime(valid.getTime());
    first.setDate(first.getDate() - DAYS_BACK);

    return Array.from({ length: DAYS_BACK + DAYS_AHEAD }, (_, index) => {
      const entry = new Date(first);
      entry.setDate(entry.getDate() + index);
      return { value: dayKey(entry), label: formatDay(entry) };
    });
  }, [day]);

  const hour = valid.getHours();
  const minute = Math.round(valid.getMinutes() / 5) * 5;

  return (
    <View style={styles.wheels}>
      <Wheel
        label="giorno"
        data={days}
        value={day}
        onChange={(next) => onChange(`${next}T${pad(hour)}:${pad(minute % 60)}:00`)}
        style={{ flex: 2 }}
      />
      <Wheel
        label="ora"
        data={HOURS}
        value={hour}
        onChange={(next) => onChange(`${day}T${pad(next)}:${pad(minute % 60)}:00`)}
        style={{ flex: 1 }}
      />
      <Wheel
        label="minuti"
        data={MINUTES}
        value={minute % 60}
        onChange={(next) => onChange(`${day}T${pad(hour)}:${pad(next)}:00`)}
        style={{ flex: 1 }}
      />
    </View>
  );
}

/** Le stesse ruote da sole, per dare una data a una scaletta. */
export function DateTimeSheet({
  visible,
  onClose,
  value,
  onChange,
  title = 'Quando',
}: {
  visible: boolean;
  onClose: () => void;
  /** ISO di partenza, o niente per una data mai impostata. */
  value?: string;
  /** L'ISO scelto, o `undefined` se la data è stata tolta. */
  onChange: (iso: string | undefined) => void;
  title?: string;
}) {
  const [draft, setDraft] = useState(tonight);

  // Una copia di lavoro: diventa la data solo su "Fatto", così passarci sopra
  // girando la ruota non scrive niente.
  useEffect(() => {
    if (visible) setDraft(value ?? tonight());
  }, [visible, value]);

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={title}
      subtitle={formatGigDate(draft) ?? ''}
      scroll={false}
      footer={
        <View style={styles.footer}>
          <PillButton
            label="Nessuna data"
            onPress={() => {
              onChange(undefined);
              onClose();
            }}
            style={{ flex: 1 }}
          />
          <PrimaryButton
            label="Fatto"
            onPress={() => {
              onChange(draft);
              onClose();
            }}
            style={{ flex: 1 }}
          />
        </View>
      }
    >
      <DateTimeWheels value={draft} onChange={setDraft} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  wheels: {
    flexDirection: 'row',
    gap: 8,
  },
  footer: {
    flexDirection: 'row',
    gap: 8,
  },
});
