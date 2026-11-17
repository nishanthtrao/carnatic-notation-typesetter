// AvartanamsPerLine — how many avartanams go on a line — run with: npm test
import { describe, expect, test } from 'vitest';
import { parse } from '../src/engine';
import type { StaffBlock } from '../src/engine/types';
import { complete } from '../src/lib/directives';
import { highlight } from '../src/lib/highlight';

/** how many swaras and pauses each line holds */
const rows = (src: string) => parse(src).blocks.filter((b): b is StaffBlock => b.type === 'staff').flatMap((b) => b.rows.map((r) => r.events.length));
const CAPU = 'Tala: RupakaCapu\nDefaultSpeed: 2\n';
// four avartanams of Rupaka Capu
const FOUR = 'S: s n r s n , d n sa ri | ri ; ; sa ri pa | s n r s n , d n sa ri | ri ; ; sa ri pa\n';
const ADI = "S: s r g m p d n s' | s' n d p | m g r s || s r g m p d n s' | s' n d p | m g r s ||\n";

describe('AvartanamsPerLine', () => {
  test('each tala has its usual number, and the directive changes it', () => {
    expect(rows(CAPU + FOUR)).toEqual([16, 16]); // Rupaka Capu: two on a line
    expect(rows(CAPU + 'AvartanamsPerLine: 1\n' + FOUR)).toEqual([10, 6, 10, 6]);
    expect(rows(CAPU + 'AvartanamsPerLine: 4\n' + FOUR)).toEqual([32]);
    expect(rows('Tala: Adi\n' + ADI)).toEqual([16, 16]); // Adi: one on a line
    expect(rows('Tala: Adi\nAvartanamsPerLine: 2\n' + ADI)).toEqual([32]);
    expect(parse(CAPU + 'AvartanamsPerLine: 1\n' + FOUR).warnings).toEqual([]);
  });

  test('applies from the next swara line, and Default goes back to the tala’s own number', () => {
    expect(rows(CAPU + FOUR + 'AvartanamsPerLine: 1\n' + FOUR + 'AvartanamsPerLine: Default\n' + FOUR)).toEqual([16, 16, 10, 6, 10, 6, 16, 16]);
  });

  test('anything else is pointed out and changes nothing', () => {
    for (const v of ['0', '9', 'two', '2.5', '']) {
      const doc = parse(CAPU + 'AvartanamsPerLine: ' + v + '\n' + FOUR);
      expect(doc.warnings.map((w) => w.message).join()).toMatch(/AvartanamsPerLine should be/);
      expect(rows(CAPU + 'AvartanamsPerLine: ' + v + '\n' + FOUR)).toEqual([16, 16]);
    }
  });

  test('the editor knows it', () => {
    expect(highlight('AvartanamsPerLine: 1')).not.toContain('hl-bad');
    expect(complete('avart')).toEqual({ remove: 5, insert: 'AvartanamsPerLine: ' });
    expect(complete('AvartanamsPerLine: d')?.insert).toBe('Default');
    // the scale lines still come first
    expect(complete('a')?.insert).toBe('Arohana: ');
    expect(complete('av')?.insert).toBe('Avarohana: ');
  });
});
