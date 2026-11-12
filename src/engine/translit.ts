/*
 * Carnatic Music Notation Typesetter — transliteration
 * SPDX-License-Identifier: GPL-2.0-or-later
 *
 * Converts lyrics typed in the Unified Transliteration Scheme (a Harvard-Kyoto
 * style roman scheme, e.g. "SrI kamalAmbikAyAm", "dEvi nIyE tuNai") into
 * IAST, Devanagari, Telugu, Kannada, Malayalam and Tamil.
 *
 * Vowels:  a A/aa i I/ii/ee u U/uu/oo R(ṛ) RR(ṝ) e E ai o O au
 * Marks:   M (anusvara ṃ)  H (visarga ḥ)
 * Consonants: k kh g gh G/~N/#n(ṅ)  c ch j jh J/~n(ñ)  T Th D Dh N
 *             t th d dh n  p ph/f b bh m  y r l v/w  S(ś) sh/Sh(ṣ) s h
 *             L(ḷ, ள)  zh(ḻ, ழ)  _r(ṟ, ற)  _n(ṉ, ன)  x/ksh(kṣ)  jn(jñ)
 *             ^n or n2 (dental n, Tamil ந)
 * A "." between letters only separates them ("sR.ShTi" -> sṛṣṭi).
 *
 * Tamil follows the v1.5 manual: in lyrics "n" is always ன (use ^n or n2 for
 * ந); qualifiers (க² க³ க⁴ ...) mark sounds Tamil lacks unless the language is
 * given as Tamil:noqual; Tamil:granthasa uses ஶ for S.
 *
 * Malayalam follows modern spelling: at the end of a word (or lyric syllable)
 * n N r l L take their chillu forms (ൻ ൺ ർ ൽ ൾ) and m becomes anusvara (ം).
 * Malayalam:nochillu keeps the plain virama form (ന്) instead.
 */
import type { Lang, LangOpts, LangSpec } from './types';

type IndicScript = 'devanagari' | 'telugu' | 'kannada' | 'malayalam' | 'tamil';
type VowelKey = 'a' | 'A' | 'i' | 'I' | 'u' | 'U' | 'R' | 'RR' | 'e' | 'E' | 'ai' | 'o' | 'O' | 'au';

interface ScriptTable {
  vowels: Record<VowelKey, string>;
  signs: Record<VowelKey, string>;
  cons: Record<string, string>;
  virama: string;
  M: string;
  H: string;
}

interface Token {
  t: 'v' | 'c' | 'm' | 'x';
  k: string;
}

const VOWELS: [string, VowelKey][] = [
  ['aa', 'A'], ['ii', 'I'], ['ee', 'I'], ['uu', 'U'], ['oo', 'U'],
  ['ai', 'ai'], ['au', 'au'], ['RR', 'RR'],
  ['A', 'A'], ['I', 'I'], ['U', 'U'], ['E', 'E'], ['O', 'O'],
  ['a', 'a'], ['i', 'i'], ['u', 'u'], ['e', 'e'], ['o', 'o'], ['R', 'R'],
];
const CONSONANTS: [string, string[]][] = [
  ['ksh', ['k', 'sh']], ['jn', ['j', 'J']], ['~N', ['G']], ['~n', ['J']],
  ['#n', ['G']], ['^n', ['n2']], ['n2', ['n2']],
  ['kh', ['kh']], ['gh', ['gh']], ['ch', ['ch']], ['jh', ['jh']],
  ['Th', ['Th']], ['Dh', ['Dh']], ['th', ['th']], ['dh', ['dh']],
  ['ph', ['ph']], ['bh', ['bh']], ['sh', ['sh']], ['Sh', ['sh']],
  ['zh', ['zh']], ['_r', ['rr']], ['_n', ['nn']],
  ['k', ['k']], ['g', ['g']], ['G', ['G']], ['c', ['c']], ['j', ['j']], ['J', ['J']],
  ['T', ['T']], ['D', ['D']], ['N', ['N']], ['t', ['t']], ['d', ['d']], ['n', ['n']],
  ['p', ['p']], ['f', ['ph']], ['b', ['b']], ['m', ['m']], ['y', ['y']], ['r', ['r']],
  ['l', ['l']], ['v', ['v']], ['w', ['v']], ['S', ['S']], ['s', ['s']], ['h', ['h']],
  ['L', ['L']], ['x', ['k', 'sh']], ['z', ['S']], ['q', ['k']],
];

type Entry = { s: string; t: 'v'; k: VowelKey } | { s: string; t: 'c'; ks: string[] } | { s: string; t: 'm'; k: 'M' | 'H' };
const TABLE: Entry[] = [
  ...VOWELS.map(([s, k]): Entry => ({ s, t: 'v', k })),
  ...CONSONANTS.map(([s, ks]): Entry => ({ s, t: 'c', ks })),
  { s: 'M', t: 'm', k: 'M' } as Entry,
  { s: 'H', t: 'm', k: 'H' } as Entry,
].sort((a, b) => b.s.length - a.s.length);

export function tokenize(text: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < text.length) {
    // "." between two letters only separates them (sR.Sh -> s R Sh)
    if (text[i] === '.' && out.length && out[out.length - 1].t !== 'x' && /[A-Za-z#^~_]/.test(text[i + 1] || '')) {
      i += 1;
      continue;
    }
    const hit = TABLE.find((e) => text.startsWith(e.s, i));
    if (!hit) {
      out.push({ t: 'x', k: text[i] });
      i += 1;
      continue;
    }
    if (hit.t === 'c') hit.ks.forEach((k) => out.push({ t: 'c', k }));
    else out.push({ t: hit.t, k: hit.k });
    i += hit.s.length;
  }
  return out;
}

// ---- script tables ----------------------------------------------------------
const SCRIPTS: Record<IndicScript, ScriptTable> = {
  devanagari: {
    vowels: { a: 'अ', A: 'आ', i: 'इ', I: 'ई', u: 'उ', U: 'ऊ', R: 'ऋ', RR: 'ॠ', e: 'ए', E: 'ए', ai: 'ऐ', o: 'ओ', O: 'ओ', au: 'औ' },
    signs: { a: '', A: 'ा', i: 'ि', I: 'ी', u: 'ु', U: 'ू', R: 'ृ', RR: 'ॄ', e: 'े', E: 'े', ai: 'ै', o: 'ो', O: 'ो', au: 'ौ' },
    cons: {
      k: 'क', kh: 'ख', g: 'ग', gh: 'घ', G: 'ङ', c: 'च', ch: 'छ', j: 'ज', jh: 'झ', J: 'ञ',
      T: 'ट', Th: 'ठ', D: 'ड', Dh: 'ढ', N: 'ण', t: 'त', th: 'थ', d: 'द', dh: 'ध', n: 'न',
      p: 'प', ph: 'फ', b: 'ब', bh: 'भ', m: 'म', y: 'य', r: 'र', l: 'ल', v: 'व',
      S: 'श', sh: 'ष', s: 'स', h: 'ह', L: 'ळ', zh: 'ऴ', rr: 'ऱ', nn: 'ऩ', n2: 'न',
    },
    virama: '्', M: 'ं', H: 'ः',
  },
  telugu: {
    vowels: { a: 'అ', A: 'ఆ', i: 'ఇ', I: 'ఈ', u: 'ఉ', U: 'ఊ', R: 'ఋ', RR: 'ౠ', e: 'ఎ', E: 'ఏ', ai: 'ఐ', o: 'ఒ', O: 'ఓ', au: 'ఔ' },
    signs: { a: '', A: 'ా', i: 'ి', I: 'ీ', u: 'ు', U: 'ూ', R: 'ృ', RR: 'ౄ', e: 'ె', E: 'ే', ai: 'ై', o: 'ొ', O: 'ో', au: 'ౌ' },
    cons: {
      k: 'క', kh: 'ఖ', g: 'గ', gh: 'ఘ', G: 'ఙ', c: 'చ', ch: 'ఛ', j: 'జ', jh: 'ఝ', J: 'ఞ',
      T: 'ట', Th: 'ఠ', D: 'డ', Dh: 'ఢ', N: 'ణ', t: 'త', th: 'థ', d: 'ద', dh: 'ధ', n: 'న',
      p: 'ప', ph: 'ఫ', b: 'బ', bh: 'భ', m: 'మ', y: 'య', r: 'ర', l: 'ల', v: 'వ',
      S: 'శ', sh: 'ష', s: 'స', h: 'హ', L: 'ళ', zh: 'ఴ', rr: 'ఱ', nn: 'న', n2: 'న',
    },
    virama: '్', M: 'ం', H: 'ః',
  },
  kannada: {
    vowels: { a: 'ಅ', A: 'ಆ', i: 'ಇ', I: 'ಈ', u: 'ಉ', U: 'ಊ', R: 'ಋ', RR: 'ೠ', e: 'ಎ', E: 'ಏ', ai: 'ಐ', o: 'ಒ', O: 'ಓ', au: 'ಔ' },
    signs: { a: '', A: 'ಾ', i: 'ಿ', I: 'ೀ', u: 'ು', U: 'ೂ', R: 'ೃ', RR: 'ೄ', e: 'ೆ', E: 'ೇ', ai: 'ೈ', o: 'ೊ', O: 'ೋ', au: 'ೌ' },
    cons: {
      k: 'ಕ', kh: 'ಖ', g: 'ಗ', gh: 'ಘ', G: 'ಙ', c: 'ಚ', ch: 'ಛ', j: 'ಜ', jh: 'ಝ', J: 'ಞ',
      T: 'ಟ', Th: 'ಠ', D: 'ಡ', Dh: 'ಢ', N: 'ಣ', t: 'ತ', th: 'ಥ', d: 'ದ', dh: 'ಧ', n: 'ನ',
      p: 'ಪ', ph: 'ಫ', b: 'ಬ', bh: 'ಭ', m: 'ಮ', y: 'ಯ', r: 'ರ', l: 'ಲ', v: 'ವ',
      S: 'ಶ', sh: 'ಷ', s: 'ಸ', h: 'ಹ', L: 'ಳ', zh: 'ೞ', rr: 'ಱ', nn: 'ನ', n2: 'ನ',
    },
    virama: '್', M: 'ಂ', H: 'ಃ',
  },
  malayalam: {
    vowels: { a: 'അ', A: 'ആ', i: 'ഇ', I: 'ഈ', u: 'ഉ', U: 'ഊ', R: 'ഋ', RR: 'ൠ', e: 'എ', E: 'ഏ', ai: 'ഐ', o: 'ഒ', O: 'ഓ', au: 'ഔ' },
    signs: { a: '', A: 'ാ', i: 'ി', I: 'ീ', u: 'ു', U: 'ൂ', R: 'ൃ', RR: 'ൄ', e: 'െ', E: 'േ', ai: 'ൈ', o: 'ൊ', O: 'ോ', au: 'ൌ' },
    cons: {
      k: 'ക', kh: 'ഖ', g: 'ഗ', gh: 'ഘ', G: 'ങ', c: 'ച', ch: 'ഛ', j: 'ജ', jh: 'ഝ', J: 'ഞ',
      T: 'ട', Th: 'ഠ', D: 'ഡ', Dh: 'ഢ', N: 'ണ', t: 'ത', th: 'ഥ', d: 'ദ', dh: 'ധ', n: 'ന',
      p: 'പ', ph: 'ഫ', b: 'ബ', bh: 'ഭ', m: 'മ', y: 'യ', r: 'ര', l: 'ല', v: 'വ',
      S: 'ശ', sh: 'ഷ', s: 'സ', h: 'ഹ', L: 'ള', zh: 'ഴ', rr: 'റ', nn: 'ന', n2: 'ന',
    },
    virama: '്', M: 'ം', H: 'ഃ',
  },
  tamil: {
    vowels: { a: 'அ', A: 'ஆ', i: 'இ', I: 'ஈ', u: 'உ', U: 'ஊ', R: 'ரு', RR: 'ரூ', e: 'எ', E: 'ஏ', ai: 'ஐ', o: 'ஒ', O: 'ஓ', au: 'ஔ' },
    signs: { a: '', A: 'ா', i: 'ி', I: 'ீ', u: 'ு', U: 'ூ', R: '்ரு', RR: '்ரூ', e: 'ெ', E: 'ே', ai: 'ை', o: 'ொ', O: 'ோ', au: 'ௌ' },
    cons: {
      k: 'க', kh: 'க', g: 'க', gh: 'க', G: 'ங', c: 'ச', ch: 'ச', j: 'ஜ', jh: 'ஜ', J: 'ஞ',
      T: 'ட', Th: 'ட', D: 'ட', Dh: 'ட', N: 'ண', t: 'த', th: 'த', d: 'த', dh: 'த', n: 'ந',
      p: 'ப', ph: 'ப', b: 'ப', bh: 'ப', m: 'ம', y: 'ய', r: 'ர', l: 'ல', v: 'வ',
      S: 'ஸ', sh: 'ஷ', s: 'ஸ', h: 'ஹ', L: 'ள', zh: 'ழ', rr: 'ற', nn: 'ன', n2: 'ந',
    },
    virama: '்', M: 'ம்', H: 'ஃ',
  },
};

const IAST = {
  vowels: { a: 'a', A: 'ā', i: 'i', I: 'ī', u: 'u', U: 'ū', R: 'ṛ', RR: 'ṝ', e: 'e', E: 'ē', ai: 'ai', o: 'o', O: 'ō', au: 'au' },
  cons: {
    k: 'k', kh: 'kh', g: 'g', gh: 'gh', G: 'ṅ', c: 'c', ch: 'ch', j: 'j', jh: 'jh', J: 'ñ',
    T: 'ṭ', Th: 'ṭh', D: 'ḍ', Dh: 'ḍh', N: 'ṇ', t: 't', th: 'th', d: 'd', dh: 'dh', n: 'n',
    p: 'p', ph: 'ph', b: 'b', bh: 'bh', m: 'm', y: 'y', r: 'r', l: 'l', v: 'v',
    S: 'ś', sh: 'ṣ', s: 's', h: 'h', L: 'ḷ', zh: 'ḻ', rr: 'ṟ', nn: 'ṉ', n2: 'n',
  },
  M: 'ṃ', H: 'ḥ',
};

function toIAST(tokens: Token[]): string {
  let out = '';
  for (const tk of tokens) {
    if (tk.t === 'v') out += IAST.vowels[tk.k as VowelKey];
    else if (tk.t === 'c') out += (IAST.cons as Record<string, string>)[tk.k];
    else if (tk.t === 'm') out += tk.k === 'M' ? IAST.M : IAST.H;
    else out += tk.k;
  }
  return out;
}

// Malayalam word-final forms (chillu letters; m -> anusvara)
const ML_FINAL: Record<string, string> = { n: 'ൻ', nn: 'ൻ', n2: 'ൻ', N: 'ൺ', r: 'ർ', l: 'ൽ', L: 'ൾ', m: 'ം' };

// Tamil qualifiers for sounds the Tamil script does not distinguish.
const TAMIL_QUAL: Record<string, string> = {
  kh: '²', g: '³', gh: '⁴', ch: '²', jh: '²', Th: '²', D: '³', Dh: '⁴',
  th: '²', d: '³', dh: '⁴', ph: '²', b: '³', bh: '⁴',
};

function toScript(tokens: Token[], scriptName: IndicScript, opts: LangOpts): string {
  const sc = SCRIPTS[scriptName];
  const tamil = scriptName === 'tamil';
  const qual = tamil && opts.qual !== false;
  let out = '';
  for (let i = 0; i < tokens.length; i++) {
    const tk = tokens[i];
    const next = tokens[i + 1];
    if (tk.t === 'c') {
      let glyph = sc.cons[tk.k];
      if (tamil && tk.k === 'n') glyph = tamilN(tokens, i, opts);
      if (tamil && tk.k === 'S' && opts.granthasa) glyph = 'ஶ';
      const q = qual && TAMIL_QUAL[tk.k] ? TAMIL_QUAL[tk.k] : '';
      if (next && next.t === 'v') {
        out += glyph + sc.signs[next.k as VowelKey] + q;
        i += 1;
      } else if (scriptName === 'malayalam' && opts.chillu !== false && ML_FINAL[tk.k] && (!next || next.t === 'x')) {
        out += ML_FINAL[tk.k];
      } else {
        out += glyph + sc.virama + q;
      }
    } else if (tk.t === 'v') out += sc.vowels[tk.k as VowelKey];
    else if (tk.t === 'm') out += tk.k === 'M' ? sc.M : sc.H;
    else out += tk.k;
  }
  return out;
}

// Tamil has two n letters: ந (dental) and ன (alveolar). Before த it is ந. In
// lyrics (syllables split by spaces) plain n is ன, as in the v1.5 manual;
// elsewhere ந is used at the start of a word.
function tamilN(tokens: Token[], i: number, opts: LangOpts): string {
  const prev = tokens[i - 1];
  const next = tokens[i + 1];
  if (next && next.t === 'c' && ['t', 'th', 'd', 'dh'].includes(next.k)) return 'ந';
  if (opts.lyric) return 'ன';
  return !prev || prev.t === 'x' ? 'ந' : 'ன';
}

export const LANGS: Record<Lang, string> = {
  english: 'English (as typed)',
  iast: 'English with diacritics (IAST)',
  devanagari: 'Sanskrit (Devanagari)',
  telugu: 'Telugu',
  kannada: 'Kannada',
  malayalam: 'Malayalam',
  tamil: 'Tamil',
};
const LANG_ALIASES: Record<string, Lang> = {
  english: 'english', en: 'english', eng: 'english', roman: 'english',
  iast: 'iast', diacritics: 'iast', englishdiacritics: 'iast', diacritic: 'iast', 'english-diacritics': 'iast',
  sanskrit: 'devanagari', devanagari: 'devanagari', hindi: 'devanagari', sa: 'devanagari', marathi: 'devanagari',
  telugu: 'telugu', te: 'telugu',
  kannada: 'kannada', kn: 'kannada',
  malayalam: 'malayalam', ml: 'malayalam',
  tamil: 'tamil', ta: 'tamil',
};

export function normaliseLang(name: string | null | undefined): Lang | null {
  if (!name) return null;
  const k = String(name).split(':')[0].toLowerCase().replace(/[\s_]+/g, '');
  return LANG_ALIASES[k] || null;
}

/** Parse "Tamil:granthasa:noqual:90%" into { lang, opts }. */
export function parseLangSpec(spec: string | null | undefined): LangSpec | null {
  if (!spec) return null;
  const parts = String(spec).split(':').map((p) => p.trim().toLowerCase());
  const lang = normaliseLang(parts[0]);
  if (!lang) return null;
  const opts: LangOpts = {};
  for (const a of parts.slice(1)) {
    if (a === 'granthasa') opts.granthasa = true;
    else if (a === 'nogranthasa') opts.granthasa = false;
    else if (a === 'noqual') opts.qual = false;
    else if (a === 'nohard' || a === 'qual' || a === 'natural') opts.qual = true;
    else if (a === 'nochillu') opts.chillu = false;
    else if (a === 'chillu') opts.chillu = true;
  }
  return { lang, opts };
}

/** Transliterate roman text. ctx.lyric: the text is a lyric fragment. */
export function transliterate(text: string, lang: string | LangSpec | null, ctx?: LangOpts): string {
  const spec = (typeof lang === 'object' && lang ? lang : parseLangSpec(lang as string)) || { lang: 'english' as Lang, opts: {} };
  if (spec.lang === 'english') return text;
  const tokens = tokenize(text);
  if (spec.lang === 'iast') return toIAST(tokens);
  return toScript(tokens, spec.lang, { ...spec.opts, ...(ctx || {}) });
}
