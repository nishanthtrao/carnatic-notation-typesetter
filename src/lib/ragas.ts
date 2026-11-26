/*
 * Finding a raga by name, however it is spelled: "shankarabharanam",
 * "sankarabharanam" and "Śaṅkarābharaṇam" all match, as do "thodi" and "todi".
 * A melakarta number finds that melakarta and its janya ragas.
 * SPDX-License-Identifier: GPL-2.0-only
 */
import { POPULAR, RAGAS, type RagaRow } from './ragaData';

export interface Raga {
  name: string;
  /** as typed in a Raga: line (transliteration scheme) */
  typed: string;
  aro: string;
  ava: string;
  mela: number;
  melakarta: boolean;
  hindustani: boolean;
}

const toRaga = (r: RagaRow): Raga => ({ name: r[0], typed: r[1], aro: r[2], ava: r[3], mela: r[4], melakarta: r[5] === 1, hindustani: r[5] === 2 });

/** A spelling-independent key: no accents, no aspirates, long vowels short, w = v, sh = s. */
export function ragaKey(s: string): string {
  let k = s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z]/g, '');
  for (const [a, b] of [['ee', 'i'], ['oo', 'u'], ['ow', 'au'], ['ou', 'au'], ['w', 'v'], ['sh', 's'], ['zh', 'l'], ['ksh', 'ks']] as const) k = k.split(a).join(b);
  k = k.replace(/([kgcjtdpb])h/g, '$1').replace(/y/g, '');
  return k.replace(/(.)\1+/g, '$1');
}

let all: (Raga & { key: string; words: string[] })[] | null = null;
const index = () =>
  (all ??= RAGAS.map((r) => {
    const raga = toRaga(r);
    return { ...raga, key: ragaKey(raga.name), words: raga.name.split(/\s+/).map(ragaKey) };
  }));

const popularRank = new Map(POPULAR.map((n, i) => [n, i]));

/** The melakarta's own name (first entry for its number). */
export function melaName(n: number): string {
  return index().find((r) => r.melakarta && r.mela === n)?.name ?? String(n);
}

/** Ragas matching what was typed, best first; the best-known ones when nothing is typed. */
export function findRagas(query: string, limit = 50): Raga[] {
  const q = query.trim();
  const list = index();
  if (!q) return POPULAR.map((n) => list.find((r) => r.name === n)).filter((r): r is NonNullable<typeof r> => !!r).slice(0, limit);
  if (/^\d{1,2}$/.test(q)) {
    const n = Number(q);
    return list.filter((r) => r.mela === n).sort((a, b) => Number(b.melakarta) - Number(a.melakarta) || a.name.localeCompare(b.name)).slice(0, limit);
  }
  const k = ragaKey(q);
  if (!k) return [];
  const scored: [number, (typeof list)[number]][] = [];
  for (const r of list) {
    const score = r.key.startsWith(k) ? 0 : r.words.some((w) => w.startsWith(k)) ? 1 : r.key.includes(k) ? 2 : -1;
    if (score >= 0) scored.push([score, r]);
  }
  const pop = (r: Raga) => popularRank.get(r.name) ?? (r.melakarta ? 500 : 1000);
  scored.sort((a, b) => a[0] - b[0] || pop(a[1]) - pop(b[1]) || a[1].name.length - b[1].name.length);
  // one entry per name: a melakarta also listed under another name is shown once
  const seen = new Set<string>();
  const out: Raga[] = [];
  for (const [, r] of scored) {
    if (seen.has(r.name)) continue;
    seen.add(r.name);
    out.push(r);
    if (out.length >= limit) break;
  }
  return out;
}

export const RAGA_COUNT = RAGAS.length;
