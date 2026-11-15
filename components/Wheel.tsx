import WheelPicker from '@quidone/react-native-wheel-picker';
import * as Haptics from 'expo-haptics';
import React, { useRef } from 'react';
import { Platform, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { font, palette, radius } from '../lib/theme';

/** Height of one row on the wheel, and so the length of one click. */
export const WHEEL_ITEM_HEIGHT = 40;

export type WheelItem<T extends string | number> = { value: T; label: string };

/**
 * One spinning column of values, the way a time is set on a phone: the rows
 * roll under a fixed window, the one in the middle is the one you get, and it
 * lands on a value rather than stopping wherever the finger let go.
 *
 * The wheel itself is the platform's — a native scroll view with the rows
 * turned on their axis — so the weight and the inertia are the device's own.
 */
export function Wheel<T extends string | number>({
  label,
  data,
  value,
  onChange,
  style,
  itemHeight = WHEEL_ITEM_HEIGHT,
  visibleItemCount = 5,
  testID,
}: {
  /** Small caption over the column, naming what it sets. */
  label: string;
  data: WheelItem<T>[];
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
  itemHeight?: number;
  visibleItemCount?: number;
  testID?: string;
}) {
  const root = useRef<View | null>(null);
  const list = useRef<HTMLElement | null>(null);

  /**
   * The click into place at the end of a spin.
   *
   * The wheel asks its scroll view to stop on multiples of the row height, but
   * on the web that request is dropped — react-native-web only snaps when a
   * scroll view is paging, and paging by whole screens is not what a wheel
   * does. Left alone the rows halt wherever the finger let go, straddling two
   * of them. So on the web the last few pixels are travelled by hand, once the
   * wheel has come to rest.
   */
  const settle = () => {
    if (Platform.OS !== 'web') return;
    if (!list.current?.isConnected) {
      const node = root.current as unknown as HTMLElement | null;
      list.current =
        [...(node?.querySelectorAll<HTMLElement>('div') ?? [])].find(
          (element) => element.scrollHeight > element.clientHeight + 8
        ) ?? null;
    }
    const element = list.current;
    if (!element) return;

    const target = Math.round(element.scrollTop / itemHeight) * itemHeight;
    // Already on a value: leaving it alone keeps a tap from being nudged, and
    // stops the scroll this very call would cause from asking for another one.
    if (Math.abs(target - element.scrollTop) < 1) return;
    // `scroll`, not `scrollTo`: react-native-web replaces `scrollTo` on the
    // node with its own `{x, y, animated}` version, which reads `top` as
    // nothing and glides the wheel back to zero.
    element.scroll({ top: target, behavior: 'smooth' });
  };

  return (
    <View style={[styles.column, style]} ref={root}>
      <Text style={styles.label}>{label}</Text>
      <WheelPicker
        data={data}
        value={value}
        itemHeight={itemHeight}
        visibleItemCount={visibleItemCount}
        // One tick per row as it goes by, the way a real wheel would feel.
        onValueChanging={() => {
          Haptics.selectionAsync().catch(() => {});
        }}
        onValueChanged={({ item }) => onChange(item.value)}
        _onScrollEnd={settle}
        enableScrollByTapOnItem
        itemTextStyle={styles.item}
        overlayItemStyle={styles.window}
        testID={testID ?? `wheel-${label}`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    flex: 1,
    backgroundColor: palette.surface,
    borderRadius: radius.field,
    paddingTop: 8,
    paddingBottom: 6,
    paddingHorizontal: 6,
  },
  label: {
    fontFamily: font.meta,
    fontSize: 11,
    color: palette.textDim,
    textAlign: 'center',
  },
  item: {
    fontFamily: font.display,
    fontSize: 20,
    color: palette.text,
  },
  /**
   * The fixed window the rows roll under. It is painted over the wheel, not
   * behind it, so it has to stay a tint: a solid fill would swallow the very
   * value it is pointing at.
   */
  window: {
    backgroundColor: 'rgba(217,58,43,0.10)',
    opacity: 1,
    borderRadius: radius.pillule,
  },
});
