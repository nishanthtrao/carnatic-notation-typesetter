/*
 * Page size and margins: the same numbers drive the printed page (@page) and
 * the page drawn on screen, so the preview shows the margin it will print with.
 * SPDX-License-Identifier: GPL-2.0-only
 */
import type { NotationDoc } from './types';

export const DEFAULT_MARGIN = '12mm';

/** Page sizes in millimetres, portrait (width, height). */
const SIZES: Record<string, [number, number]> = {
  A3: [297, 420], A4: [210, 297], A5: [148, 210], letter: [215.9, 279.4], legal: [215.9, 355.6],
};
const MM: Record<string, number> = { mm: 1, cm: 10, in: 25.4 };

/**
 * Reads a margin such as "15mm", "1.5 cm", "0.5in", ".75in" or 1" into a CSS
 * length and millimetres; null when it isn't one.
 */
export function parseMargin(text: string): { css: string; mm: number } | null {
  const m = text.trim().match(/^(\d+(?:\.\d+)?|\.\d+)\s*(mm|cm|in|inch|inches|")$/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  const unit = m[2].toLowerCase().startsWith('in') || m[2] === '"' ? 'in' : m[2].toLowerCase();
  return { css: n + unit, mm: n * MM[unit] };
}

export type Side = 'left' | 'top' | 'right' | 'bottom';
/** The four page margins as CSS lengths. */
export type Margins = Record<Side, string>;
/** Positional margins after the orientation come in this order. */
export const SIDE_ORDER: Side[] = ['left', 'top', 'right', 'bottom'];
const MAX_MM = 60;

/**
 * Reads the margins written after the orientation: "Orientation: Portrait, left,
 * top, right, bottom". The right margin is the left one unless given, and the
 * bottom the top one; a single value is every side (the original form,
 * "Orientation: Landscape,0.5in"). A part may also name its side ("Top 20mm").
 */
export function parseMargins(parts: string[]): { margins: Margins } | { error: string } {
  const got: Partial<Margins> = {};
  let pos = 0;
  for (const raw of parts.map((p) => p.trim()).filter(Boolean)) {
    const named = raw.match(/^(left|top|right|bottom)\b\s*[:=]?\s*(.*)$/i);
    const side = named ? (named[1].toLowerCase() as Side) : SIDE_ORDER[pos++];
    if (!side) return { error: 'Orientation takes at most four margins after it: left, top, right, bottom' };
    const m = parseMargin(named ? named[2] : raw);
    if (!m) return { error: 'A margin needs a number and a unit, e.g. 15mm, 1.5cm or 0.5in' };
    if (m.mm > MAX_MM) return { error: 'That margin is too wide for the page; use 60mm (about 2.4in) or less' };
    got[side] = m.css;
  }
  const only = Object.keys(got).length === 1 && got.left ? got.left : null;
  const left = got.left ?? DEFAULT_MARGIN;
  const top = got.top ?? only ?? DEFAULT_MARGIN;
  return { margins: { left, top, right: got.right ?? left, bottom: got.bottom ?? top } };
}

/** The shortest Orientation: margin list that gives these margins ('' for the default). */
export function writeMargins(m: Margins): string {
  if (m.right === m.left && m.bottom === m.top) {
    if (m.left !== m.top) return m.left + ',' + m.top;
    return m.left === DEFAULT_MARGIN ? '' : m.left;
  }
  if (m.bottom === m.top) return [m.left, m.top, m.right].join(',');
  return [m.left, m.top, m.right, m.bottom].join(',');
}

const pageMargins = (page: NotationDoc['page']): Margins =>
  page.margins || { left: DEFAULT_MARGIN, top: DEFAULT_MARGIN, right: DEFAULT_MARGIN, bottom: DEFAULT_MARGIN };

/** Each margin as a share of the page's width (what the screen page uses as padding). */
export function marginShare(page: NotationDoc['page']): Record<Side, number> {
  const [w, h] = SIZES[page.size] || SIZES.A4;
  const width = page.orientation === 'landscape' ? h : w;
  const m = pageMargins(page);
  const share = (side: Side) => (parseMargin(m[side])?.mm ?? 12) / width;
  return { left: share('left'), top: share('top'), right: share('right'), bottom: share('bottom') };
}

/** The @page rule for printing. */
export function pageRule(page: NotationDoc['page']): string {
  const m = pageMargins(page);
  const margin = m.top === m.bottom && m.left === m.right ? (m.top === m.left ? m.top : m.top + ' ' + m.left) : [m.top, m.right, m.bottom, m.left].join(' ');
  return '@page { size: ' + (page.size || 'A4') + ' ' + page.orientation + '; margin: ' + margin + '; }';
}
