/* Directive catalogue for Assist and TAB completion. */
import { listTalas } from '../engine';

export interface DirectiveInfo {
  name: string;
  template: string;
  help: string;
}

export const DIRECTIVES: DirectiveInfo[] = [
  ['Tala', 'Tala: Adi', 'Tala of the song'],
  ['Layout', 'Layout: krithi', 'krithi, varnam or gitam; options: ,Compact ,FullWidth'],
  ['DefaultSpeed', 'DefaultSpeed: 1', 'Default speed: 0, 1 or 2'],
  ['Heading', 'Heading: ""', 'Song title, section names, text'],
  ['S', 'S: ', 'Swaras'],
  ['L', 'L: ', 'Lyrics for the swaras above'],
  ['Language', 'Language: English', 'Script for swaras and lyrics'],
  ['SmartLyricMode', 'SmartLyricMode', 'Lyrics need no _ for pauses'],
  ['Gati', 'Gati: tisra', 'Change gati (nadai)'],
  ['SpeedMarks', 'SpeedMarks: above', 'Speed lines above or below'],
  ['PhraseEnds', 'PhraseEnds: Show,10', 'How phrase ends (p-) look'],
  ['SwaraPrefs', 'SwaraPrefs: 12', 'Swara size and colour'],
  ['LyricPrefs', 'LyricPrefs: 12', 'Lyric size and colour'],
  ['HeadingPrefs', 'HeadingPrefs: 12', 'Default heading size, colour'],
  ['GamakaPrefs', 'GamakaPrefs: 10', 'Text gamaka size, colour'],
  ['LanguageFont', 'LanguageFont: All,Sans', 'Font style for a language: Serif, Sans, Rounded or an installed font'],
  ['Title', 'Title: ""', 'Page title (print header)'],
  ['SongBreak', 'SongBreak', 'Start a new line and tala cycle'],
  ['LineBreak', 'LineBreak', 'New line in manual tala mode'],
  ['Pagebreak', 'Pagebreak', 'Page break when printing'],
  ['Orientation', 'Orientation: Landscape', 'Portrait or Landscape'],
].map(([name, template, help]) => ({ name, template, help }));

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
