// sA rI gA… for dheerga swaras, and extra hyphens after a phrase end — run with: npm test
import { describe, expect, test } from 'vitest';
import { parse } from '../src/engine';
import type { NoteEvent, StaffBlock } from '../src/engine/types';
import { highlight } from '../src/lib/highlight';

const events = (src: string): NoteEvent[] =>
  parse(src)
    .blocks.filter((b): b is StaffBlock => b.type === 'staff')
    .flatMap((b) => b.rows.flatMap((r) => r.events));

describe('dheerga swaras written sA rI gA…', () => {
  test('mean exactly what sa ri ga… mean', () => {
    const caps = "Tala: Adi\nS: sA rI gA mA | pA dA | nI sA' ||";
    const plain = "Tala: Adi\nS: sa ri ga ma | pa da | ni sa' ||";
    expect(parse(caps).warnings).toEqual([]);
    const strip = (evs: NoteEvent[]) => evs.map(({ note, long, display, octave, dur, t }) => ({ note, long, display, octave, dur, t }));
    expect(strip(events(caps))).toEqual(strip(events(plain)));
  });

  test('dhA, variants, octave marks, gamakas and phrase ends work with them', () => {
    const evs = events('Tala: Manual\nS: dhA rI2 gA` mA~ pA-');
    expect(evs.map((e) => e.display)).toEqual(['dha', 'ri', 'ga', 'ma', 'pa']);
    expect(evs.every((e) => e.long)).toBe(true);
    expect(evs[1].variant).toBe('2');
    expect(evs[2].octave).toBe(-1);
    expect(evs[3].gamaka).toBe('~');
    expect(evs[4].phraseEnd).toBe(true);
  });

  test('other capitalisations are still mistakes', () => {
    expect(parse('Tala: Manual\nS: Sa sAa').warnings.length).toBeGreaterThan(0);
  });

  test('the editor colours them as swaras', () => {
    expect(highlight('S: sA rI dhA nI-- ||')).not.toContain('hl-bad');
  });
});

describe('several hyphens after a phrase end', () => {
  test('count the hyphens and take no time', () => {
    const evs = events('Tala: Adi\nS: s r- g m-- | p, d--- | n s ||');
    const byText = evs.map((e) => [e.display || e.text, e.phraseEnd, e.phraseLen || 0]);
    expect(byText).toEqual([
      ['s', false, 0], ['r', true, 1], ['g', false, 0], ['m', true, 2],
      ['p', false, 0], [',', false, 0], ['d', true, 3],
      ['n', false, 0], ['s', false, 0],
    ]);
    expect(parse('Tala: Adi\nS: s r- g m-- | p, d--- | n s ||').warnings).toEqual([]);
  });

  test('also after pauses and = ', () => {
    const evs = events('Tala: Manual\nS: s ,-- ;--- =--');
    expect(evs.map((e) => e.phraseLen)).toEqual([0, 2, 3, 2]);
  });

  test('a lone - is still a dash pause, and -- a dash with a phrase end', () => {
    const evs = events('Tala: Manual\nS: s - --');
    expect(evs.map((e) => [e.kind, e.phraseEnd])).toEqual([['swara', false], ['dash', false], ['dash', true]]);
  });

  test('speed lines break at a spaced phrase end even when phrase ends are hidden', () => {
    const doc = parse('Tala: Adi\nS: ( s r g m-- p d n s ) | s , | , , ||');
    const row = (doc.blocks.find((b) => b.type === 'staff') as StaffBlock).rows[0];
    expect(row.groups.filter((g) => g.depth === 1)).toHaveLength(2);
  });

  test('a single hyphen leaves a 5px gap and splits the speed line by default', () => {
    const groups = (text: string) => (parse(text).blocks.find((b) => b.type === 'staff') as StaffBlock).rows[0].groups.filter((g) => g.depth === 1);
    const plain = 'Tala: Adi\nS: ( s r g m- p d n s ) | s , | , , ||';
    expect(groups(plain)).toHaveLength(2);
    expect(parse(plain).blocks.find((b) => b.type === 'staff')).toMatchObject({ phraseEnds: { style: 'hide', space: 5 } });
    expect(groups('Tala: Adi\nSpeedMarks: Below\nS: ( s r g m- p d n s ) | s , | , , ||')).toHaveLength(2);
    // PhraseEnds: Hide,0 is the old way: no gap, one speed line
    expect(groups('PhraseEnds: Hide,0\n' + plain)).toHaveLength(1);
    // a style without a number keeps the 5px gap
    expect(parse('PhraseEnds: Show\n' + plain).blocks.find((b) => b.type === 'staff')).toMatchObject({ phraseEnds: { style: 'show', space: 5 } });
  });
});
