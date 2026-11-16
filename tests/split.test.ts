import { test, expect } from 'vitest';
import { parse } from '../src/engine/parser';
import type { NoteEvent, StaffBlock } from '../src/engine/types';

/** Each row as text: swaras by display (s, sa…), pauses by their sign. */
const rows = (src: string) => {
  const staff = parse(src).blocks.find((b) => b.type === 'staff') as StaffBlock;
  return staff.rows.map((r) => r.events.map((e: NoteEvent) => (e.kind === 'swara' ? e.display : e.text)).join(' '));
};

test('a dhirgha swara across the end of an avartanam becomes a short swara and a karvai', () => {
  // Rupaka Capu at speed 2 = 12 matras; this avartanam has 13, so the last sa crosses the bar
  const r = rows("Tala: RupakaCapu\nDefaultSpeed: 2\nAvartanamsPerLine: 1\nS: s n` r s s ni` , d` ni` sa ri pa m g g m r s n` s");
  expect(r).toEqual(['s n r s s ni , d ni s', ', ri pa m g g m r s n', 's']);
});

test('a ; across a bar becomes , and ,; the lyric stays on the swara part', () => {
  const src = 'Tala: Adi\nDefaultSpeed: 0\nAvartanamsPerLine: 1\nS: s r g m p d n ; s r g m p d n s\nL: a b c d e f g h i j k l m n o p';
  const r = rows(src);
  expect(r[0]).toBe('s r g m p d n ,');
  expect(r[1].startsWith(', s r')).toBe(true);
  const staff = parse('Tala: Adi\nDefaultSpeed: 0\nAvartanamsPerLine: 1\nS: s r g m p d n sa s r g m p d n\nL: a b c d e f g h i j k l m n o').blocks.find((b) => b.type === 'staff') as StaffBlock;
  const crossing = staff.rows[0].events[7];
  expect(crossing).toMatchObject({ display: 's', long: false });
  expect(crossing.lyrics[0]?.text).toBe('h');
  expect(staff.rows[1].events[0]).toMatchObject({ kind: 'karvai', text: ',' });
  expect(staff.rows[1].events[0].lyrics).toEqual([]);
});

test('anga bars split too where the tala draws them; Tala: Manual is left alone', () => {
  // Adi at speed 0: angas of 4, 2, 2 aksharas; ga starts on akshara 4 of the laghu
  expect(rows('Tala: Adi\nDefaultSpeed: 0\nAvartanamsPerLine: 1\nS: s r g ga p d n s')).toEqual(['s r g g , p d n', 's']);
  expect(rows('Tala: Manual\nS: s r g ga p d n s')[0]).toBe('s r g ga p d n s');
});
