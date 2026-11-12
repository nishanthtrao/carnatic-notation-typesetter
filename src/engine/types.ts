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
  space: number;
}

export interface StaffBlock {
  type: 'staff';
  tala: Tala | null;
  layout: 'krithi' | 'varnam' | 'gitam';
  fullWidth: boolean;
  /** Layout: …,Compact — rows keep their natural widths (bars are not lined up across rows) */
  compact: boolean;
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

export interface MetaItem {
  label: string;
  value: string;
  swaras?: NoteEvent[];
  lang?: LangSpec;
}

export type Block =
  | StaffBlock
  | HeadingBlock
  | { type: 'space' }
  | { type: 'pagebreak' }
  | { type: 'meta'; items: MetaItem[] };

export interface Warning {
  line: number;
  message: string;
}

export interface NotationDoc {
  title: string;
  page: { orientation: 'portrait' | 'landscape'; size: string; margin?: string };
  langFonts: Partial<Record<Lang, string>>;
  blocks: Block[];
  warnings: Warning[];
}
