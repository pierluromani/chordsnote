import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { font, palette, radius, shadow } from '../lib/theme';
import { Close } from './icons';
import { Tap } from './ui';

/**
 * The app's one modal surface: a card that floats clear of the screen edges
 * rather than a full-width tray. Keeping 14 pt of the chart visible down both
 * sides is deliberate — you never lose the page you were reading while you
 * change a setting on it.
 */
export function Sheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
  footer,
  scroll = true,
  maxHeightRatio = 0.82,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  /** Pinned under the scrolling body — an action that must never scroll away. */
  footer?: React.ReactNode;
  scroll?: boolean;
  maxHeightRatio?: number;
}) {
  const insets = useSafeAreaInsets();
  // Measured against the window rather than the parent: a percentage here would
  // resolve against a box that is itself sized by this content.
  const { height } = useWindowDimensions();

  // A small rise-and-fade for the card itself, layered under the Modal's own
  // fade — subtler than one big directional slide, and it replays every time
  // the sheet opens since the children stay mounted between opens.
  const rise = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible) {
      rise.setValue(0);
      Animated.timing(rise, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [visible, rise]);

  const body = <View style={styles.body}>{children}</View>;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Chiudi"
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          pointerEvents="box-none"
        >
          <Animated.View
            style={[
              styles.sheet,
              {
                marginBottom: Math.max(insets.bottom, 10) + 14,
                maxHeight: height * maxHeightRatio,
                opacity: rise,
                transform: [
                  {
                    translateY: rise.interpolate({
                      inputRange: [0, 1],
                      outputRange: [10, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{title}</Text>
                {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
              </View>
              <Tap
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Chiudi"
                hitSlop={12}
              >
                <Close size={19} color={palette.textFaint} />
              </Tap>
            </View>

            {scroll ? (
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                // Size to the content, not to the available space, so a short
                // menu stays a short card instead of stretching to the cap —
                // but shrink when there's a footer, which outranks the body.
                style={{ flexGrow: 0, flexShrink: 1 }}
              >
                {body}
              </ScrollView>
            ) : (
              body
            )}

            {footer ? <View style={styles.footer}>{footer}</View> : null}
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

/** One row of a sheet menu: accent glyph, label, optional trailing value. */
export function SheetRow({
  icon,
  label,
  value,
  onPress,
  last,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  onPress?: () => void;
  last?: boolean;
  danger?: boolean;
}) {
  return (
    <Tap
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
      style={[styles.row, !last && styles.rowBorder]}
    >
      <View style={styles.rowIcon}>{icon}</View>
      <Text style={[styles.rowLabel, danger && { color: palette.accent }]} numberOfLines={1}>
        {label}
      </Text>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
    </Tap>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    marginHorizontal: 14,
    backgroundColor: palette.surfaceRaised,
    borderWidth: 1,
    borderColor: palette.borderControl,
    borderRadius: radius.sheet,
    padding: 8,
    ...shadow.sheet,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingTop: 10,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  title: {
    fontFamily: font.display,
    fontSize: 13,
    color: palette.text,
  },
  subtitle: {
    fontFamily: font.meta,
    fontSize: 11.5,
    color: palette.textDim,
    marginTop: 3,
  },
  body: {
    gap: 10,
    paddingBottom: 4,
  },
  footer: {
    paddingTop: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#EFE9E5',
  },
  rowIcon: {
    width: 18,
    alignItems: 'center',
  },
  rowLabel: {
    flex: 1,
    fontFamily: font.displayMid,
    fontSize: 15,
    color: palette.text,
  },
  rowValue: {
    fontFamily: font.meta,
    fontSize: 12,
    color: palette.textFaint,
  },
});
