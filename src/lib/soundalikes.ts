/*
 * Letters kit (toolbar button): groups of similar-sounding letters, how to type each in the
 * Unified Transliteration Scheme, and spelling variants of a word.
 * SPDX-License-Identifier: GPL-2.0-only
 */
import { scanUnits, transliterate, type Lang } from '../engine';

export interface SoundUnit {
  /** transliterator key (see translit.ts) */
  key: string;
  /** how to type it */
  code: string;
  /** other ways to type it */
  alt?: string[];
  kind: 'c' | 'v' | 'm';
  /** IAST name */
  name: string;
  desc: string;
  /** scripts where it is a normal letter (omitted = all) */
  native?: Lang[];
}

export interface SoundGroup {
  id: string;
  title: string;
  units: SoundUnit[];
}

const TA_ML: Lang[] = ['tamil', 'malayalam'];
const SOUTH: Lang[] = ['telugu', 'kannada', 'malayalam', 'tamil'];
const c = (key: string, code: string, name: string, desc: string, extra: Partial<SoundUnit> = {}): SoundUnit => ({ key, code, name, desc, kind: 'c', ...extra });
const v = (key: string, code: string, name: string, desc: string): SoundUnit => ({ key, code, name, desc, kind: 'v' });

export const SOUND_GROUPS: SoundGroup[] = [
  {
    id: 'r',
    title: 'r sounds',
    units: [
      c('r', 'r', 'ra', 'soft r (a tap), as in rAma'),
      c('rr', '_r', 'ṟa', 'hard r (a trill): Malayalam റ, Tamil ற, as in Malayalam aRivu', { native: [...TA_ML, 'telugu', 'kannada'] }),
      v('R', 'R', 'ṛ', 'vowel r, as in kRShNa'),
    ],
  },
  {
    id: 'l',
    title: 'l sounds',
    units: [
      c('l', 'l', 'la', 'ordinary l, as in lalita'),
      c('L', 'L', 'ḷa', 'retroflex l (tongue curled back), as in maMgaLa', { native: SOUTH }),
      c('zh', 'zh', 'ḻa', 'zha of Tamil and Malayalam (ழ ഴ), as in tamizh', { native: TA_ML }),
    ],
  },
  {
    id: 'n',
    title: 'n and nasal sounds',
    units: [
      c('n', 'n', 'na', 'dental n, as in nanda'),
      c('N', 'N', 'ṇa', 'retroflex n, as in kaNNa, guNa'),
      c('nn', '_n', 'ṉa', 'alveolar n: Tamil ன', { native: ['tamil'] }),
      c('G', 'G', 'ṅa', 'velar n, before k or g, as in Sa#nkara', { alt: ['#n', '~N'] }),
      c('J', 'J', 'ña', 'palatal n, before c or j, as in a~njali', { alt: ['~n'] }),
      { key: 'M', code: 'M', name: 'ṃ', desc: 'anusvara (nasal dot), as in saMgIta', kind: 'm' },
    ],
  },
  {
    id: 't',
    title: 't sounds',
    units: [
      c('t', 't', 'ta', 'dental t, as in tAna'),
      c('th', 'th', 'tha', 'dental t with breath, as in kathA'),
      c('T', 'T', 'ṭa', 'retroflex t, as in naTa'),
      c('Th', 'Th', 'ṭha', 'retroflex t with breath, as in maTha'),
    ],
  },
  {
    id: 'd',
    title: 'd sounds',
    units: [
      c('d', 'd', 'da', 'dental d, as in dAsa'),
      c('dh', 'dh', 'dha', 'dental d with breath, as in dhanya'),
      c('D', 'D', 'ḍa', 'retroflex d, as in Damaru'),
      c('Dh', 'Dh', 'ḍha', 'retroflex d with breath'),
    ],
  },
  {
    id: 's',
    title: 's and sh sounds',
    units: [
      c('s', 's', 'sa', 'ordinary s, as in sAma'),
      c('S', 'S', 'śa', 'soft sh, as in Siva, SrI', { alt: ['z'] }),
      c('sh', 'Sh', 'ṣa', 'hard sh, as in kRShNa', { alt: ['sh'] }),
    ],
  },
  {
    id: 'k',
    title: 'k and g sounds',
    units: [c('k', 'k', 'ka', 'as in kamala'), c('kh', 'kh', 'kha', 'k with breath'), c('g', 'g', 'ga', 'as in gAna'), c('gh', 'gh', 'gha', 'g with breath')],
  },
  {
    id: 'c',
    title: 'c and j sounds',
    units: [c('c', 'c', 'ca', 'ch as in cAru'), c('ch', 'ch', 'cha', 'c with breath'), c('j', 'j', 'ja', 'as in jaya'), c('jh', 'jh', 'jha', 'j with breath')],
  },
  {
    id: 'p',
    title: 'p and b sounds',
    units: [c('p', 'p', 'pa', 'as in pada'), c('ph', 'ph', 'pha', 'p with breath', { alt: ['f'] }), c('b', 'b', 'ba', 'as in bala'), c('bh', 'bh', 'bha', 'b with breath, as in bhakti')],
  },
  {
    id: 'h',
    title: 'h sounds',
    units: [c('h', 'h', 'ha', 'as in hari'), { key: 'H', code: 'H', name: 'ḥ', desc: 'visarga (a breath after a vowel), as in namaH', kind: 'm' }],
  },
  {
    id: 'a',
    title: 'a vowels',
    units: [v('a', 'a', 'a', 'short a'), v('A', 'A', 'ā', 'long a, also aa')],
  },
  {
    id: 'i',
    title: 'i vowels',
    units: [v('i', 'i', 'i', 'short i'), v('I', 'I', 'ī', 'long i, also ii or ee')],
  },
  {
    id: 'u',
    title: 'u vowels',
    units: [v('u', 'u', 'u', 'short u'), v('U', 'U', 'ū', 'long u, also uu or oo')],
  },
  {
    id: 'e',
    title: 'e vowels',
    units: [v('e', 'e', 'e', 'short e (South Indian scripts)'), v('E', 'E', 'ē', 'long e'), v('ai', 'ai', 'ai', 'as in kailAsa')],
  },
  {
    id: 'o',
    title: 'o vowels',
    units: [v('o', 'o', 'o', 'short o (South Indian scripts)'), v('O', 'O', 'ō', 'long o'), v('au', 'au', 'au', 'as in gauri')],
  },
  {
    id: 'ri',
    title: 'vowel r',
    units: [v('R', 'R', 'ṛ', 'as in kRShNa'), v('RR', 'RR', 'ṝ', 'long vowel r (rare)')],
  },
];

/** The letter as written in a language (consonants with a, nasal marks after sa). */
export function renderUnit(u: SoundUnit, lang: Lang): string {
  const text = u.kind === 'c' ? u.code + 'a' : u.kind === 'm' ? 'sa' + u.code : u.code;
  return transliterate(text, lang);
}

/** Groups (other than the vowel-r duplicate) a transliterator key belongs to. */
function groupsOf(key: string, kind: 'c' | 'v' | 'm'): SoundGroup[] {
  return SOUND_GROUPS.filter((g) => g.units.some((u) => u.key === key && u.kind === kind));
}

export interface Variant {
  text: string;
  shown: string;
  /** what changed, e.g. "r → _r" */
  change: string;
  current?: boolean;
}

/**
 * Spellings of a word that differ in one similar-sounding letter, keeping only
 * those that look different in the language.
 */
export function wordVariants(word: string, lang: Lang, max = 24): Variant[] {
  const units = scanUnits(word);
  const shownOrig = transliterate(word, lang);
  const out: Variant[] = [{ text: word, shown: shownOrig, change: '', current: true }];
  const seen = new Set([shownOrig]);
  units.forEach((unit, i) => {
    if (unit.t === 'x') return;
    for (const g of groupsOf(unit.key, unit.t as 'c' | 'v' | 'm')) {
      for (const alt of g.units) {
        if (alt.key === unit.key && alt.kind === unit.t) continue;
        // a consonant can only become a consonant; vowels only vowels (keeps words readable)
        if ((alt.kind === 'v') !== (unit.t === 'v')) continue;
        const text = units.map((u, j) => (j === i ? alt.code : u.src)).join('');
        const shown = transliterate(text, lang);
        if (seen.has(shown)) continue;
        seen.add(shown);
        out.push({ text, shown, change: unit.src + ' → ' + alt.code });
        if (out.length >= max) return;
      }
    }
  });
  return out;
}

/** Search the groups by a typed sound, a name (ṟa) or a description word. */
export function searchGroups(q: string): SoundGroup[] {
  const s = q.trim().toLowerCase();
  if (!s) return SOUND_GROUPS;
  return SOUND_GROUPS.filter(
    (g) =>
      g.title.toLowerCase().includes(s) ||
      g.units.some((u) => [u.code, u.name, ...(u.alt || [])].some((x) => x.toLowerCase().startsWith(s)) || u.desc.toLowerCase().includes(s)),
  );
}
