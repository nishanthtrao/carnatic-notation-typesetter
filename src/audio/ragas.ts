/*
 * Which pitch each swara has: swarasthanas, the 72 melakartas and common
 * janya ragas, and how a song's raga is worked out.
 * SPDX-License-Identifier: GPL-2.0-only
 */

/** Semitones above Sa for each swarasthana. */
export const SEMITONES: Record<string, number> = {
  s: 0, r1: 1, r2: 2, r3: 3, g1: 2, g2: 3, g3: 4, m1: 5, m2: 6, p: 7, d1: 8, d2: 9, d3: 10, n1: 9, n2: 10, n3: 11,
};

/** Variant of each of r g m d n, e.g. { r: 2, g: 3, m: 1, d: 2, n: 3 }. */
export type Scale = Record<'r' | 'g' | 'm' | 'd' | 'n', number>;

export interface Raga {
  name: string;
  /** melakarta number for parent scales */
  mela?: number;
  /** pitches going up; down defaults to the same */
  up: Scale;
  down?: Scale;
}

const MELA_NAMES = [
  'Kanakangi', 'Ratnangi', 'Ganamurti', 'Vanaspati', 'Manavati', 'Tanarupi', 'Senavati', 'Hanumatodi', 'Dhenuka',
  'Natakapriya', 'Kokilapriya', 'Rupavati', 'Gayakapriya', 'Vakulabharanam', 'Mayamalavagowla', 'Chakravakam',
  'Suryakantam', 'Hatakambari', 'Jhankaradhvani', 'Natabhairavi', 'Keeravani', 'Kharaharapriya', 'Gourimanohari',
  'Varunapriya', 'Mararanjani', 'Charukesi', 'Sarasangi', 'Harikambhoji', 'Dheerasankarabharanam', 'Naganandini',
  'Yagapriya', 'Ragavardhini', 'Gangeyabhushani', 'Vagadheeswari', 'Shulini', 'Chalanata', 'Salagam', 'Jalarnavam',
  'Jhalavarali', 'Navaneetam', 'Pavani', 'Raghupriya', 'Gavambhodi', 'Bhavapriya', 'Shubhapantuvarali',
  'Shadvidamargini', 'Suvarnangi', 'Divyamani', 'Dhavalambari', 'Namanarayani', 'Kamavardhini', 'Ramapriya',
  'Gamanashrama', 'Vishwambari', 'Shyamalangi', 'Shanmukhapriya', 'Simhendramadhyamam', 'Hemavati', 'Dharmavati',
  'Neetimati', 'Kantamani', 'Rishabhapriya', 'Latangi', 'Vachaspati', 'Mechakalyani', 'Chitrambari', 'Sucharitra',
  'Jyotiswarupini', 'Dhatuvardhani', 'Nasikabhushani', 'Kosalam', 'Rasikapriya',
];

/** The scale of melakarta n (1–72), from the standard chakra scheme. */
export function melaScale(n: number): Scale {
  const i = n - 1;
  const rg = [[1, 1], [1, 2], [1, 3], [2, 2], [2, 3], [3, 3]][Math.floor((i % 36) / 6)];
  const dn = [[1, 1], [1, 2], [1, 3], [2, 2], [2, 3], [3, 3]][i % 6];
  return { r: rg[0], g: rg[1], m: i < 36 ? 1 : 2, d: dn[0], n: dn[1] };
}

const S = (r: number, g: number, m: number, d: number, n: number): Scale => ({ r, g, m, d, n });

// Common janya ragas. Swaras a raga skips get its parent's pitch (harmless,
// since the notation won't use them). "down" where descent differs.
const JANYA: Raga[] = [
  { name: 'Mohanam', up: S(2, 3, 1, 2, 3) },
  { name: 'Hamsadhwani', up: S(2, 3, 1, 2, 3) },
  { name: 'Hindolam', up: S(2, 2, 1, 1, 2) },
  { name: 'Abhogi', up: S(2, 2, 1, 2, 2) },
  { name: 'Madhyamavati', up: S(2, 2, 1, 2, 2) },
  { name: 'Shuddha Saveri', up: S(2, 3, 1, 2, 3) },
  { name: 'Shuddha Dhanyasi', up: S(2, 2, 1, 2, 2) },
  { name: 'Bilahari', up: S(2, 3, 1, 2, 3) },
  { name: 'Kalyani', up: S(2, 3, 2, 2, 3) },
  { name: 'Shankarabharanam', up: S(2, 3, 1, 2, 3) },
  { name: 'Todi', up: S(1, 2, 1, 1, 2) },
  { name: 'Bhairavi', up: S(2, 2, 1, 2, 2), down: S(2, 2, 1, 1, 2) },
  { name: 'Kambhoji', up: S(2, 3, 1, 2, 2) },
  { name: 'Sri', up: S(2, 2, 1, 2, 2) },
  { name: 'Begada', up: S(2, 3, 1, 2, 3), down: S(2, 3, 1, 2, 2) },
  { name: 'Arabhi', up: S(2, 3, 1, 2, 3) },
  { name: 'Nata', up: S(3, 3, 1, 3, 3) },
  { name: 'Gowla', up: S(1, 3, 1, 1, 3) },
  { name: 'Saveri', up: S(1, 3, 1, 1, 3) },
  { name: 'Malahari', up: S(1, 3, 1, 1, 3) },
  { name: 'Revati', up: S(1, 3, 1, 1, 2) },
  { name: 'Bahudari', up: S(2, 3, 1, 2, 2) },
  { name: 'Kapi', up: S(2, 2, 1, 2, 2) },
  { name: 'Anandabhairavi', up: S(2, 2, 1, 2, 2) },
  { name: 'Kedaragowla', up: S(2, 3, 1, 2, 2) },
  { name: 'Darbar', up: S(2, 2, 1, 2, 2) },
  { name: 'Kanada', up: S(2, 2, 1, 2, 2) },
  { name: 'Atana', up: S(2, 3, 1, 2, 3) },
  { name: 'Hamsanandi', up: S(1, 3, 2, 2, 3) },
  { name: 'Amritavarshini', up: S(2, 3, 2, 2, 3) },
  { name: 'Nalinakanti', up: S(2, 3, 1, 2, 3) },
  { name: 'Sindhubhairavi', up: S(1, 2, 1, 1, 2) },
  { name: 'Brindavana Saranga', up: S(2, 2, 1, 2, 3), down: S(2, 2, 1, 2, 2) },
  { name: 'Valaji', up: S(2, 3, 1, 2, 2) },
  { name: 'Shree Ranjani', up: S(2, 2, 1, 2, 2) },
  { name: 'Hamir Kalyani', up: S(2, 3, 2, 2, 3) },
  { name: 'Yamuna Kalyani', up: S(2, 3, 2, 2, 3) },
  { name: 'Pantuvarali', up: S(1, 3, 2, 1, 3) },
  { name: 'Vasanta', up: S(1, 3, 1, 2, 3) },
  { name: 'Saranga', up: S(2, 3, 2, 2, 3) },
  { name: 'Mukhari', up: S(2, 2, 1, 2, 2), down: S(2, 2, 1, 1, 2) },
  { name: 'Huseni', up: S(2, 2, 1, 2, 2) },
  { name: 'Dhanyasi', up: S(1, 2, 1, 1, 2) },
  { name: 'Ritigowla', up: S(2, 2, 1, 2, 2) },
  { name: 'Purvikalyani', up: S(1, 3, 2, 2, 3) },
  { name: 'Lalitha', up: S(1, 3, 1, 1, 3) },
  { name: 'Natakurinji', up: S(2, 3, 1, 2, 2) },
  { name: 'Suruti', up: S(2, 3, 1, 2, 2) },
  { name: 'Yadukula Kambhoji', up: S(2, 3, 1, 2, 2) },
  { name: 'Khamas', up: S(2, 3, 1, 2, 2) },
  { name: 'Desh', up: S(2, 3, 1, 2, 3), down: S(2, 3, 1, 2, 2) },
];

export const RAGAS: Raga[] = [
  ...MELA_NAMES.map((name, i) => ({ name, mela: i + 1, up: melaScale(i + 1) })),
  ...JANYA,
].sort((a, b) => a.name.localeCompare(b.name));

export const DEFAULT_RAGA = 'Shankarabharanam';

/** Spelling-insensitive key: bahudAri, Bahudari, bahudhari -> the same. */
export function ragaKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[āa]a/g, 'a')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z]/g, '')
    .replace(/ee/g, 'i')
    .replace(/oo/g, 'u')
    .replace(/o[wu]/g, 'au') // gowla, goula -> gaula
    .replace(/w/g, 'v')
    .replace(/(th|dh|bh|gh|kh|ph|ch|jh|sh)/g, (m) => m[0])
    .replace(/([a-z])\1+/g, '$1')
    .replace(/(am|m)$/, '')
    .replace(/[aeiou]$/, '');
}

const ALIASES: Record<string, string> = {
  dhirasankarabharanam: 'Shankarabharanam',
  sankarabharanam: 'Shankarabharanam',
  mechakalyani: 'Kalyani',
  hanumatodi: 'Todi',
  todi: 'Todi',
  kamavardhini: 'Pantuvarali',
  sriranjani: 'Shree Ranjani',
  sri: 'Sri',
  sree: 'Sri',
  shri: 'Sri',
  nata: 'Nata',
  nat: 'Nata',
};

export function findRaga(name: string): Raga | null {
  const k = ragaKey(name);
  if (!k) return null;
  const alias = Object.entries(ALIASES).find(([a]) => ragaKey(a) === k)?.[1];
  const target = alias ? ragaKey(alias) : k;
  return RAGAS.find((r) => ragaKey(r.name) === target) || null;
}

export interface ScaleChoice {
  raga: Raga | null;
  /** swara variants written in Arohana/Avarohana lines */
  fromLines: Partial<Scale> | null;
  /** where the choice came from, for the player's label */
  source: 'arohana' | 'raga-line' | 'heading' | 'default';
  name: string;
}

/** Work out a song's scale from its text (Arohana lines, Raga line, heading). */
export function scaleFromText(text: string, headingRaga: string): ScaleChoice {
  const lines = (text.match(/^\s*(Arohana|Arohanam|Avarohana|Avarohanam)\s*:(.*)$/gim) || []).join(' ');
  const written: Partial<Scale> = {};
  for (const m of lines.matchAll(/\b([rgmdn])([1-3])\b/gi)) {
    const k = m[1].toLowerCase() as keyof Scale;
    if (!(k in written)) written[k] = Number(m[2]);
  }
  const ragaLine = text.match(/^\s*Ragam?\s*:\s*"?([^"\n,]+)/im)?.[1].trim() || '';
  const byLine = ragaLine ? findRaga(ragaLine) : null;
  const byHeading = !byLine && headingRaga ? findRaga(headingRaga) : null;
  const raga = byLine || byHeading;
  const hasWritten = Object.keys(written).length > 0;
  return {
    raga,
    fromLines: hasWritten ? written : null,
    source: hasWritten ? 'arohana' : byLine ? 'raga-line' : byHeading ? 'heading' : 'default',
    name: raga ? raga.name : ragaLine || headingRaga || DEFAULT_RAGA,
  };
}

/** Semitones above Sa for a swara, given the scale and direction. */
export function swaraSemitones(note: string, variant: string | null | undefined, scale: Scale, down?: Scale): number {
  if (note === 's') return 0;
  if (note === 'p') return 7;
  const k = note as keyof Scale;
  const v = variant ? Number(variant) : (down ?? scale)[k];
  return SEMITONES[k + Math.min(Math.max(k === 'm' ? Math.min(v, 2) : v, 1), 3)] ?? 0;
}
