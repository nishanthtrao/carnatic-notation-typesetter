/*
 * Turn a parsed song into a timeline for playback: notes (with pitch and the
 * key of the drawn swara, for highlighting) and tala beats.
 * SPDX-License-Identifier: GPL-2.0-only
 */
import type { NoteEvent, NotationDoc, StaffBlock } from '../engine';
import { swaraSemitones, type Scale } from './ragas';

export interface TimedNote {
  /** start and length in aksharas from the beginning of the song */
  start: number;
  dur: number;
  /** semitones from middle Sa (octave included) */
  semis: number;
  /** gamaka symbol, e.g. "~" for a shake */
  gamaka: string | null;
  /** data-ev key of the drawn swara ("block.row.event") */
  key: string;
}

export interface Beat {
  at: number;
  /** 2 = start of the cycle (avartanam), 1 = start of an anga, 0 = other beats */
  accent: 0 | 1 | 2;
}

export interface Timeline {
  notes: TimedNote[];
  beats: Beat[];
  /** total length in aksharas */
  length: number;
  /** data-row keys with their start, to scroll the page along */
  rows: { key: string; start: number }[];
}

const SUSTAIN = new Set(['karvai', 'dash']);

/**
 * scale: pitches going up; down: pitches coming down (where the raga differs).
 * Direction is judged from the next swara.
 */
export function buildTimeline(doc: NotationDoc, scale: Scale, down?: Scale): Timeline {
  const notes: TimedNote[] = [];
  const beats: Beat[] = [];
  const rows: { key: string; start: number }[] = [];
  let offset = 0;
  let prevRowEvents: NoteEvent[] | null = null;

  doc.blocks.forEach((b, bi) => {
    if (b.type !== 'staff') return;
    const st = b as StaffBlock;
    st.rows.forEach((row, ri) => {
      rows.push({ key: bi + '.' + ri, start: offset });
      const rowLen = Math.max(row.width || 0, ...row.events.map((e) => e.t + e.dur), 0);
      // pitches of the swaras in this row (for "=": same as the line above)
      const swaraOf = (ev: NoteEvent, ei: number): NoteEvent | null =>
        ev.kind === 'swara' ? ev : ev.kind === 'same' && prevRowEvents?.[ei]?.kind === 'swara' ? prevRowEvents[ei] : null;
      const list = row.events;
      for (let ei = 0; ei < list.length; ei++) {
        const ev = list[ei];
        const sw = swaraOf(ev, ei);
        if (sw && sw.note) {
          // a swara sounds through the karvais (, ;) and dashes that follow it
          let dur = ev.dur;
          for (let j = ei + 1; j < list.length && SUSTAIN.has(list[j].kind); j++) dur += list[j].dur;
          // direction: compare with the next swara
          let next: NoteEvent | null = null;
          for (let j = ei + 1; j < list.length; j++) {
            const n = swaraOf(list[j], j);
            if (n) {
              next = n;
              break;
            }
          }
          const here = pitch(sw, scale);
          const goingDown = !!down && next !== null && pitch(next, scale) < here;
          const semis = goingDown ? pitch(sw, scale, down) : here;
          notes.push({ start: offset + ev.t, dur, semis, gamaka: sw.gamaka || null, key: bi + '.' + ri + '.' + ei });
        }
      }
      // tala beats: every akshara, accents at angas and at the start of the cycle
      const segs = st.tala?.segments;
      if (segs && segs.length) {
        const cycle = segs.reduce((a, c) => a + c, 0);
        const angaStarts = new Set<number>();
        let acc = 0;
        for (const s of segs) {
          angaStarts.add(acc);
          acc += s;
        }
        for (let a = 0; a < rowLen - 1e-6; a += 1) {
          const inCycle = ((a % cycle) + cycle) % cycle;
          beats.push({ at: offset + a, accent: inCycle === 0 ? 2 : angaStarts.has(inCycle) ? 1 : 0 });
        }
      }
      offset += rowLen;
      prevRowEvents = row.events;
    });
  });
  return { notes, beats, length: offset, rows };
}

function pitch(ev: NoteEvent, scale: Scale, down?: Scale): number {
  return swaraSemitones(ev.note!, ev.variant, scale, down) + 12 * (ev.octave || 0);
}

/** Middle-Sa frequencies people commonly sing at (kattai / shruti). */
export const SHRUTIS: { label: string; hz: number }[] = [
  ['C', 0], ['C♯', 1], ['D', 2], ['D♯', 3], ['E', 4], ['F', 5], ['F♯', 6], ['G', 7], ['G♯', 8], ['A', 9], ['A♯', 10], ['B', 11],
].map(([label, n]) => ({ label: label as string, hz: 261.6256 * Math.pow(2, (n as number) / 12) }));
