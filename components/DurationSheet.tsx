import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { formatDuration } from '../lib/types';
import { Sheet } from './Sheet';
import { Wheel } from './Wheel';
import { PillButton, PrimaryButton } from './ui';

/** Longer than any song anybody puts in a set — jams included. */
const MINUTES = Array.from({ length: 31 }, (_, index) => ({
  value: index,
  label: String(index),
}));
const SECONDS = Array.from({ length: 60 }, (_, index) => ({
  value: index,
  label: String(index).padStart(2, '0'),
}));

/**
 * Two wheels for a song's length, minutes and seconds, the way a clock is set
 * everywhere else on the phone.
 */
export function DurationSheet({
  visible,
  onClose,
  seconds,
  onChange,
}: {
  visible: boolean;
  onClose: () => void;
  /** The duration as stored, or nothing if the song has never had one. */
  seconds?: number;
  onChange: (seconds: number | undefined) => void;
}) {
  const [minutes, setMinutes] = useState(0);
  const [rest, setRest] = useState(0);

  // The wheels are a working copy: they only become the song's duration on
  // "Fatto", so spinning past a value doesn't write it on the way through.
  useEffect(() => {
    if (!visible) return;
    setMinutes(Math.min(30, Math.floor((seconds ?? 0) / 60)));
    setRest(Math.round((seconds ?? 0) % 60));
  }, [visible, seconds]);

  const total = minutes * 60 + rest;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Durata"
      subtitle={formatDuration(total) ?? 'Nessuna durata'}
      scroll={false}
      footer={
        <View style={styles.footer}>
          <PillButton
            label="Nessuna"
            onPress={() => {
              onChange(undefined);
              onClose();
            }}
            style={{ flex: 1 }}
          />
          <PrimaryButton
            label="Fatto"
            onPress={() => {
              onChange(total > 0 ? total : undefined);
              onClose();
            }}
            style={{ flex: 1 }}
          />
        </View>
      }
    >
      <View style={styles.wheels}>
        <Wheel label="minuti" data={MINUTES} value={minutes} onChange={setMinutes} />
        <Wheel label="secondi" data={SECONDS} value={rest} onChange={setRest} />
      </View>
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
