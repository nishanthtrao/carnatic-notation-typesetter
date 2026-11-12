/*
 * What the Letters kit needs from the editor: the language in force at the
 * cursor and the lyric/heading word under it.
 * SPDX-License-Identifier: GPL-2.0-only
 */
import { parseLangSpec, type Lang } from '../engine';

export interface LineAt {
  start: number;
  text: string;
  index: number;
  col: number;
}

/** Lines whose text is lyrics or words (where spelling variants make sense). */
const WORD_LINE = /^(\s*(?:L|Heading|Title)\s*:\s*)(.*)$/i;

export function lettersContext(value: string, line: LineAt): { lang: Lang; word: { text: string; start: number; end: number } | null } {
  // language: the last Language: line at or above the cursor
  let lang: Lang = 'english';
  const lines = value.split('\n').slice(0, line.index + 1);
  for (const l of lines) {
    const m = l.match(/^\s*Language\s*:\s*(.+)$/i);
    const spec = m && parseLangSpec(m[1]);
    if (spec) lang = spec.lang;
  }
  // word: letters (and the . separator) around the cursor, inside the text part
  let word: { text: string; start: number; end: number } | null = null;
  const m = line.text.match(WORD_LINE);
  if (m && line.col >= m[1].length) {
    const isWordChar = (ch: string | undefined) => !!ch && /[A-Za-z#~^_.]/.test(ch);
    let a = line.col;
    let b = line.col;
    while (a > m[1].length && isWordChar(line.text[a - 1])) a--;
    while (b < line.text.length && isWordChar(line.text[b])) b++;
    const text = line.text.slice(a, b).replace(/^\.+|\.+$/g, '');
    if (/[A-Za-z]/.test(text) && text !== '_') {
      const lead = line.text.slice(a, b).indexOf(text);
      word = { text, start: line.start + a + lead, end: line.start + a + lead + text.length };
    }
  }
  return { lang, word };
}
