/*
 * Bundled font styles for the LanguageFont directive.
 * SPDX-License-Identifier: GPL-2.0-only
 *
 * Every language has four bundled styles, each from a different class:
 *   Serif   - Noto Serif (default): book style with stroke contrast
 *   Sans    - Anek (Ek Type): clean, even strokes
 *   Rounded - Nunito (Latin) with the Baloo 2 family (Indic scripts): soft and rounded
 *             (Baloo 2's own Latin accents render detached, so Nunito covers Latin)
 *   Handwritten - a handwriting style in each script: Kalam (Latin, Devanagari), Gurajada (Telugu),
 *             Akaya Kanadaka (Kannada), Chilanka (Malayalam), Kavivanar (Tamil)
 * The font files are in src/assets/fonts and declared in src/styles/fonts.css.
 */

import type { Lang } from './types';

export type FontStyle = 'serif' | 'sans' | 'rounded' | 'handwritten';

export const FONT_STYLES: { id: FontStyle; name: string; label: string; about: string }[] = [
  { id: 'serif', name: 'Serif', label: 'Serif', about: 'Noto Serif: classic book style (default)' },
  { id: 'sans', name: 'Sans', label: 'Sans', about: 'Anek: clean and even' },
  { id: 'rounded', name: 'Rounded', label: 'Rounded', about: 'Nunito and Baloo: soft and friendly' },
  { id: 'handwritten', name: 'Handwritten', label: 'Handwritten', about: 'Like a teacher’s handwritten notes' },
];

type Script = Exclude<Lang, 'english' | 'iast'>;

const LATIN: Record<FontStyle, string> = { serif: 'Noto Serif', sans: 'Anek Latin', rounded: 'Nunito', handwritten: 'Kalam' };

const SCRIPT: Record<FontStyle, Record<Script, string>> = {
  serif: {
    devanagari: 'Noto Serif Devanagari',
    telugu: 'Noto Serif Telugu',
    kannada: 'Noto Serif Kannada',
    malayalam: 'Noto Serif Malayalam',
    tamil: 'Noto Serif Tamil',
  },
  sans: {
    devanagari: 'Anek Devanagari',
    telugu: 'Anek Telugu',
    kannada: 'Anek Kannada',
    malayalam: 'Anek Malayalam',
    tamil: 'Anek Tamil',
  },
  rounded: {
    devanagari: 'Baloo 2',
    telugu: 'Baloo Tammudu 2',
    kannada: 'Baloo Tamma 2',
    malayalam: 'Baloo Chettan 2',
    tamil: 'Baloo Thambi 2',
  },
  handwritten: {
    devanagari: 'Kalam',
    telugu: 'Gurajada',
    kannada: 'Akaya Kanadaka',
    malayalam: 'Chilanka',
    tamil: 'Kavivanar',
  },
};

/** 'Sans' -> 'sans'; anything that is not a bundled style -> null. */
export function parseFontStyle(name: string): FontStyle | null {
  const k = name.trim().toLowerCase();
  if (k === 'handwriting' || k === 'hand') return 'handwritten';
  return k === 'serif' || k === 'sans' || k === 'rounded' || k === 'handwritten' ? k : null;
}

/** CSS font-family list for a bundled style in one language (Latin companion included). */
export function styleFamilies(style: FontStyle, lang: Lang = 'english'): string {
  const fams = lang === 'english' || lang === 'iast' ? [LATIN[style]] : [SCRIPT[style][lang], LATIN[style]];
  return [...new Set(fams)].map((f) => "'" + f + "'").join(', ');
}
