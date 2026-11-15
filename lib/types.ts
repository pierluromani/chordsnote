export type SectionKind =
  | 'intro'
  | 'verse'
  | 'prechorus'
  | 'chorus'
  | 'bridge'
  | 'solo'
  | 'interlude'
  | 'outro';

export const SECTION_KINDS: SectionKind[] = [
  'intro',
  'verse',
  'prechorus',
  'chorus',
  'bridge',
  'solo',
  'interlude',
  'outro',
];

/**
 * Section names stay in English even though the rest of the interface is in
 * Italian: Verse / Chorus / Bridge is what's written on charts, called out in
 * rehearsal, and printed on setlists, in Italy as everywhere else.
 */
export const SECTION_LABELS: Record<SectionKind, string> = {
  intro: 'Intro',
  verse: 'Verse',
  prechorus: 'Pre-chorus',
  chorus: 'Chorus',
  bridge: 'Bridge',
  solo: 'Solo',
  interlude: 'Interlude',
  outro: 'Outro',
};

/**
 * A chord pinned to a character offset inside a line of lyrics. `pos` is the
 * index of the character the chord sits over — the start of the syllable the
 * user tapped. On instrumental lines `pos` is used only for ordering.
 */
export type ChordAnchor = {
  id: string;
  pos: number;
  chord: string;
};

export type Line = {
  id: string;
  text: string;
  chords: ChordAnchor[];
  /** Chords-only line (a riff, a turnaround). Renders as a bar of chords. */
  instrumental?: boolean;
  /** Performance note placed right after this line inside the section. */
  dynamics?: string;
};

export type Section = {
  id: string;
  kind: SectionKind;
  /** Overrides the default label, e.g. "Strofa 2" or "Coda". */
  label?: string;
  /** Performance note: "carica · entra batteria · cori". The one amber field. */
  dynamics?: string;
  lines: Line[];
};

export type Song = {
  id: string;
  title: string;
  artist: string;
  /** Stored in Anglo notation ("C", "Am", "F#m"), rendered per settings. */
  key: string;
  bpm?: number;
  capo?: number;
  /** Seconds. Shown as "4:12" beside key and tempo. */
  duration?: number;
  /** Which catalog the song lives in. */
  catalogId: string;
  notes?: string;
  favorite: boolean;
  /**
   * Started but never saved into the catalog. A draft is kept apart from the
   * repertoire — it shows up only under "Bozze" — so a song you were halfway
   * through writing can't turn up in a setlist on stage.
   */
  draft?: boolean;
  sections: Section[];
  createdAt: number;
  updatedAt: number;
};

/* ------------------------------------------------------------- Cataloghi */

/**
 * What someone is allowed to do in a band.
 *
 * - `owner`   — the one who started it: invites, promotes, demotes, deletes.
 * - `editor`  — writes the repertoire and the setlists, but not the line-up.
 * - `viewer`  — reads. The default for whoever joins, because handing out the
 *               right to rewrite a repertoire should be a deliberate act.
 */
export type BandRole = 'owner' | 'editor' | 'viewer';

/** The two roles an invite can carry — nobody is invited as owner. */
export type InvitedRole = Exclude<BandRole, 'owner'>;

export const ROLE_LABELS: Record<BandRole, string> = {
  owner: 'Fondatore',
  editor: 'Editor',
  viewer: 'Solo lettura',
};

export const ROLE_BLURBS: Record<BandRole, string> = {
  owner: 'Gestisce la band, gli inviti e i ruoli',
  editor: 'Può modificare repertorio e scalette',
  viewer: 'Può leggere brani e scalette',
};

/**
 * Someone in the line-up. A member may be just a name — written down so you
 * know who plays what — or an account, once they've accepted an invite and
 * `uid` is filled in. Only members with a `uid` are anyone Firestore knows
 * about; the rest are notes on a page.
 */
export type Member = {
  id: string;
  name: string;
  /** Index into `memberColors`. */
  color: number;
  /** Set once the person has accepted an invite with their account. */
  uid?: string;
  /** Lowercase, the address the invite was sent to. */
  email?: string;
  /** Absent on line-up notes written before roles existed — read as `viewer`. */
  role?: BandRole;
};

/** Roles are optional on old line-up entries; absent means the safest one. */
export function memberRole(member: Member): BandRole {
  return member.role ?? 'viewer';
}

/**
 * A catalog is where songs live: your own material, a scratchpad, or a band's
 * shared repertoire. Band catalogs carry members; personal ones don't.
 */
export type Catalog = {
  id: string;
  name: string;
  kind: 'personal' | 'band';
  /** Index into `catalogColors`. */
  color: number;
  members: Member[];
  /** Free notes on a band: the line-up, where you rehearse, what you play. */
  description?: string;
  /**
   * The account that owns a shared band. Absent means the band lives only on
   * this device — created before signing in, or by someone who never did —
   * and whoever holds the phone can do everything with it.
   */
  ownerUid?: string;
  /** Everyone who can see the band. Mirrors the `uid`s in `members`. */
  memberUids?: string[];
  /** Owner plus editors: everyone allowed to change songs and setlists. */
  editorUids?: string[];
  createdAt: number;
  /** Last edit, used to decide which side wins when two devices disagree. */
  updatedAt?: number;
};

/**
 * What a band's owner can do to me, and what I can do back. An invite is
 * addressed to an email rather than an account, so it can be sent to someone
 * who hasn't signed up yet and be waiting when they do.
 */
export type Invite = {
  /** `${bandId}__${email}` — deterministic, so inviting twice is one invite. */
  id: string;
  bandId: string;
  /** Copied in so the invitation can be shown without reading the band. */
  bandName: string;
  bandColor: number;
  /** Lowercase. */
  email: string;
  role: InvitedRole;
  /** The band's owner at the time — also what the security rules check. */
  ownerUid: string;
  invitedByName: string;
  createdAt: number;
};

/**
 * A song handed to somebody else. Addressed to an email rather than to an
 * account, like an invite, so it can wait for someone who hasn't signed up.
 *
 * The song travels inside the share: the recipient can't read the sender's
 * private branch, so what they accept has to be here in full. Accepting copies
 * it into their own catalog and the two versions part ways — a song that stays
 * in step with somebody else's is what a band is for.
 */
export type SongShare = {
  /** `${songId}__${email}` — sending the same song twice rewrites one share. */
  id: string;
  songId: string;
  /** Lowercase. */
  email: string;
  fromUid: string;
  fromName: string;
  /** Shown in the list without having to unpack the song. */
  title: string;
  artist: string;
  song: Song;
  createdAt: number;
};

/**
 * A message on a band's bacheca. `name` and `ref.title` are denormalized like
 * `SongShare`: a message is a historical fact, not a live view — if the song
 * is renamed later, what was said about it still reads sensibly.
 */
export type BandMessage = {
  id: string;
  bandId: string;
  uid: string;
  name: string;
  text: string;
  createdAt: number;
  ref?: {
    kind: 'song' | 'setlist';
    id: string;
    title: string;
  };
};

/**
 * A band nobody owns yet is one this device made on its own: it's yours until
 * it goes up to an account. That's what keeps the app usable signed out.
 */
export function bandRoleOf(catalog: Catalog | undefined, uid: string | null): BandRole | null {
  if (!catalog || catalog.kind !== 'band') return null;
  if (!catalog.ownerUid) return 'owner';
  if (!uid) return null;
  if (catalog.ownerUid === uid) return 'owner';
  if (catalog.editorUids?.includes(uid)) return 'editor';
  if (catalog.memberUids?.includes(uid)) return 'viewer';
  return null;
}

/** Whether songs and setlists in this catalog may be changed. */
export function canEditCatalog(catalog: Catalog | undefined, uid: string | null): boolean {
  if (!catalog) return false;
  if (catalog.kind !== 'band') return true;
  const role = bandRoleOf(catalog, uid);
  return role === 'owner' || role === 'editor';
}

export const GENERAL_CATALOG = '__all__';

/* -------------------------------------------------------------- Scalette */

/**
 * A setlist is an ordered mix of songs and free notes ("cambio chitarra ·
 * accordare in Drop D"). Notes live between songs rather than inside them, so
 * reordering a song carries the note that follows it.
 */
export type SetlistItem =
  | { id: string; type: 'song'; songId: string }
  | { id: string; type: 'note'; text: string };

export type Setlist = {
  id: string;
  catalogId: string;
  name: string;
  /** ISO timestamp of the gig, if it has a date. */
  date?: string;
  /** Practical instructions for the whole set. */
  note?: string;
  items: SetlistItem[];
  createdAt: number;
  updatedAt: number;
};

/* ------------------------------------------------------------- Calendario */

/**
 * Una data della band. Le prove stavano nel testo libero delle informazioni e
 * i concerti solo dentro la data di una scaletta: questo è il posto dove
 * stanno tutte e due, con l'ora e il luogo che una scaletta non ha.
 */
export type BandEventKind = 'gig' | 'rehearsal' | 'other';

export const EVENT_LABELS: Record<BandEventKind, string> = {
  gig: 'Concerto',
  rehearsal: 'Prova',
  other: 'Altro',
};

export type BandEvent = {
  id: string;
  bandId: string;
  kind: BandEventKind;
  title: string;
  /** ISO con l'ora. L'agenda ordina su questa stringa. */
  at: string;
  place?: string;
  note?: string;
  /** La scaletta che si suona quella sera, se è già pronta. */
  setlistId?: string;
  createdBy: string;
  createdAt: number;
};

/* ------------------------------------------------------------ Preferenze */

export type Notation = 'anglo' | 'italiano';

export type Settings = {
  notation: Notation;
  /** Multiplier applied to lyric and chord sizes in the viewer. */
  fontScale: number;
  showChords: boolean;
  /**
   * Write the degree over each chord of the key in the picker — 1, 2m, 4, 5 —
   * for whoever thinks in numbers rather than letters. Off by default: it's a
   * second alphabet on screen, and most people don't read it.
   */
  nashville: boolean;
  /** Keep the screen on while a song is open. */
  keepAwake: boolean;
  /** Shown in the home header avatar. */
  userName: string;
};

export const DEFAULT_SETTINGS: Settings = {
  notation: 'anglo',
  fontScale: 1,
  showChords: true,
  nashville: false,
  keepAwake: true,
  userName: 'Marco Rossi',
};

/** "MR" — the two-letter monogram used on avatars. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** 252 → "4:12". */
export function formatDuration(seconds: number | undefined): string | null {
  if (!seconds || seconds <= 0) return null;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(Math.round(seconds % 60)).padStart(2, '0')}`;
}

/** "48 min" — total length of a set. */
export function formatTotal(seconds: number): string {
  return `${Math.max(1, Math.round(seconds / 60))} min`;
}

const DAYS = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
const MONTHS = [
  'gen', 'feb', 'mar', 'apr', 'mag', 'giu',
  'lug', 'ago', 'set', 'ott', 'nov', 'dic',
];

/** "Ven 14 ago". */
export function formatDay(date: Date): string {
  return `${DAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

/** "Ven 14 ago · 21:30". */
export function formatGigDate(iso: string | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const time = `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
  return `${formatDay(date)} · ${time}`;
}

/** "21:30". */
export function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** "VEN" — the three letters over the day number in the agenda. */
export function weekdayShort(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : DAYS[date.getDay()].toUpperCase();
}

const MONTHS_LONG = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
];

/** "Agosto 2026" — the heading over the month grid. */
export function formatMonth(year: number, month: number): string {
  return `${MONTHS_LONG[month]} ${year}`;
}

/**
 * `2026-08-14` in local time. `toISOString` would answer in UTC, and a gig at
 * half past midnight would land on the day before in the grid.
 */
export function dayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${String(date.getDate()).padStart(2, '0')}`;
}

/** "oggi" · "domani" · "fra 3 giorni" · "3 giorni fa". Whole days apart. */
export function relativeDays(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const start = (value: Date) =>
    new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const days = Math.round((start(date) - start(now)) / 86_400_000);

  if (days === 0) return 'oggi';
  if (days === 1) return 'domani';
  if (days === -1) return 'ieri';
  return days > 0 ? `fra ${days} giorni` : `${-days} giorni fa`;
}
