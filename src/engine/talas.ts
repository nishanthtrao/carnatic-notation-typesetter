/*
 * Carnatic Music Notation Typesetter — tala definitions
 * SPDX-License-Identifier: GPL-2.0-only
 *
 * Part of an unofficial rebuild of the Carnatic Music Notation Typesetter
 * created by Arun K (sourceforge.net/projects/cmnt, GPLv2). See NOTICE.md.
 *
 * Tala names follow the v1.5 manual: Adi, Tisra_Adi, Adi2Kalai,
 * Rupaka/Roopaka, RupakaCapu, KhandaCapu, KhandaCapu2, MisraCapu, Dhruva2 and
 * <Jati>_<Tala> for all 35 suladi talas, optionally followed by ",Manual" and
 * ",InlineTalaMarkers". "Manual" alone means no tala tracking (mode #2).
 * Angas: I = laghu (length = jati), O = drutam (2), U = anudrutam (1).
 */
import type { JatiName, Tala, TalaError } from './types';

export const JATIS: Record<JatiName, number> = { tisra: 3, catusra: 4, khanda: 5, misra: 7, sankirna: 9 };
export const GATIS = JATIS;

const JATI_ALIASES: Record<JatiName, string[]> = {
  tisra: ['tisra', 'thisra', 'tishra', 'trisra', 'tisram'],
  catusra: ['catusra', 'chatusra', 'chaturasra', 'catursra', 'chathusra', 'chatushra', 'catusram', 'caturasra', 'chatusram'],
  khanda: ['khanda', 'kanda', 'khandam'],
  misra: ['misra', 'mishra', 'misram'],
  sankirna: ['sankirna', 'sankeerna', 'sankirnam', 'sankeernam', 'samkirna'],
};

type SuladiKey = 'dhruva' | 'matya' | 'rupaka' | 'jhampa' | 'triputa' | 'ata' | 'eka';
export const SULADI: Record<SuladiKey, { angas: string; jati: JatiName; name: string }> = {
  dhruva: { angas: 'IOII', jati: 'catusra', name: 'Dhruva' },
  matya: { angas: 'IOI', jati: 'catusra', name: 'Matya' },
  rupaka: { angas: 'OI', jati: 'catusra', name: 'Rupaka' },
  jhampa: { angas: 'IUO', jati: 'misra', name: 'Jhampa' },
  triputa: { angas: 'IOO', jati: 'tisra', name: 'Triputa' },
  ata: { angas: 'IIOO', jati: 'khanda', name: 'Ata' },
  eka: { angas: 'I', jati: 'catusra', name: 'Eka' },
};
const SULADI_ALIASES: Record<SuladiKey, string[]> = {
  dhruva: ['dhruva', 'dhruvam', 'druva'],
  matya: ['matya', 'matyam', 'mathya', 'mattya', 'madhya'],
  rupaka: ['rupaka', 'rupakam', 'roopaka', 'roopakam'],
  jhampa: ['jhampa', 'jampa', 'jhampai'],
  triputa: ['triputa', 'thriputa', 'triputai', 'triputam'],
  ata: ['ata', 'atta', 'attam', 'adda', 'atam'],
  eka: ['eka', 'ekam'],
};

interface Special {
  name: string;
  segments: number[];
  gati?: JatiName;
  innerBars?: boolean;
  perRow?: number;
  rowsPerAvarta?: number;
}

// Capu talas count in half-aksharas, have no inner | markers and pack several
// avartanams per row, as in the original typesetter.
const SPECIAL: Record<string, Special> = {
  adi: { name: 'Adi', segments: [4, 2, 2] },
  tisraadi: { name: 'Adi (Tisra Gati)', segments: [4, 2, 2], gati: 'tisra' },
  adi2kalai: { name: 'Adi (2 Kalai)', segments: [8, 4, 4] },
  rupakacapu: { name: 'Rupaka Capu', segments: [1, 1, 1], innerBars: false, perRow: 2 },
  khandacapu: { name: 'Khanda Capu', segments: [1, 1.5], innerBars: false, perRow: 4 },
  khandacapu2: { name: 'Khanda Capu', segments: [1, 1.5], innerBars: false, perRow: 2 },
  misracapu: { name: 'Misra Capu', segments: [1.5, 1, 1], innerBars: false, perRow: 2 },
  sankirnacapu: { name: 'Sankirna Capu', segments: [2, 2.5], innerBars: false, perRow: 2 },
  dhruva2: { name: 'Dhruva', segments: [4, 2, 4, 4], rowsPerAvarta: 2 },
};
const SPECIAL_ALIASES: Record<string, string[]> = {
  adi: ['adi', 'aadi', 'adhi'],
  tisraadi: ['tisraadi', 'tisragatiadi', 'thisraadi'],
  adi2kalai: ['adi2kalai', 'adi2kalaai', 'adidvikalai'],
  rupakacapu: ['rupakacapu', 'roopakacapu', 'rupakachapu', 'roopakachapu', 'rupakacaapu'],
  khandacapu: ['khandacapu', 'khandachapu', 'kandachapu', 'khandacaapu'],
  khandacapu2: ['khandacapu2', 'khandachapu2'],
  misracapu: ['misracapu', 'misrachapu', 'mishrachapu', 'misracaapu', 'capu', 'chapu'],
  sankirnacapu: ['sankirnacapu', 'sankirnachapu', 'sankeernachapu'],
  dhruva2: ['dhruva2', 'catusradhruva2'],
};

function lookup<K extends string>(aliases: Record<K, string[]>): Record<string, K> {
  const map: Record<string, K> = {};
  for (const key of Object.keys(aliases) as K[]) for (const a of aliases[key]) map[a] = key;
  return map;
}
const jatiLookup = lookup(JATI_ALIASES);
const suladiLookup = lookup(SULADI_ALIASES);
const specialLookup = lookup(SPECIAL_ALIASES);

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** Fold diacritics and case: "rUpakacApu" -> "rupakacapu" */
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

type Draft = Partial<Tala> & { name: string; segments: number[] | null };

function finish(t: Draft): Tala {
  return {
    name: t.name,
    segments: t.segments,
    beats: t.segments ? t.segments.reduce((a, b) => a + b, 0) : 0,
    gati: t.gati ?? null,
    innerBars: t.innerBars ?? true,
    perRow: t.perRow || 1,
    rowsPerAvarta: t.rowsPerAvarta || 1,
    manual: t.manual ?? 0,
    inlineMarkers: !!t.inlineMarkers,
    jati: t.jati,
  };
}

export function isTalaError(t: Tala | TalaError): t is TalaError {
  return 'error' in t;
}

/** Parse a Tala directive value. */
export function parseTala(spec: string): Tala | TalaError {
  const raw = String(spec || '').trim();
  if (!raw) return { error: 'Empty tala' };
  const parts = raw.split(',').map((p) => p.trim()).filter(Boolean);
  const opts = parts.slice(1).map((o) => fold(o).replace(/\s+/g, ''));
  const inlineMarkers = opts.includes('inlinetalamarkers') || opts.includes('inline');
  const wantsManual = opts.includes('manual');
  const main = parts[0];

  if (/^manual$/i.test(main)) return finish({ name: 'Manual', segments: null, manual: 2, inlineMarkers });

  // Custom tala: "4+2+2" (an extension; not in v1.5)
  const custom = main.match(/^(?:custom\s*)?((?:\d+(?:\.\d+)?\s*\+\s*)*\d+(?:\.\d+)?)$/i);
  let t: Draft;
  if (custom) {
    const segments = custom[1].split('+').map(parseFloat).filter((n) => n > 0);
    t = { name: segments.join('+'), segments };
  } else {
    const words = fold(main)
      .replace(/[()]/g, ' ')
      .split(/[\s_-]+/)
      .filter((w) => w && !['jati', 'jaati', 'jathi', 'tala', 'talam', 'thalam', 'gati', 'nadai'].includes(w));
    const joined = words.join('');
    if (specialLookup[joined]) {
      const sp = SPECIAL[specialLookup[joined]];
      t = { ...sp, segments: sp.segments.slice() };
    } else {
      let jati: JatiName | null = null;
      let suladi: SuladiKey | null = null;
      for (const w of words) {
        if (jatiLookup[w]) jati = jatiLookup[w];
        else if (suladiLookup[w]) suladi = suladiLookup[w];
        else if (/^(dhruva|druva)2$/.test(w)) return parseTala('Dhruva2' + (parts.length > 1 ? ',' + parts.slice(1).join(',') : ''));
        else return { error: 'Unknown tala "' + raw + '"' };
      }
      if (!suladi) {
        if (jati === 'tisra' && words.includes('adi')) return parseTala('Tisra_Adi');
        return { error: 'Unknown tala "' + raw + '"' };
      }
      const def = SULADI[suladi];
      const used = jati || def.jati;
      const count = JATIS[used];
      const segments = def.angas.split('').map((a) => (a === 'I' ? count : a === 'O' ? 2 : 1));
      t = { name: (jati ? cap(used) + ' Jati ' : '') + def.name, segments, jati: used };
    }
  }
  t.manual = wantsManual ? 1 : 0;
  t.inlineMarkers = inlineMarkers;
  return finish(t);
}

export interface TalaChoice {
  spec: string;
  label: string;
}

/** Every named tala, for the Assist panel and TAB completion. */
export function listTalas(): TalaChoice[] {
  const out: TalaChoice[] = [
    ['Adi', 'Adi (8)'],
    ['Tisra_Adi', 'Adi, tisra gati'],
    ['Adi2Kalai', 'Adi 2-kalai'],
    ['Rupaka', 'Rupaka (6)'],
    ['RupakaCapu', 'Rupaka capu'],
    ['MisraCapu', 'Misra capu'],
    ['KhandaCapu', 'Khanda capu'],
    ['KhandaCapu2', 'Khanda capu (2 per row)'],
    ['Dhruva2', 'Dhruva over 2 rows'],
  ].map(([spec, label]) => ({ spec, label }));
  for (const s of Object.keys(SULADI) as SuladiKey[]) {
    for (const j of Object.keys(JATIS) as JatiName[]) {
      const spec = cap(j) + '_' + SULADI[s].name;
      const t = parseTala(spec) as Tala;
      out.push({ spec, label: t.name + ' (' + t.beats + ')' });
    }
  }
  out.push({ spec: 'Adi,Manual', label: 'Adi, manual line breaks' });
  out.push({ spec: 'Manual', label: 'Manual (no tala; use | and ||)' });
  return out;
}

/** Normalise a gati name. */
export function parseGati(v: string): JatiName | null {
  const w = fold(String(v || '').trim()).replace(/[\s_]+/g, '');
  return jatiLookup[w] || null;
}
