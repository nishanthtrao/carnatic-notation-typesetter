/*
 * Carnatic Music Notation Typesetter — document model
 * SPDX-License-Identifier: GPL-2.0-only
 *
 * parser.ts turns the text input into a NotationDoc; render.ts draws it.
 * Times are in aksharas (beats) measured from the start of a row.
 */

export type Lang = 'english' | 'iast' | 'devanagari' | 'telugu' | 'kannada' | 'malayalam' | 'tamil';

export interface LangOpts {
  granthasa?: boolean;
  qual?: boolean;
  lyric?: boolean;
  /** Malayalam: use chillu letters at word ends (default true) */
  chillu?: boolean;
}

export interface LangSpec {
  lang: Lang;
  opts: LangOpts;
}

export type JatiName = 'tisra' | 'catusra' | 'khanda' | 'misra' | 'sankirna';

export interface Tala {
  name: string;
  /** anga lengths in aksharas; null in Manual mode #2 */
  segments: number[] | null;
  beats: number;
  gati: JatiName | null;
  innerBars: boolean;
  perRow: number;
  rowsPerAvarta: number;
  /** 0 = automatic, 1 = Tala,Manual (tracked), 2 = Tala: Manual (untracked) */
  manual: 0 | 1 | 2;
  inlineMarkers: boolean;
  jati?: JatiName;
}

export interface TalaError {
  error: string;
}

export interface Lyric {
  text: string;
  lang: Lang;
  missing?: boolean;
}

export type EventKind = 'swara' | 'karvai' | 'dash' | 'empty' | 'same';

export interface NoteEvent {
  kind: EventKind;
  /** start time in aksharas (absolute in a segment, row-relative in a Row) */
  t: number;
  dur: number;
  /** ( ) group ids, outermost first; length = speed-line depth */
  path: number[];
  lyrics: (Lyric | undefined)[];
  phraseEnd: boolean;
  /** the S: line it was written on */
  line?: number;
  /** hyphens written after the phrase end (p- is 1, p-- is 2…); each one after the first adds space */
  phraseLen?: number;
  // swaras
  note?: string;
  long?: boolean;
  display?: string;
  variant?: string | null;
  octave?: number;
  gamaka?: string | null;
  lang?: LangSpec;
  // pauses
  text?: string;
}

export interface Marker {
  t: number;
  kind: '|' | '||';
}

export interface Gap {
  t: number;
  size: 'akshara' | 'anga' | 'phrase';
}

export interface InlineMark {
  t: number;
  kind: string;
}

export interface Interval {
  t0: number;
  t1: number;
  /** position in the tala pattern; rows with equal keys line up */
  key: number | null;
  sep: '|' | '||' | 'akshara' | 'anga' | null;
}

export interface SpeedGroup {
  start: number;
  end: number;
  depth: number;
}

export interface LyricItem {
  t: number;
  text: string;
  lang: Lang;
  missing?: boolean;
}

export interface Row {
  width: number;
  events: NoteEvent[];
  groups: SpeedGroup[];
  markers: Marker[];
  gaps: Gap[];
  inline: InlineMark[];
  label: string | null;
  align: boolean;
  intervals: Interval[];
  leadMarker: '|' | '||' | null;
  lyricLines: LyricItem[][];
}

export interface Prefs {
  size?: number;
  color?: string;
}

export interface PhraseEnds {
  style: 'hide' | 'show' | 'handle' | 'handlethick';
  /** pixels of space after a phrase end (5 unless PhraseEnds gives a number) */
  space: number;
  /** the space was written in PhraseEnds:, so p-- p--- step by it too */
  custom?: boolean;
}

/** A phrase end leaves this much space (px) unless PhraseEnds says otherwise. */
export const PHRASE_GAP = 5;

export interface StaffBlock {
  type: 'staff';
  tala: Tala | null;
  layout: 'krithi' | 'varnam' | 'gitam';
  fullWidth: boolean;
  /** Layout: …,Compact — rows keep their natural widths (bars are not lined up across rows) */
  compact: boolean;
  /** Spacing: — how much room between swaras, lyrics and bars; 1 is the usual */
  spacing: number;
  /** Grouping: Off — no gap between the beats (capu talas) or aksharas (gitam, varnam) inside a bar */
  grouping: boolean;
  perRow: number | null;
  speedMarks: 'above' | 'below';
  phraseEnds: PhraseEnds;
  prefs: { swara: Prefs; lyric: Prefs; gamaka: Prefs };
  rows: Row[];
  line: number;
}

export interface HeadingBlock {
  type: 'heading';
  html: string;
  size?: number | null;
  color?: string | null;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  align?: string;
  font?: string | null;
  lang: Lang;
  section?: boolean;
}

export type MetaKind = 'raga' | 'aro' | 'ava' | 'composer' | 'tala';
export type MetaAlign = 'left' | 'center' | 'right';

/**
 * Where the song details go (SongInfo: directive). Composer, the raga with its
 * scale, and the tala each go left, centre or right; those on the same side
 * stack in that order (composer, raga, tala).
 */
export interface MetaLayout {
  composer: MetaAlign;
  raga: MetaAlign;
  /** raga, ārōhaṇam, avarōhaṇam: each on its own line, raga then the scale, or all on one line */
  ragaLines: 'lines' | 'two' | 'one';
  tala: MetaAlign;
  /** text size in points, on the same scale as Heading sizes; unset = the usual size */
  size?: number;
  /** ārōhaṇam and avarōhaṇam labelled short: Ar / Av, or the long and short a of the script */
  short?: boolean;
}

export interface MetaBlock {
  type: 'meta';
  items: MetaItem[];
  layout?: MetaLayout;
}

export interface MetaItem {
  label: string;
  kind?: MetaKind;
  value: string;
  /** the value as shown (transliterated), when it differs from value */
  text?: string;
  /** a short label (Ar / Av, or ಆ / ಅ in an Indian script), for SongInfo … Short */
  short?: string;
  swaras?: NoteEvent[];
  lang?: LangSpec;
}

export type Block =
  | StaffBlock
  | HeadingBlock
  /** a blank line: Heading: "" (small), or SongBreak (a full line, so the break shows) */
  | { type: 'space'; songBreak?: boolean }
  | { type: 'pagebreak' }
  | MetaBlock;

export interface Warning {
  line: number;
  message: string;
}

export interface NotationDoc {
  title: string;
  page: { orientation: 'portrait' | 'landscape'; size: string; margins?: import('./page').Margins };
  langFonts: Partial<Record<Lang, string>>;
  blocks: Block[];
  warnings: Warning[];
}
