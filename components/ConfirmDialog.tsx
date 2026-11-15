import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { font, palette, radius, shadow } from '../lib/theme';
import { Trash } from './icons';
import { Tap } from './ui';

/**
 * The app's destructive confirmation popup — a small centered card that floats
 * over whatever you were doing, rather than a full-width tray. It exists
 * because `Alert.alert` does nothing on the web build (see Sheet's note), so
 * every irreversible delete funnels through one place that works everywhere.
 *
 * The card follows the "Palco" convention: the accent glyph and the confirm
 * button carry the only colour (the destructive red), the cancel sits quiet
 * beside it, and the copy says plainly what is about to be lost.
 */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Elimina',
  cancelLabel = 'Annulla',
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel={cancelLabel}
        />
        <View style={styles.card}>
          <Trash size={20} color={palette.accent} />
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            <Tap
              onPress={onCancel}
              accessibilityRole="button"
              accessibilityLabel={cancelLabel}
              style={[styles.button, styles.cancel]}
            >
              <Text style={styles.cancelText}>{cancelLabel}</Text>
            </Tap>
            <Tap
              onPress={onConfirm}
              accessibilityRole="button"
              accessibilityLabel={confirmLabel}
              style={[styles.button, styles.confirm]}
            >
              <Text style={styles.confirmText}>{confirmLabel}</Text>
            </Tap>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: palette.surfaceRaised,
    borderWidth: 1,
    borderColor: palette.borderControl,
    borderRadius: radius.sheet,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 18,
    alignItems: 'center',
    ...shadow.sheet,
  },
  title: {
    fontFamily: font.display,
    fontSize: 16,
    color: palette.text,
    textAlign: 'center',
    marginTop: 12,
  },
  message: {
    fontFamily: font.meta,
    fontSize: 13.5,
    lineHeight: 20,
    color: palette.textSecondary,
    textAlign: 'center',
    marginTop: 7,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    alignSelf: 'stretch',
    marginTop: 22,
  },
  button: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: radius.cardLg,
  },
  cancel: {
    backgroundColor: palette.surfaceControl,
  },
  cancelText: {
    fontFamily: font.displaySemi,
    fontSize: 14,
    color: palette.textMuted,
  },
  confirm: {
    backgroundColor: palette.accent,
  },
  confirmText: {
    fontFamily: font.display,
    fontSize: 14,
    color: palette.accentInk,
  },
});
