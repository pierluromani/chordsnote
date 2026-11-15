import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import {
  catalogColors,
  fadeGradient,
  font,
  memberColors,
  palette,
  radius,
  sectionRule,
  shadow,
} from '../lib/theme';
import { ROLE_LABELS, initials, type BandRole, type Member } from '../lib/types';
import { Search } from './icons';

/**
 * The press state the whole app shares: an 8 % lightening for 100 ms, no
 * scaling, no hover. Every visual target below 44 pt carries hitSlop to make up
 * the difference.
 */
export function Tap({
  style,
  children,
  ...rest
}: PressableProps & { style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable {...rest} style={({ pressed }) => [style, pressed && { opacity: 0.72 }]}>
      {children}
    </Pressable>
  );
}

/** 36 pt circle in `surface-control` — back, options, everything in a header. */
export function CircleButton({
  children,
  onPress,
  label,
  tone = 'control',
  size = 36,
  disabled,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  label: string;
  tone?: 'control' | 'accent' | 'plain';
  size?: number;
  disabled?: boolean;
}) {
  const tones = {
    control: { backgroundColor: palette.surfaceControl },
    accent: { backgroundColor: palette.accent },
    plain: { backgroundColor: 'transparent' },
  }[tone];

  // Pad the touch target out to 44 pt regardless of the visual size.
  const slop = Math.max(0, (44 - size) / 2);

  return (
    <Tap
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={slop}
      style={[
        styles.circle,
        tones,
        { width: size, height: size, borderRadius: size / 2 },
        disabled && { opacity: 0.35 },
      ]}
    >
      {children}
    </Tap>
  );
}

/** Text pill of the same height as `CircleButton` — "Esporta", "Condividi". */
export function PillButton({
  label,
  onPress,
  tone = 'control',
  icon,
  disabled,
  style,
}: {
  label: string;
  onPress?: () => void;
  tone?: 'control' | 'accent';
  icon?: React.ReactNode;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const accent = tone === 'accent';

  return (
    <Tap
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={4}
      style={[
        styles.pill,
        { backgroundColor: accent ? palette.accent : palette.surfaceControl },
        disabled && { opacity: 0.4 },
        style,
      ]}
    >
      {icon}
      <Text
        style={[
          accent ? styles.pillTextAccent : styles.pillText,
          icon ? { marginLeft: 6 } : null,
        ]}
      >
        {label}
      </Text>
    </Tap>
  );
}

/** Filter chip: red when active, `surface-control` when not. */
export function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <Tap
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      hitSlop={{ top: 10, bottom: 10 }}
      style={[
        styles.chip,
        { backgroundColor: active ? palette.accent : palette.surfaceControl },
      ]}
    >
      <Text
        style={[styles.chipText, { color: active ? palette.accentInk : palette.textMuted }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Tap>
  );
}

/**
 * The one-word answer to "what is this person allowed to do here". Outlined
 * rather than filled: it labels a row, it isn't a thing to press.
 */
export function RoleChip({ role, muted }: { role: BandRole; muted?: boolean }) {
  const accented = !muted && (role === 'owner' || role === 'editor');

  return (
    <View style={[styles.roleChip, accented && { borderColor: palette.accent }]}>
      <Text style={[styles.roleChipText, accented && { color: palette.accent }]}>
        {ROLE_LABELS[role]}
      </Text>
    </View>
  );
}

/** Full-width primary action — "Avvia il set", "Salva". */
export function PrimaryButton({
  label,
  onPress,
  icon,
  disabled,
  style,
}: {
  label: string;
  onPress?: () => void;
  icon?: React.ReactNode;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Tap
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={[styles.primary, disabled && { opacity: 0.4 }, style]}
    >
      {icon}
      <Text style={styles.primaryText}>{label}</Text>
    </Tap>
  );
}

/**
 * `PrimaryButton`'s twin in a quieter voice — same shape and height, so the
 * two read as one matched pair when they sit side by side, e.g. "Copia" next
 * to "Condividi". `PillButton` is shorter and fully round, which pairs badly
 * with `PrimaryButton`'s taller card shape.
 */
export function SecondaryButton({
  label,
  onPress,
  icon,
  disabled,
  style,
}: {
  label: string;
  onPress?: () => void;
  icon?: React.ReactNode;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Tap
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={[styles.secondary, disabled && { opacity: 0.4 }, style]}
    >
      {icon}
      <Text style={styles.secondaryText}>{label}</Text>
    </Tap>
  );
}

/** The dashed "aggiungi" affordance used at the end of every list. */
export function DashedButton({
  label,
  onPress,
  icon,
  compact,
}: {
  label: string;
  onPress?: () => void;
  icon?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <Tap
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.dashed, compact && { paddingVertical: 13 }]}
    >
      {icon}
      <Text style={[styles.dashedText, compact && { fontSize: 13 }]}>{label}</Text>
    </Tap>
  );
}

/** Uppercase micro-heading: "I MIEI CATALOGHI", "ORDINE". */
export function Eyebrow({
  children,
  color = palette.textFaint,
  style,
}: {
  children: string;
  color?: string;
  style?: StyleProp<TextStyle>;
}) {
  return <Text style={[styles.eyebrow, { color }, style]}>{children}</Text>;
}

/** Right-hand text action next to an eyebrow: "Gestisci", "Riordina". */
export function LinkAction({ label, onPress }: { label: string; onPress?: () => void }) {
  return (
    <Tap onPress={onPress} accessibilityRole="button" hitSlop={10}>
      <Text style={styles.linkAction}>{label}</Text>
    </Tap>
  );
}

/** The 3 pt dot that separates metadata runs. */
export function Dot() {
  return <View style={styles.dot} />;
}

export function SearchField({
  value,
  onChangeText,
  placeholder = 'Cerca per titolo o artista…',
  autoFocus,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  return (
    <View style={styles.search}>
      <Search size={15} color={palette.textFaint} strokeWidth={2} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={palette.textFaint}
        style={styles.searchInput}
        returnKeyType="search"
        autoFocus={autoFocus}
        clearButtonMode="while-editing"
      />
    </View>
  );
}

/** Labelled box used in the editor's metadata row: TONALITÀ / BPM / DURATA. */
export function DataField({
  label,
  value,
  suffix,
  accent,
  onPress,
  onChangeText,
  keyboardType,
}: {
  label: string;
  value: string;
  suffix?: string;
  accent?: boolean;
  onPress?: () => void;
  onChangeText?: (text: string) => void;
  keyboardType?: 'default' | 'number-pad';
}) {
  const valueStyle = [styles.dataValue, accent && { color: palette.accent }];

  return (
    <Tap
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${label} ${value}`}
      style={styles.dataField}
    >
      <Text style={styles.dataLabel}>{label}</Text>
      <View style={styles.dataRow}>
        {onChangeText ? (
          <TextInput
            value={value}
            onChangeText={onChangeText}
            keyboardType={keyboardType}
            placeholder="—"
            placeholderTextColor={palette.textGhost}
            style={[valueStyle, styles.dataInput]}
          />
        ) : (
          <Text style={valueStyle} numberOfLines={1}>
            {value}
          </Text>
        )}
        {suffix ? <Text style={styles.dataSuffix}>{suffix}</Text> : null}
      </View>
    </Tap>
  );
}

/**
 * A dynamics note — the only amber on the screen, and the only italic. It reads
 * as an instruction from the arranger rather than as part of the song.
 */
export function DynamicsNote({ text }: { text: string }) {
  return <Text style={styles.dynamics}>{text}</Text>;
}

/**
 * Circular monogram. Members get their assigned colour, users the neutral one.
 * A single letter by default — at 23 pt two letters turn into a smudge, and in
 * a stack the letter is only there to tell one face from another.
 */
export function Avatar({
  name,
  size = 23,
  color,
  ring,
  overlap,
  letters = 1,
}: {
  name: string;
  size?: number;
  color?: number;
  ring?: string;
  overlap?: boolean;
  letters?: 1 | 2;
}) {
  const tone = color === undefined ? null : memberColors[color % memberColors.length];
  const monogram = letters === 2 ? initials(name) : initials(name).slice(0, 1);

  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: tone ? tone.bg : palette.surfaceControl,
        },
        ring ? { borderWidth: 1.5, borderColor: ring } : null,
        overlap ? { marginLeft: -7 } : null,
      ]}
    >
      <Text
        style={[
          styles.avatarText,
          { fontSize: size * (letters === 2 ? 0.36 : 0.42), color: tone ? tone.ink : palette.textMuted },
        ]}
      >
        {monogram}
      </Text>
    </View>
  );
}

/** Up to two members plus a "+N" overflow, overlapping left to right. */
export function AvatarStack({
  members,
  size = 23,
  ring = palette.surface,
  max = 2,
}: {
  members: Member[];
  size?: number;
  ring?: string;
  max?: number;
}) {
  const shown = members.slice(0, max);
  const rest = members.length - shown.length;

  return (
    <View style={styles.stack}>
      {shown.map((member, index) => (
        <Avatar
          key={member.id}
          name={member.name}
          size={size}
          color={member.color}
          ring={ring}
          overlap={index > 0}
        />
      ))}
      {rest > 0 ? (
        <View
          style={[
            styles.avatar,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: memberColors[shown.length % memberColors.length].bg,
              borderWidth: 1.5,
              borderColor: ring,
              marginLeft: -7,
            },
          ]}
        >
          <Text style={[styles.avatarText, { fontSize: size * 0.35, color: palette.white }]}>
            +{rest}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/**
 * The letter a catalog is known by. Italian band names lead with an article
 * far more often than not — "I Notturni" is filed under N, the way it would be
 * on a shelf — so the article is skipped when there's a word behind it.
 */
const ARTICLES = new Set(['il', 'lo', 'la', 'i', 'gli', 'le', "l'", 'un', 'uno', 'una']);

export function markLetter(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const word = words.length > 1 && ARTICLES.has(words[0].toLowerCase()) ? words[1] : words[0];
  return word?.[0]?.toUpperCase() ?? '?';
}

/** Band catalogs get a coloured tile with their initial; personal ones a bar. */
export function CatalogMark({ name, color, kind }: { name: string; color: number; kind: 'personal' | 'band' }) {
  const tone = catalogColors[color % catalogColors.length];

  if (kind === 'personal') {
    return <View style={[styles.catalogBar, { backgroundColor: tone.bar }]} />;
  }

  return (
    <View style={[styles.catalogTile, { backgroundColor: tone.tile }]}>
      <Text style={[styles.catalogTileText, { color: tone.ink }]}>{markLetter(name)}</Text>
    </View>
  );
}

/** Small square tile carrying a song's key, at the head of every list row. */
export function KeyTile({ label, size = 38 }: { label: string; size?: number }) {
  return (
    <View style={[styles.keyTile, { width: size, height: size }]}>
      <Text style={styles.keyTileText} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/**
 * A bar floating over scrolling content. No shadow of its own — the dissolve
 * behind it is what separates it from the chart underneath.
 */
export function FloatingBar({
  children,
  bottomInset,
  align = 'stretch',
}: {
  children: React.ReactNode;
  bottomInset: number;
  align?: 'stretch' | 'end';
}) {
  return (
    <View style={styles.floating} pointerEvents="box-none">
      <LinearGradient colors={fadeGradient} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View
        style={{
          paddingTop: 14,
          paddingHorizontal: 20,
          paddingBottom: Math.max(bottomInset, 16) + 14,
          alignItems: align === 'end' ? 'flex-end' : 'stretch',
        }}
      >
        {children}
      </View>
    </View>
  );
}

/**
 * Section rule used in the viewer: the label set in its own hue, bold and
 * uppercase, then a hairline out to the margin.
 */
export function SectionRule({ label, color }: { label: string; color: string }) {
  return (
    <View style={styles.rule}>
      <Text style={[styles.ruleLabel, { color }]} numberOfLines={1}>
        {label.toUpperCase()}
      </Text>
      <View style={[styles.ruleLine, { backgroundColor: sectionRule(color) }]} />
    </View>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
      {action}
    </View>
  );
}

export const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 36,
    paddingHorizontal: 13,
    borderRadius: radius.round,
  },
  pillText: {
    fontFamily: font.metaSemi,
    fontSize: 12,
    color: palette.textMuted,
  },
  pillTextAccent: {
    fontFamily: font.metaSemi,
    fontSize: 12,
    color: palette.accentInk,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.round,
  },
  chipText: {
    fontFamily: font.metaSemi,
    fontSize: 12,
  },
  roleChip: {
    borderRadius: radius.round,
    borderWidth: 1,
    borderColor: palette.borderControl,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  roleChipText: {
    fontFamily: font.metaSemi,
    fontSize: 10.5,
    letterSpacing: 0.2,
    color: palette.textFaint,
  },
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: palette.accent,
    paddingVertical: 15,
    paddingHorizontal: 18,
    borderRadius: radius.cardLg,
    ...shadow.floating,
  },
  primaryText: {
    fontFamily: font.display,
    fontSize: 15,
    color: palette.accentInk,
  },
  secondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: palette.surfaceControl,
    paddingVertical: 15,
    paddingHorizontal: 18,
    borderRadius: radius.cardLg,
  },
  secondaryText: {
    fontFamily: font.display,
    fontSize: 15,
    color: palette.text,
  },
  dashed: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: palette.borderDashed,
    borderRadius: radius.cardLg,
    paddingVertical: 14,
  },
  dashedText: {
    fontFamily: font.displaySemi,
    fontSize: 14,
    color: palette.textFaint,
  },
  eyebrow: {
    fontFamily: font.metaSemi,
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  linkAction: {
    fontFamily: font.metaSemi,
    fontSize: 12,
    color: palette.accent,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: palette.textGhost,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: palette.surface,
    borderRadius: 12,
    paddingHorizontal: 13,
    height: 42,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontFamily: font.meta,
    fontSize: 14,
    color: palette.text,
  },
  dataField: {
    flex: 1,
    backgroundColor: palette.surface,
    borderRadius: radius.field,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  dataLabel: {
    fontFamily: font.metaSemi,
    fontSize: 9,
    letterSpacing: 1.26,
    textTransform: 'uppercase',
    color: palette.textFainter,
  },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
    marginTop: 2,
  },
  dataValue: {
    fontFamily: font.display,
    fontSize: 16,
    color: palette.text,
  },
  dataInput: {
    minWidth: 40,
    padding: 0,
  },
  dataSuffix: {
    fontFamily: font.meta,
    fontSize: 11,
    color: palette.textFaint,
  },
  dynamics: {
    fontFamily: font.metaItalic,
    fontSize: 11.5,
    lineHeight: 16,
    color: palette.dynamicsDim,
  },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: font.displaySemi,
  },
  stack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  catalogBar: {
    width: 6,
    height: 38,
    borderRadius: 99,
  },
  catalogTile: {
    width: 38,
    height: 38,
    borderRadius: radius.tile,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catalogTileText: {
    fontFamily: font.display,
    fontSize: 15,
  },
  keyTile: {
    borderRadius: radius.tile,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyTileText: {
    fontFamily: font.monoBold,
    fontSize: 13,
    color: palette.accent,
  },
  floating: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  rule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  ruleLabel: {
    flexShrink: 1,
    fontFamily: font.metaBold,
    fontSize: 12,
    letterSpacing: 1.6,
  },
  ruleLine: {
    flex: 1,
    height: 1,
  },
  empty: {
    alignItems: 'center',
    gap: 10,
    paddingTop: 48,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontFamily: font.display,
    fontSize: 18,
    color: palette.text,
    letterSpacing: -0.36,
  },
  emptyBody: {
    fontFamily: font.meta,
    fontSize: 13.5,
    lineHeight: 20,
    color: palette.textDim,
    textAlign: 'center',
    maxWidth: 290,
    marginBottom: 6,
  },
});
