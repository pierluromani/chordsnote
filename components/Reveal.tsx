import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';

/**
 * The small settling-into-place a screen's content does as it arrives: a short
 * rise and fade, layered under the stack's own slide.
 *
 * It exists to give the eye somewhere to land. A pushed screen slides in whole,
 * so nothing tells you where to look first; staggering the parts by a few tens
 * of milliseconds does — the header, then the list. Kept well under a fifth of
 * a second, because this has to feel like the app is quick, not animated.
 */
export function Reveal({
  children,
  delay = 0,
  distance = 8,
  duration = 190,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  /** How far up the content travels, in points. */
  distance?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  // Motion is a preference, not a given: with "riduci movimento" on, the
  // content simply appears.
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => alive && setReduced(value))
      .catch(() => {});
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      alive = false;
      listener?.remove?.();
    };
  }, []);

  useEffect(() => {
    if (reduced) {
      progress.setValue(1);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, delay, duration, reduced]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [distance, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
