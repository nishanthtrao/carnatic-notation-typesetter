/*
 * Counts the matras in every tala cycle of a transcription, so a reading
 * that lost a dot, a long vowel or a speed line can be sent back to the
 * AI to look at again. The typesetter itself accepts such cycles (they can
 * be deliberate), so these are review hints, not errors.
 * SPDX-License-Identifier: GPL-2.0-only
 */
import { perAkshara, tokenizeSwaraLine, SWARA_RE, parseTala, isTalaError, type Tala } from '../engine';

const PAUSE: Record<string, number> = { ',': 1, ';': 2, _: 1, __: 2, '-': 1 };

/** Matras in one written token at the default speed (before ( ) halving). */
function tokenMatras(tok: string): number | null {
  const sm = tok.match(SWARA_RE);
  if (sm) return sm[1].length > 1 || /^[SRGMPDN]$/.test(sm[1]) ? 2 : 1;
  const pm = tok.match(/^(,|;|__|_|-)-*$/);
  if (pm) return PAUSE[pm[1]];
  if (/^=-*$/.test(tok)) return 1;
  return null;
}

const fmt = (n: number) => String(Math.round(n * 100) / 100);

export function checkCycles(notation: string): { line: number; message: string }[] {
  const out: { line: number; message: string }[] = [];
  let tala: Tala | null = null;
  let speed: number | null = null;
  notation.split('\n').forEach((raw, i) => {
    const no = i + 1;
    const m = raw.trim().match(/^([A-Za-z]+)\s*:\s*([\s\S]*)$/);
    if (!m) return;
    const name = m[1].toLowerCase();
    const value = m[2].trim();
    if (name === 'tala') {
      const t = parseTala(value);
      tala = isTalaError(t) || t.manual === 2 || !t.beats ? null : t;
      return;
    }
    if (name === 'defaultspeed') {
      const v = parseInt(value, 10);
      speed = [0, 1, 2].includes(v) ? v : null;
      return;
    }
    if (name !== 's' || !tala || speed === null) return;
    const t: Tala = tala;
    const need = t.beats * perAkshara(speed, t.gati);
    const { tokens } = tokenizeSwaraLine(value);
    if (!tokens.includes('||')) return;
    let depth = 0;
    let sum = 0;
    let cycle = 0;
    for (const tok of tokens) {
      if (typeof tok !== 'string') continue;
      if (tok === '(') depth++;
      else if (tok === ')') depth = Math.max(0, depth - 1);
      else if (tok === '|') continue;
      else if (tok === '||') {
        cycle++;
        if (Math.abs(sum - need) > 1e-6) {
          out.push({
            line: no,
            message: `cycle ${cycle} has ${fmt(sum)} matras; ${t.name} at DefaultSpeed ${speed} needs ${fmt(need)}`,
          });
        }
        sum = 0;
      } else {
        const n = tokenMatras(tok);
        if (n !== null) sum += n * Math.pow(0.5, depth);
      }
    }
  });
  return out;
}
