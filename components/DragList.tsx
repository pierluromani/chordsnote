import * as Haptics from 'expo-haptics';
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Animated, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector, type PanGesture } from 'react-native-gesture-handler';

/** `height` is the dragged row's own size (plus gap), captured once at pickup —
 * every other row is displaced by exactly that amount, whatever its own height. */
export type Drag = { from: number; to: number; height: number };

/**
 * Picks up the mechanics of press-and-drag reordering: the row being carried,
 * where it would land, and the haptics at each step. Shared by any list of
 * draggable rows — section cards, setlist rows, songs and notes mixed
 * together — so the timing this took to get right (see `DragRow` below) only
 * has to work once. Rows don't need to share a height: each measures itself.
 */
export function useDragReorder(onReorder: (from: number, to: number) => void) {
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const [heights, setHeights] = useState<number[]>([]);
  const pan = useRef(new Animated.Value(0)).current;

  const setHeight = (index: number, height: number) => {
    setHeights((prev) => {
      if (prev[index] === height) return prev;
      const next = [...prev];
      next[index] = height;
      return next;
    });
  };

  const setDragging = (next: Drag | null) => {
    dragRef.current = next;
    setDrag(next);
  };

  const startDrag = (from: number, height: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setDragging({ from, to: from, height });
  };

  const dragOver = (to: number) => {
    const current = dragRef.current;
    if (!current || current.to === to) return;
    Haptics.selectionAsync().catch(() => {});
    setDragging({ ...current, to });
  };

  const dropDrag = () => {
    const current = dragRef.current;
    setDragging(null);
    pan.setValue(0);
    if (current && current.from !== current.to) {
      onReorder(current.from, current.to);
    }
  };

  return { drag, pan, heights, setHeight, startDrag, dragOver, dropDrag };
}

/**
 * Wraps one draggable row. Each row measures and reports its own height, so
 * the list it's part of doesn't need uniform rows — a short note between two
 * songs displaces, and gets displaced, correctly even though it isn't the
 * same size as the rows around it.
 */
export function DragRow({
  index,
  count,
  enabled,
  drag,
  pan,
  rowHeight,
  liftedStyle,
  onMeasure,
  onStart,
  onOver,
  onDrop,
  children,
}: {
  index: number;
  count: number;
  enabled: boolean;
  drag: Drag | null;
  /** Follows the finger; shared, since only one row moves at a time. */
  pan: Animated.Value;
  /** This row's own height plus the gap under it. */
  rowHeight: number;
  /** Shadow and corner radius applied while the row is lifted — match the row's own shape. */
  liftedStyle: StyleProp<ViewStyle>;
  onMeasure?: (height: number) => void;
  onStart: (from: number, height: number) => void;
  onOver: (to: number) => void;
  onDrop: () => void;
  children: (gesture: PanGesture) => React.ReactNode;
}) {
  const lifted = enabled && drag?.from === index;
  const shift = useRef(new Animated.Value(0)).current;
  // 0 when resting, 1 when picked up — drives the little "detach" pop: the
  // row scales up a hair as it lifts off the stack under the finger.
  const lift = useRef(new Animated.Value(0)).current;

  // Where this row sits while another one is being dragged over it — shifted
  // by the DRAGGED row's height, since that's the size of the gap opening or
  // closing, regardless of how tall this particular row is.
  const offset = (() => {
    if (!enabled || !drag || drag.from === index) return 0;
    if (drag.from < drag.to && index > drag.from && index <= drag.to) return -drag.height;
    if (drag.from > drag.to && index >= drag.to && index < drag.from) return drag.height;
    return 0;
  })();

  // Was this row still being passed over as of the last render? Tracked so a
  // drop can be told apart from an ordinary mid-drag offset change below.
  const wasDragging = useRef(false);

  useLayoutEffect(() => {
    if (!drag && wasDragging.current) {
      // The drop just reordered the underlying list, which lands this row in
      // its new slot in the very same commit — so the preview offset must
      // clear in that same commit too, synchronously, before the browser
      // paints. Left to a spring (a passive effect, scheduled after paint) it
      // would start from the old offset one frame late, after the row had
      // already jumped to its new slot, and visibly fall the rest of the way in.
      shift.setValue(0);
    } else if (drag) {
      Animated.spring(shift, {
        toValue: offset,
        useNativeDriver: true,
        damping: 20,
        stiffness: 260,
        mass: 0.7,
        overshootClamping: true,
      }).start();
    }
    wasDragging.current = !!drag;
  }, [offset, shift, drag]);

  useEffect(() => {
    Animated.spring(lift, {
      toValue: lifted ? 1 : 0,
      useNativeDriver: true,
      damping: 14,
      stiffness: 300,
      mass: 0.6,
    }).start();
  }, [lifted, lift]);

  const scale = lift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] });

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(enabled && rowHeight > 0)
        // Claimed on touch-down rather than after a threshold: the row has to
        // come up under the finger straight away, and the scroll view behind it
        // has to be told to stand down before it starts scrolling.
        .minDistance(0)
        .runOnJS(true)
        .onBegin(() => onStart(index, rowHeight))
        .onUpdate((event) => {
          pan.setValue(event.translationY);
          const target = index + Math.round(event.translationY / rowHeight);
          onOver(Math.max(0, Math.min(count - 1, target)));
        })
        .onFinalize(() => onDrop()),
    [enabled, rowHeight, index, count, pan, onStart, onOver, onDrop]
  );

  return (
    <Animated.View
      // Always attached, even when dragging is off: a handler added later
      // would never fire, and the row is only measurable once its list has
      // drawn it for the first time.
      onLayout={
        onMeasure
          ? (event) => onMeasure(event.nativeEvent.layout.height)
          : undefined
      }
      style={[
        lifted ? liftedStyle : null,
        { transform: [{ translateY: lifted ? pan : shift }, { scale }] },
      ]}
    >
      {children(gesture)}
    </Animated.View>
  );
}
