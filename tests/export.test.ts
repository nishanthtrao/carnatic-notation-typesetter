import { describe, expect, test } from 'vitest';
import { buildPdf } from '../src/lib/pdfWriter';
import { pageMm, parse } from '../src/engine';

// a 1×1 JPEG
const JPEG = Uint8Array.from(atob('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA='), (c) => c.charCodeAt(0));

describe('PDF of page images', () => {
  test('a valid PDF: header, one page per image, a cross-reference table that points at the objects', async () => {
    const blob = buildPdf([{ jpeg: JPEG, width: 1, height: 1 }, { jpeg: JPEG, width: 1, height: 1 }], 595.28, 841.89, 'ರಾಗಸುಧಾರಸ');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const text = new TextDecoder('latin1').decode(bytes);
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text).toContain('/Count 2');
    expect(text.match(/\/Type \/Page /g)).toHaveLength(2);
    expect(text).toContain('/MediaBox [0 0 595.28 841.89]');
    expect(text).toContain('/Title <FEFF'); // a non-ASCII title as UTF-16
    // every xref entry points at "n 0 obj"
    const xref = Number(text.match(/startxref\n(\d+)/)![1]);
    const entries = text.slice(xref).split('\n').slice(3).filter((l) => / n $/.test(l));
    entries.forEach((e, i) => expect(text.slice(Number(e.slice(0, 10)), Number(e.slice(0, 10)) + 12)).toMatch(new RegExp('^' + (i + 1) + ' 0 obj')));
  });
});

describe('page size for the export', () => {
  const all = (n: number) => ({ left: n, top: n, right: n, bottom: n });
  test('A4 portrait by default, with the usual margins', () => {
    expect(pageMm(parse('S: s').page)).toEqual({ width: 210, height: 297, margin: all(12) });
  });
  test('landscape swaps the sides; one margin is every side', () => {
    const m = pageMm(parse('Orientation: Landscape,0.5in\nS: s').page);
    expect(m.width).toBe(297);
    expect(m.height).toBe(210);
    for (const v of Object.values(m.margin)) expect(v).toBeCloseTo(12.7, 5);
  });
  test('each side of the page gets its own margin', () => {
    expect(pageMm(parse('Orientation: Portrait,30mm,10mm,15mm,40mm\nS: s').page).margin).toEqual({ left: 30, top: 10, right: 15, bottom: 40 });
  });
});
