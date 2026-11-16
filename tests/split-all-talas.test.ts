/*
 * Splitting swaras and pauses across bars, checked against every tala the app
 * knows, every default speed, the gatis, nested speeds, labels and lyrics,
 * with random notation (a fixed seed, so a failure can be reproduced).
 */
import { test, expect } from 'vitest';
import { parse } from '../src/engine/parser';
import { listTalas } from '../src/engine/talas';
import type { NoteEvent, StaffBlock } from '../src/engine/types';

const EPS = 1e-6;

/** Small seeded random number generator (mulberry32). */
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SHORT = ['s', 'r', 'g', 'm', 'p', 'd', 'n', 'r2', "s'", 'p`', 'g~', 'm-', 'd^'];
const LONG = ['sa', 'ri', 'ga', 'ma', 'pa', 'da', 'ni', 'ri2', "sa'", 'pa`', 'ga~', 'ma-', 'S', 'N'];
const PAUSE = [',', ';', '_', '__', ';-', ',-'];

/** A random S: line of about n tokens (with brackets for faster speeds) and its token count. */
function swaraLine(rand: () => number, n: number): { line: string; tokens: number; swaras: number } {
  const out: string[] = [];
  let depth = 0;
  let tokens = 0;
  let swaras = 0;
  for (let i = 0; i < n; i++) {
    const x = rand();
    if (x < 0.06 && depth < 2) {
      out.push('(');
      depth++;
      continue;
    }
    if (x < 0.1 && depth > 0) {
      out.push(')');
      depth--;
      continue;
    }
    const pick = (a: string[]) => a[Math.floor(rand() * a.length)];
    const y = rand();
    out.push(y < 0.45 ? pick(SHORT) : y < 0.8 ? pick(LONG) : pick(PAUSE));
    tokens++;
    if (y < 0.8) swaras++;
  }
  while (depth-- > 0) out.push(')');
  return { line: out.join(' '), tokens, swaras };
}

/** Where the tala draws bars, as splitAcrossBars sees them. */
function bars(staff: StaffBlock, total: number): number[] {
  const t = staff.tala;
  if (!t || !t.segments || t.manual === 2) return [];
  const out: number[] = [];
  for (let a = 0; a * t.beats < total - EPS; a++) {
    let acc = 0;
    for (const s of t.segments) {
      acc += s;
      if (acc < t.beats - EPS && !t.innerBars) continue;
      out.push(a * t.beats + acc);
    }
  }
  return out;
}

const TALAS = listTalas().map((t) => t.spec);
const CASES: string[] = [];
for (const tala of TALAS) {
  CASES.push(tala);
  if (!/manual/i.test(tala)) CASES.push(tala + ',Manual', tala + ',Manual,InlineTalaMarkers');
}

test('every tala: nothing runs across a bar, time and lyrics are kept', () => {
  const rand = rng(20261116);
  let checked = 0;
  let splits = 0;
  for (const tala of CASES) {
    for (const speed of [0, 1, 2]) {
      for (const gati of [null, 'tisra', 'khanda', 'misra']) {
        for (const smart of [false, true]) {
          const layout = ['krithi', 'varnam', 'gitam', 'krithi,Compact', 'varnam,FullWidth'][Math.floor(rand() * 5)];
          const lines: string[] = [`Layout: ${layout}`, `Tala: ${tala}`, `DefaultSpeed: ${speed}`];
          if (rand() < 0.3) lines.push(`AvartanamsPerLine: ${1 + Math.floor(rand() * 4)}`);
          if (gati) lines.push(`Gati: ${gati}`);
          if (smart) lines.push('SmartLyricMode');
          let swaraCount = 0;
          const expectLyrics: string[] = [];
          for (let k = 0; k < 3; k++) {
            const { line, tokens, swaras } = swaraLine(rand, 6 + Math.floor(rand() * 20));
            swaraCount += swaras;
            // sometimes change the gati or the speed between lines
            if (k > 0 && rand() < 0.3) lines.push(rand() < 0.5 ? `Gati: ${['tisra', 'catusra', 'khanda'][Math.floor(rand() * 3)]}` : `DefaultSpeed: ${Math.floor(rand() * 3)}`);
            lines.push(`S: ${k === 0 ? '"1." ' : ''}${line}`);
            // a syllable for each swara (SmartLyricMode) or each swara and pause
            const n = smart ? swaras : tokens;
            const syl = Array.from({ length: n }, (_, i) => `x${k}${i}`);
            expectLyrics.push(...syl);
            lines.push(`L: ${syl.join(' ')}`);
          }
          const src = lines.join('\n');
          const doc = parse(src);
          const staffs = doc.blocks.filter((b) => b.type === 'staff') as StaffBlock[];
          expect(staffs.length, src).toBe(1);
          const st = staffs[0];
          const ctx = `\n--- ${tala}, ${layout}, speed ${speed}, gati ${gati}, smart ${smart}\n${src}`;
          // the rows follow one another, so each starts where the ones before it end
          const evs: NoteEvent[] = [];
          let start = 0;
          for (const row of st.rows) {
            for (const ev of row.events) evs.push({ ...ev, t: ev.t + start });
            start += row.width;
          }

          // 1. the events still fill the time with no gaps or overlaps
          let t = 0;
          for (const ev of evs) {
            expect(Math.abs(ev.t - t) < EPS, 'gap or overlap at ' + ev.t + ctx).toBe(true);
            expect(ev.dur > EPS, 'empty event' + ctx).toBe(true);
            t += ev.dur;
          }
          const total = t;

          // 2. nothing that can be split runs across a bar
          const b = bars(st, total);
          for (const ev of evs) {
            if (ev.kind !== 'swara' && ev.kind !== 'karvai' && ev.kind !== 'empty') continue;
            const crossing = b.find((x) => x > ev.t + EPS && x < ev.t + ev.dur - EPS);
            expect(crossing, `${ev.display || ev.text} at ${ev.t} runs across the bar at ${crossing}` + ctx).toBeUndefined();
          }

          // 3. no swara is lost or added: splitting adds only karvais and empties
          expect(evs.filter((e) => e.kind === 'swara').length, 'swaras' + ctx).toBe(swaraCount);
          // count the splits: the same notation with no tala is never split
          const plain = parse(src.replace(/^Tala: .*$/m, 'Tala: Manual')).blocks.find((x) => x.type === 'staff') as StaffBlock;
          splits += evs.length - plain.rows.reduce((n, r) => n + r.events.length, 0);

          // a short swara reads as one (s, not sa), and pauses are only , ; _ __
          for (const ev of evs) {
            if (ev.kind === 'swara' && !ev.long) expect(ev.display, 'short swara shown long' + ctx).toBe(ev.note);
            if (ev.kind === 'karvai') expect([',', ';']).toContain(ev.text);
            if (ev.kind === 'empty') expect(['_', '__']).toContain(ev.text);
          }

          // 4. every syllable is still there, once, in order, and never on a karvai added by a split
          const got = evs.flatMap((e) => (e.lyrics[0] ? [e.lyrics[0].text] : []));
          expect(got, 'lyrics' + ctx).toEqual(expectLyrics);

          // 5. in the automatic layouts, no event spills past the end of its row
          if (st.tala?.segments && !st.tala.manual) {
            for (const row of st.rows) {
              for (const ev of row.events) expect(ev.t + ev.dur <= row.width + EPS, 'spills past row' + ctx).toBe(true);
            }
          }
          checked++;
        }
      }
    }
  }
  expect(checked).toBeGreaterThan(500);
  expect(splits).toBeGreaterThan(200); // the random notation crosses plenty of bars
  console.log(`checked ${checked} songs, ${splits} notes split across bars`);
});
