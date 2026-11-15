import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { palette } from '../lib/theme';

/**
 * The handoff uses typographic glyphs (♪ ‹ ··· ⠿ ⇪) as placeholders and asks for
 * a real icon set in their place. This is that set: drawn on a 24 grid with a
 * 1.9 stroke and round joins, weighted to sit beside Sora at small sizes and to
 * stay legible at arm's length on a music stand.
 */

export type IconProps = {
  size?: number;
  color?: string;
  strokeWidth?: number;
};

type PathIcon = (props: Required<IconProps>) => React.ReactNode;

function makeIcon(draw: PathIcon) {
  return function Icon({ size = 22, color = palette.text, strokeWidth = 1.9 }: IconProps) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        {draw({ size, color, strokeWidth })}
      </Svg>
    );
  };
}

const stroke = (color: string, strokeWidth: number) => ({
  stroke: color,
  strokeWidth,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

export const ChevronLeft = makeIcon(({ color, strokeWidth }) => (
  <Path d="M15 5 L8 12 L15 19" {...stroke(color, strokeWidth)} />
));

export const ChevronRight = makeIcon(({ color, strokeWidth }) => (
  <Path d="M9 5 L16 12 L9 19" {...stroke(color, strokeWidth)} />
));

export const ChevronUp = makeIcon(({ color, strokeWidth }) => (
  <Path d="M5 15 L12 8 L19 15" {...stroke(color, strokeWidth)} />
));

export const ChevronDown = makeIcon(({ color, strokeWidth }) => (
  <Path d="M5 9 L12 16 L19 9" {...stroke(color, strokeWidth)} />
));

export const Plus = makeIcon(({ color, strokeWidth }) => (
  <Path d="M12 5 L12 19 M5 12 L19 12" {...stroke(color, strokeWidth)} />
));

export const Minus = makeIcon(({ color, strokeWidth }) => (
  <Path d="M5 12 L19 12" {...stroke(color, strokeWidth)} />
));

export const Close = makeIcon(({ color, strokeWidth }) => (
  <Path d="M6 6 L18 18 M18 6 L6 18" {...stroke(color, strokeWidth)} />
));

export const Check = makeIcon(({ color, strokeWidth }) => (
  <Path d="M4.5 12.5 L9.5 17.5 L19.5 7" {...stroke(color, strokeWidth)} />
));

export const Search = makeIcon(({ color, strokeWidth }) => (
  <>
    <Circle cx={11} cy={11} r={6.5} {...stroke(color, strokeWidth)} />
    <Path d="M15.8 15.8 L20.5 20.5" {...stroke(color, strokeWidth)} />
  </>
));

/** Ellipsis — the one way into every screen's options. */
export function Ellipsis({ size = 22, color = palette.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={5.6} cy={12} r={1.85} fill={color} />
      <Circle cx={12} cy={12} r={1.85} fill={color} />
      <Circle cx={18.4} cy={12} r={1.85} fill={color} />
    </Svg>
  );
}

const HEART_PATH =
  'M12 20.3 C12 20.3 3.6 15.4 3.6 9.6 A4.6 4.6 0 0 1 12 7 A4.6 4.6 0 0 1 20.4 9.6 C20.4 15.4 12 20.3 12 20.3 Z';

export function Heart({
  size = 22,
  color = palette.accent,
  strokeWidth = 1.9,
  filled = true,
}: IconProps & { filled?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d={HEART_PATH} fill={filled ? color : 'none'} {...stroke(color, strokeWidth)} />
    </Svg>
  );
}

export const Pencil = makeIcon(({ color, strokeWidth }) => (
  <>
    <Path
      d="M4 20 L4.8 16.2 L15.6 5.4 A2.3 2.3 0 0 1 18.9 8.7 L8.1 19.5 Z"
      {...stroke(color, strokeWidth)}
    />
    <Path d="M14 7 L17.3 10.3" {...stroke(color, strokeWidth)} />
  </>
));

export const Trash = makeIcon(({ color, strokeWidth }) => (
  <>
    <Path d="M4.5 6.5 H19.5" {...stroke(color, strokeWidth)} />
    <Path
      d="M9.5 6.5 V4.6 A1 1 0 0 1 10.5 3.6 H13.5 A1 1 0 0 1 14.5 4.6 V6.5"
      {...stroke(color, strokeWidth)}
    />
    <Path
      d="M6.4 6.5 L7.2 19.4 A1.4 1.4 0 0 0 8.6 20.6 H15.4 A1.4 1.4 0 0 0 16.8 19.4 L17.6 6.5"
      {...stroke(color, strokeWidth)}
    />
    <Path d="M10.3 10 V17 M13.7 10 V17" {...stroke(color, strokeWidth)} />
  </>
));

export const Copy = makeIcon(({ color, strokeWidth }) => (
  <>
    <Rect x={8.5} y={8.5} width={11} height={11} rx={2.6} {...stroke(color, strokeWidth)} />
    <Path
      d="M15.5 8.5 V6.4 A2 2 0 0 0 13.5 4.4 H6.4 A2 2 0 0 0 4.4 6.4 V13.5 A2 2 0 0 0 6.4 15.5 H8.5"
      {...stroke(color, strokeWidth)}
    />
  </>
));

/** Export / share — the system's square-and-arrow-up. */
export const Export = makeIcon(({ color, strokeWidth }) => (
  <>
    <Path d="M12 15.5 V3.8" {...stroke(color, strokeWidth)} />
    <Path d="M8 7.6 L12 3.6 L16 7.6" {...stroke(color, strokeWidth)} />
    <Path
      d="M5.5 13 V18.5 A2 2 0 0 0 7.5 20.5 H16.5 A2 2 0 0 0 18.5 18.5 V13"
      {...stroke(color, strokeWidth)}
    />
  </>
));

export const Import = makeIcon(({ color, strokeWidth }) => (
  <>
    <Path d="M12 3.8 V15.5" {...stroke(color, strokeWidth)} />
    <Path d="M8 11.5 L12 15.5 L16 11.5" {...stroke(color, strokeWidth)} />
    <Path
      d="M5.5 13 V18.5 A2 2 0 0 0 7.5 20.5 H16.5 A2 2 0 0 0 18.5 18.5 V13"
      {...stroke(color, strokeWidth)}
    />
  </>
));

/** Add to setlist — a bulleted running order. */
export const ListBullet = makeIcon(({ color, strokeWidth }) => (
  <>
    <Path d="M9 6.5 H20 M9 12 H20 M9 17.5 H20" {...stroke(color, strokeWidth)} />
    <Circle cx={4.6} cy={6.5} r={1.4} fill={color} />
    <Circle cx={4.6} cy={12} r={1.4} fill={color} />
    <Circle cx={4.6} cy={17.5} r={1.4} fill={color} />
  </>
));

/** Auto-scroll. */
export const AutoScroll = makeIcon(({ color, strokeWidth }) => (
  <>
    <Path d="M8 4.5 V19.5 M8 4.5 L4.8 7.9 M8 4.5 L11.2 7.9" {...stroke(color, strokeWidth)} />
    <Path d="M16 19.5 V4.5 M16 19.5 L12.8 16.1 M16 19.5 L19.2 16.1" {...stroke(color, strokeWidth)} />
  </>
));

export function Play({ size = 22, color = palette.accentInk }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M7 4.6 L19.4 12 L7 19.4 Z" fill={color} />
    </Svg>
  );
}

export function Note({ size = 22, color = palette.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M10.4 17.6 V5.4 L19 3.4 V15.6"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={7.8} cy={17.8} r={2.9} fill={color} />
      <Circle cx={16.4} cy={15.8} r={2.9} fill={color} />
    </Svg>
  );
}

/** Drag handle — six dots, the standard grip. */
export function Grip({ size = 22, color = palette.textGhost }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {[7.5, 12, 16.5].map((y) => (
        <React.Fragment key={y}>
          <Circle cx={9} cy={y} r={1.35} fill={color} />
          <Circle cx={15} cy={y} r={1.35} fill={color} />
        </React.Fragment>
      ))}
    </Svg>
  );
}

/** Catalogs tab — stacked shelves. */
export const Catalogs = makeIcon(({ color, strokeWidth }) => (
  <>
    <Path d="M4 6.5 H20 M4 12 H20 M4 17.5 H14" {...stroke(color, strokeWidth + 0.5)} />
  </>
));

/** Setlists tab. */
export const Setlists = makeIcon(({ color, strokeWidth }) => (
  <Path d="M4.5 7 H19.5 M4.5 12 H19.5 M4.5 17 H19.5" {...stroke(color, strokeWidth)} />
));

export const Person = makeIcon(({ color, strokeWidth }) => (
  <>
    <Circle cx={12} cy={8} r={3.7} {...stroke(color, strokeWidth)} />
    <Path
      d="M4.8 20.2 C5.4 16.6 8.4 14.4 12 14.4 C15.6 14.4 18.6 16.6 19.2 20.2"
      {...stroke(color, strokeWidth)}
    />
  </>
));

/** Text size — the two-A control in the options sheet. */
export function TextSize({ size = 22, color = palette.accent }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M2.5 18 L6.4 8 L10.3 18 M3.7 15 H9.1"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M13 19 L18 5.5 L23 19 M14.6 15 H21.4"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Send — the composer's arrow up. */
export const Send = makeIcon(({ color, strokeWidth }) => (
  <Path d="M12 19 L12 5 M5 12 L12 5 L19 12" {...stroke(color, strokeWidth)} />
));

export const Tuning = makeIcon(({ color, strokeWidth }) => (
  <>
    <Circle cx={12} cy={12} r={8.2} {...stroke(color, strokeWidth)} />
    <Path d="M12 12 L15.6 8.4" {...stroke(color, strokeWidth)} />
    <Circle cx={12} cy={12} r={1.4} fill={color} />
  </>
));

/** Chat — the band's bacheca. */
export const Chat = makeIcon(({ color, strokeWidth }) => (
  <Path
    d="M20 12.5c0 3.6-3.6 6.5-8 6.5-.9 0-1.8-.1-2.6-.35L4.5 20.5l1.2-3.1C4.6 16.1 4 14.4 4 12.5 4 8.9 7.6 6 12 6s8 2.9 8 6.5Z"
    {...stroke(color, strokeWidth)}
  />
));

/** Band tab — two people, the smaller one a step behind. */
export const Band = makeIcon(({ color, strokeWidth }) => (
  <>
    <Circle cx={9.2} cy={8.4} r={3.3} {...stroke(color, strokeWidth)} />
    <Path
      d="M3.4 19.4 C4 16.2 6.4 14.3 9.2 14.3 C12 14.3 14.4 16.2 15 19.4"
      {...stroke(color, strokeWidth)}
    />
    <Circle cx={17} cy={9.6} r={2.4} {...stroke(color, strokeWidth)} />
    <Path d="M17 14.4 C19 14.7 20.3 16.4 20.7 19.4" {...stroke(color, strokeWidth)} />
  </>
));

export const Calendar = makeIcon(({ color, strokeWidth }) => (
  <>
    <Rect x={3.5} y={5} width={17} height={15.5} rx={3} {...stroke(color, strokeWidth)} />
    <Path d="M3.5 9.8 H20.5 M8 3.4 V6.6 M16 3.4 V6.6" {...stroke(color, strokeWidth)} />
  </>
));

/** The cog on the way into a band's settings. */
export const Settings = makeIcon(({ color, strokeWidth }) => (
  <>
    <Circle cx={12} cy={12} r={3.1} {...stroke(color, strokeWidth)} />
    <Path
      d="M12 3.2 V5.6 M12 18.4 V20.8 M3.2 12 H5.6 M18.4 12 H20.8 M5.8 5.8 L7.5 7.5 M16.5 16.5 L18.2 18.2 M18.2 5.8 L16.5 7.5 M7.5 16.5 L5.8 18.2"
      {...stroke(color, strokeWidth)}
    />
  </>
));

/** A pin on a map — where a gig or a rehearsal happens. */
export const Place = makeIcon(({ color, strokeWidth }) => (
  <>
    <Path
      d="M12 21 C12 21 19 15.4 19 10.4 C19 6.6 15.9 3.6 12 3.6 C8.1 3.6 5 6.6 5 10.4 C5 15.4 12 21 12 21 Z"
      {...stroke(color, strokeWidth)}
    />
    <Circle cx={12} cy={10.3} r={2.4} {...stroke(color, strokeWidth)} />
  </>
));
