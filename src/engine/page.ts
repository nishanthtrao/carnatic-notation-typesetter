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

/** Page width, height and margin in millimetres, orientation applied. */
export function pageMm(page: NotationDoc['page']): { width: number; height: number; margin: number } {
  const [w, h] = SIZES[page.size] || SIZES.A4;
  const landscape = page.orientation === 'landscape';
  return { width: landscape ? h : w, height: landscape ? w : h, margin: parseMargin(page.margin || DEFAULT_MARGIN)?.mm ?? 12 };
}

/** The page's margin as a share of its width (what the screen page uses as padding). */
export function marginShare(page: NotationDoc['page']): number {
  const [w, h] = SIZES[page.size] || SIZES.A4;
  const width = page.orientation === 'landscape' ? h : w;
  const mm = parseMargin(page.margin || DEFAULT_MARGIN)?.mm ?? 12;
  return mm / width;
}

/** The @page rule for printing. */
export function pageRule(page: NotationDoc['page']): string {
  return '@page { size: ' + (page.size || 'A4') + ' ' + page.orientation + '; margin: ' + (page.margin || DEFAULT_MARGIN) + '; }';
}
