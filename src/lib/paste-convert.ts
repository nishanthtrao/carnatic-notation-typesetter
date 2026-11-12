/*
 * Pasting lyrics or swaras written in an Indian script: convert them into the
 * typing scheme so they can be edited and printed in any language.
 * SPDX-License-Identifier: GPL-2.0-only
 */
import { detectScript, fromScript, SWARA_TEXT } from '../engine';

const INDIC = /[ऀ-ൿ]/;

// swara syllables in every script -> s r g m p d n (long forms -> sa ri …)
const SWARA_BACK = new Map<string, string>();
for (const table of Object.values(SWARA_TEXT)) {
  for (const [k, [short, long]] of Object.entries(table)) {
    SWARA_BACK.set(short, k);
    SWARA_BACK.set(long, k === 'r' || k === 'n' ? k + 'i' : k + 'a');
  }
}
// other spellings seen in notation books
for (const [g, k] of Object.entries({ 'द': 'd', 'दा': 'da', 'ధ': 'd', 'ಧ': 'd', 'ദ': 'd', 'ச': 's', 'சா': 'sa', 'ஸ': 's' })) SWARA_BACK.set(g, k);

const SCRIPT_NAMES: Record<string, string> = {
  devanagari: 'Sanskrit (Devanagari)',
  telugu: 'Telugu',
  kannada: 'Kannada',
  malayalam: 'Malayalam',
  tamil: 'Tamil',
};
const LANGUAGE_WORD: Record<string, string> = { devanagari: 'Sanskrit', telugu: 'Telugu', kannada: 'Kannada', malayalam: 'Malayalam', tamil: 'Tamil' };

export function hasIndic(text: string): boolean {
  return INDIC.test(text);
}

function convertSwaras(s: string): string {
  return s.replace(/[^\s,;|()_'`~^/\\-]+/g, (tok) => SWARA_BACK.get(tok) ?? (INDIC.test(tok) ? fromScript(tok) : tok));
}

/**
 * Convert pasted text. Lines starting with S: are swaras; other directive
 * lines and plain lines are words, except plain lines pasted into an S line.
 */
export function convertPasted(text: string, intoSwaraLine: boolean): { text: string; script: string | null; scriptName: string; languageWord: string } {
  const script = detectScript(text);
  const out = text
    .split('\n')
    .map((line, i) => {
      if (!INDIC.test(line)) return line;
      const m = line.match(/^(\s*S\s*:)(.*)$/i);
      if (m) return m[1] + convertSwaras(m[2]);
      const directive = /^\s*[A-Za-z]+\s*:/.test(line);
      if (!directive && intoSwaraLine && i === 0) return convertSwaras(line);
      return fromScript(line);
    })
    .join('\n');
  return { text: out, script, scriptName: script ? SCRIPT_NAMES[script] : '', languageWord: script ? LANGUAGE_WORD[script] : '' };
}
