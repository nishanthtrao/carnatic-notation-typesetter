/*
 * Carnatic Music Notation Typesetter — row layout
 * SPDX-License-Identifier: GPL-2.0-or-later
 *
 * Splits the event stream of a staff segment into rows (one avartanam per
 * row in the automatic layouts, LineBreak/soft-wrap in manual modes), places
 * tala markers and gaps, works out speed lines and the alignment intervals
 * that render.ts lines up across rows.
 */
import type { Gap, InlineMark, Interval, Marker, NoteEvent, Row, SpeedGroup, StaffBlock } from './types';

export const EPS = 1e-6;

/** A staff while it is being built by the parser. */
export interface Segment extends StaffBlock {
  events: NoteEvent[];
  markers: Marker[];
  lineBreaks: number[];
  labels: { t: number; text: string }[];
  time: number;
  groupCounter: number;
}

const uniqSorted = (xs: number[]) => Array.from(new Set(xs.map((b) => +b.toFixed(6)))).sort((a, b) => a - b);

function rowBounds(seg: Segment): number[] {
  const tala = seg.tala && seg.tala.segments ? seg.tala : null;
  const manual = seg.tala ? seg.tala.manual : 0;
  const total = seg.time;
  let bounds = [0];
  if (tala && tala.segments && !manual) {
    const A = tala.beats;
    const perRow = seg.perRow || tala.perRow;
    if (tala.rowsPerAvarta === 2) {
      // split the avartanam at the anga boundary nearest its middle
      let acc = 0;
      let split = A / 2;
      let best = Infinity;
      for (const sgm of tala.segments) {
        acc += sgm;
        if (acc < A && Math.abs(acc - A / 2) < best) {
          best = Math.abs(acc - A / 2);
          split = acc;
        }
      }
      for (let a = 0; a * A < total - EPS; a++) bounds.push(a * A + split, (a + 1) * A);
    } else {
      for (let t = A * perRow; t < total - EPS; t += A * perRow) bounds.push(t);
      bounds.push(Math.max(A * perRow, Math.ceil((total - EPS) / (A * perRow)) * A * perRow));
    }
    bounds = uniqSorted(bounds);
    if (bounds.length < 2) bounds.push(A * perRow);
    return bounds;
  }
  // manual modes: explicit LineBreaks, plus soft wrapping of long lines
  const breaks = seg.lineBreaks.filter((t) => t > EPS && t < total - EPS);
  const maxLen = tala ? Math.max(tala.beats * 1.75, 6) : 16;
  let start = 0;
  for (const end of breaks.concat([total])) {
    while (end - start > maxLen + EPS) {
      // prefer to wrap after a phrase end, pause or marker
      let cut: number | null = null;
      for (const ev of seg.events) {
        const e = ev.t + ev.dur;
        if (e > start + EPS && e <= start + maxLen + EPS && (ev.phraseEnd || ev.kind !== 'swara')) cut = e;
      }
      if (!cut || cut - start < maxLen * 0.4) {
        cut = start + maxLen;
        for (const ev of seg.events) if (ev.t > start + EPS && ev.t <= start + maxLen + EPS) cut = ev.t;
      }
      bounds.push(cut);
      start = cut;
    }
    if (end < total - EPS) bounds.push(end);
    start = end;
  }
  bounds.push(total);
  bounds = uniqSorted(bounds);
  if (bounds.length < 2) bounds.push(bounds[0]);
  return bounds;
}

export function layoutSegment(seg: Segment): void {
  const tala = seg.tala && seg.tala.segments ? seg.tala : null;
  const manual = seg.tala ? seg.tala.manual : 0;
  const A = tala ? tala.beats : 0;
  const total = seg.time;
  seg.rows = [];
  if (!seg.events.length && !seg.labels.length) return;

  const bounds = rowBounds(seg);
  const showPhrase = seg.phraseEnds.style !== 'hide' || seg.phraseEnds.space > 0;
  const gapLayout = seg.layout === 'gitam' || seg.layout === 'varnam';

  for (let r = 0; r < bounds.length - 1; r++) {
    const r0 = bounds[r];
    const r1 = bounds[r + 1];
    const events = seg.events.filter((ev) => ev.t >= r0 - EPS && ev.t < r1 - EPS);
    if (!events.length && r > 0) continue;
    const markers: Marker[] = [];
    const gaps: Gap[] = [];
    let inline: InlineMark[] = [];
    const rowEvents = events.map((ev) => ({ ...ev, t: ev.t - r0 }));
    const contentEnd = Math.min(r1, total) - r0;
    const width = r1 - r0;

    const lab = seg.labels.find((l) => l.t >= r0 - EPS && l.t < r1 - EPS) || (r === 0 ? seg.labels[0] : undefined);

    // tala markers
    if (tala && tala.segments) {
      const marks: { t: number; kind: 'avarta' | 'anga' | 'akshara' | 'end' | 'angaEnd' }[] = [];
      const firstAvarta = Math.floor((r0 + EPS) / A);
      for (let a = firstAvarta; a * A < r1 + EPS; a++) {
        let acc = 0;
        tala.segments.forEach((sgm, i) => {
          const abs = a * A + acc;
          for (let k = 0; k < sgm - EPS; k++) {
            const t = abs + k;
            if (t >= r0 - EPS && t < r1 - EPS) marks.push({ t: t - r0, kind: i === 0 && k === 0 ? 'avarta' : k === 0 ? 'anga' : 'akshara' });
          }
          acc += sgm;
          const end = a * A + acc;
          if (end > r0 + EPS && end <= r1 + EPS && end - r0 <= contentEnd + EPS) {
            marks.push({ t: end - r0, kind: i === tala.segments!.length - 1 ? 'end' : 'angaEnd' });
          }
        });
      }
      if (manual === 1 && tala.inlineMarkers) {
        for (const mk of marks) {
          if (mk.kind === 'avarta') inline.push({ t: mk.t, kind: '||' });
          else if (mk.kind === 'anga') inline.push({ t: mk.t, kind: tala.innerBars ? '|' : '*' });
          else if (mk.kind === 'akshara') inline.push({ t: mk.t, kind: '*' });
        }
        inline = inline.filter((mk) => mk.t <= contentEnd + EPS);
      } else {
        for (const mk of marks) {
          if (mk.kind === 'end') markers.push({ t: mk.t, kind: '||' });
          else if (mk.kind === 'angaEnd') {
            if (tala.innerBars) markers.push({ t: mk.t, kind: '|' });
            else gaps.push({ t: mk.t, size: 'anga' });
          } else if (mk.kind === 'akshara' && gapLayout && mk.t > EPS) gaps.push({ t: mk.t, size: 'akshara' });
        }
      }
    } else {
      // manual mode 2: markers exactly where the user wrote them
      const explicit = seg.markers.filter((mk) => mk.t >= r0 - EPS && mk.t <= r1 + EPS && !(mk.t > r1 - EPS && r < bounds.length - 2));
      for (const mk of explicit) {
        if (seg.tala && seg.tala.inlineMarkers) inline.push({ t: mk.t - r0, kind: mk.kind });
        else markers.push({ t: mk.t - r0, kind: mk.kind });
      }
    }

    if (seg.phraseEnds.space > 0) {
      for (const ev of rowEvents) if (ev.phraseEnd) gaps.push({ t: ev.t + ev.dur, size: 'phrase' });
    }

    // speed lines: runs of events sharing the same ( ) group at each depth
    const groups: SpeedGroup[] = [];
    const maxDepth = rowEvents.reduce((d, ev) => Math.max(d, ev.path.length), 0);
    for (let k = 0; k < maxDepth; k++) {
      let run: { id: number; start: number; end: number } | null = null;
      const flush = () => {
        if (run) groups.push({ start: run.start, end: run.end, depth: k + 1 });
        run = null;
      };
      for (const ev of rowEvents) {
        const id = ev.path[k];
        if (id === undefined) {
          flush();
          continue;
        }
        if (run && (run as { id: number }).id === id) (run as { end: number }).end = ev.t + ev.dur;
        else {
          flush();
          run = { id, start: ev.t, end: ev.t + ev.dur };
        }
        if (ev.phraseEnd && showPhrase) flush();
      }
      flush();
    }

    // alignment intervals: the row is cut at every marker / gap; in the
    // automatic layouts intervals at the same place in the tala line up.
    const cuts = new Set<number>([0, +width.toFixed(6)]);
    for (const mk of markers) cuts.add(+mk.t.toFixed(6));
    for (const g of gaps) if (g.size !== 'phrase') cuts.add(+g.t.toFixed(6));
    const sorted = Array.from(cuts).filter((t) => t >= 0 && t <= width + EPS).sort((a, b) => a - b);
    const pattern = tala ? (tala.rowsPerAvarta === 2 ? A : A * (seg.perRow || tala.perRow)) : 0;
    const align = !!(tala && !manual && !seg.compact);
    const intervals: Interval[] = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      const t0 = sorted[i];
      const t1 = sorted[i + 1];
      const mk = markers.find((x) => Math.abs(x.t - t1) < EPS);
      const gp = gaps.find((x) => x.size !== 'phrase' && Math.abs(x.t - t1) < EPS);
      intervals.push({
        t0,
        t1,
        key: align ? Math.round(((((r0 + t0) % pattern) + pattern) % pattern) * 1e4) : null,
        sep: mk ? mk.kind : gp ? (gp.size as 'akshara' | 'anga') : null,
      });
    }

    const nLyr = rowEvents.reduce((n, ev) => Math.max(n, ev.lyrics.length), 0);
    const lyricLines = [];
    for (let li = 0; li < nLyr; li++) {
      lyricLines.push(
        rowEvents
          .filter((ev) => ev.lyrics[li] && ev.lyrics[li]!.text !== '')
          .map((ev) => ({ t: ev.t, text: ev.lyrics[li]!.text, lang: ev.lyrics[li]!.lang, missing: ev.lyrics[li]!.missing })),
      );
    }

    const row: Row = {
      width,
      events: rowEvents,
      groups,
      markers,
      gaps,
      inline,
      label: lab ? lab.text : null,
      align,
      intervals,
      leadMarker: markers.find((x) => x.t < EPS)?.kind ?? null,
      lyricLines,
    };
    seg.rows.push(row);
  }
}
