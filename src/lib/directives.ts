/* Directive catalogue for Assist and TAB completion. */
import { listTalas } from '../engine';

export type GroupId = 'song' | 'lines' | 'rhythm' | 'layout' | 'script' | 'look';

/** Assist groups directives by what they are for, in this order. */
export const DIRECTIVE_GROUPS: { id: GroupId; title: string; about: string }[] = [
  { id: 'song', title: 'Song details', about: 'Name, raga and scale; headings for sections' },
  { id: 'lines', title: 'Notation lines', about: 'The swaras and lyrics themselves' },
  { id: 'rhythm', title: 'Tala and speed', about: 'Near the top; Gati can change mid-song' },
  { id: 'script', title: 'Language and fonts', about: 'Script and lettering style' },
  { id: 'layout', title: 'Lines and pages', about: 'Where lines and pages break' },
  { id: 'look', title: 'Sizes and colours', about: 'Applies from that line onwards' },
];

export interface DirectiveInfo {
  name: string;
  template: string;
  help: string;
  group: GroupId;
}

// Order matters for TAB completion (first match wins: S before SmartLyricMode).
export const DIRECTIVES: DirectiveInfo[] = (
  [
    ['Tala', 'Tala: Adi', 'Tala of the song', 'rhythm'],
    ['Layout', 'Layout: krithi', 'Krithi, varnam or gitam spacing; compact or full width', 'layout'],
    ['DefaultSpeed', 'DefaultSpeed: 1', 'First, second or third speed', 'rhythm'],
    ['Heading', 'Heading: ""', 'Song name, section names, any text', 'song'],
    ['Arohana', 'Arohana: ', 'The scale, going up', 'song'],
    ['Avarohana', 'Avarohana: ', 'The scale, coming down', 'song'],
    ['Raga', 'Raga: ', 'Raga name, shown with the scale', 'song'],
    ['Composer', 'Composer: ', 'Composer name', 'song'],
    ['S', 'S: ', 'A line of swaras', 'lines'],
    ['L', 'L: ', 'Lyrics under the swaras above', 'lines'],
    ['Language', 'Language: English', 'Script for swaras and lyrics', 'script'],
    ['SmartLyricMode', 'SmartLyricMode', 'Lyrics skip pauses on their own', 'lines'],
    ['Gati', 'Gati: tisra', 'Change the gati (nadai)', 'rhythm'],
    ['SpeedMarks', 'SpeedMarks: above', 'Speed lines above or below', 'rhythm'],
    ['PhraseEnds', 'PhraseEnds: Show,10', 'How phrase ends (p-) look', 'rhythm'],
    ['SwaraPrefs', 'SwaraPrefs: 12', 'Swara size and colour', 'look'],
    ['LyricPrefs', 'LyricPrefs: 12', 'Lyric size and colour', 'look'],
    ['HeadingPrefs', 'HeadingPrefs: 12', 'Heading size and colour', 'look'],
    ['GamakaPrefs', 'GamakaPrefs: 10', 'Gamaka text size and colour', 'look'],
    ['LanguageFont', 'LanguageFont: All,Sans', 'Serif, Sans, Rounded or an installed font', 'script'],
    ['Title', 'Title: ""', 'File name and print header', 'song'],
    ['SongBreak', 'SongBreak', 'Start a new line and tala cycle', 'layout'],
    ['LineBreak', 'LineBreak', 'New line (manual tala mode)', 'layout'],
    ['Pagebreak', 'Pagebreak', 'New page when printing', 'layout'],
    ['Orientation', 'Orientation: Landscape', 'Portrait or landscape page', 'layout'],
  ] as [string, string, string, GroupId][]
).map(([name, template, help, group]) => ({ name, template, help, group }));

/** The order directives are shown in within each Assist group. */
export const GROUP_ORDER: string[] = [
  'Title', 'Heading', 'Raga', 'Arohana', 'Avarohana', 'Composer',
  'S', 'L', 'SmartLyricMode',
  'Tala', 'DefaultSpeed', 'Gati', 'SpeedMarks', 'PhraseEnds',
  'Language', 'LanguageFont',
  'Layout', 'SongBreak', 'LineBreak', 'Pagebreak', 'Orientation',
  'SwaraPrefs', 'LyricPrefs', 'GamakaPrefs', 'HeadingPrefs',
];

export const NO_VALUE = new Set(['SmartLyricMode', 'SongBreak', 'LineBreak', 'Pagebreak']);

export const LANG_OPTIONS: [string, string][] = [
  ['English', 'English'],
  ['Diacritics', 'English with diacritics'],
  ['Sanskrit', 'Sanskrit'],
  ['Telugu', 'Telugu'],
  ['Kannada', 'Kannada'],
  ['Malayalam', 'Malayalam'],
  ['Tamil', 'Tamil'],
];
export const LAYOUT_OPTIONS: [string, string][] = [
  ['krithi', 'Krithi (default)'],
  ['varnam', 'Varnam'],
  ['gitam', 'Gitam'],
];
export const talaOptions = (): [string, string][] =>
  listTalas()
    .filter((t) => !t.spec.includes(',') && t.spec !== 'Manual')
    .map((t): [string, string] => [t.spec, t.label])
    .concat([['Manual', 'Manual (no tala)']]);

const VALUE_COMPLETIONS: Record<string, () => string[]> = {
  tala: () => listTalas().map((t) => t.spec),
  language: () => LANG_OPTIONS.map(([v]) => v),
  layout: () => ['krithi', 'varnam', 'gitam'],
  gati: () => ['tisra', 'catusra', 'khanda', 'misra', 'sankirna'],
  speedmarks: () => ['above', 'below'],
  phraseends: () => ['Hide', 'Show', 'Handle', 'HandleThick'],
  orientation: () => ['Portrait', 'Landscape'],
  defaultspeed: () => ['0', '1', '2'],
  languagefont: () => ['All', ...LANG_OPTIONS.map(([v]) => v)],
};

/**
 * TAB completion for the text before the cursor on the current line.
 * Returns how many characters to replace and the replacement, or null.
 */
export function complete(before: string): { remove: number; insert: string } | null {
  let m = before.match(/^(\s*)([A-Za-z]+)$/);
  if (m) {
    const word = m[2].toLowerCase();
    const hit = DIRECTIVES.find((d) => d.name.toLowerCase().startsWith(word));
    if (!hit) return null;
    return { remove: m[2].length, insert: hit.name + (NO_VALUE.has(hit.name) ? '' : ': ') };
  }
  m = before.match(/^\s*([A-Za-z]+)\s*:\s*(\S*)$/);
  if (m && VALUE_COMPLETIONS[m[1].toLowerCase()]) {
    const word = m[2].toLowerCase();
    if (!word) return null;
    const hit = VALUE_COMPLETIONS[m[1].toLowerCase()]().find((v) => v.toLowerCase().startsWith(word) && v.toLowerCase() !== word);
    return hit ? { remove: m[2].length, insert: hit } : null;
  }
  return null;
}
