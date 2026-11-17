// Grouping: On / Off — the gaps between beats inside a bar — run with: npm test
import { describe, expect, test } from 'vitest';
import { parse } from '../src/engine';
import type { StaffBlock } from '../src/engine/types';
import { complete } from '../src/lib/directives';
import { highlight } from '../src/lib/highlight';

const staffs = (src: string) => parse(src).blocks.filter((b): b is StaffBlock => b.type === 'staff');
const seps = (src: string) => staffs(src).map((b) => b.rows.map((r) => r.intervals.map((iv) => iv.sep)));

const CAPU = 'Tala: RupakaCapu\nDefaultSpeed: 2\n';
const LINE = 'S: s n r s n , d n sa ri | ri ; ; sa ri pa\n';

describe('Grouping', () => {
  test('capu talas: beats are set apart by default, and run on when it is off', () => {
    // two avartanams of three beats each on a row
    expect(seps(CAPU + LINE)).toEqual([[['anga', 'anga', '||', 'anga', 'anga', '||']]]);
    expect(seps(CAPU + 'Grouping: Off\n' + LINE)).toEqual([[['||', '||']]]);
    expect(parse(CAPU + 'Grouping: Off\n' + LINE).warnings).toEqual([]);
  });

  test('the bars of other talas stay', () => {
    const adi = "Tala: Adi\nS: s r g m p d n s' | s' n d p | m g r s ||\n";
    expect(seps('Grouping: Off\n' + adi)).toEqual(seps(adi));
    expect(seps(adi)).toEqual([[['|', '|', '||']]]);
  });

  test('gitam and varnam layouts: the akshara gaps go too', () => {
    const gitam = 'Tala: Rupaka\nLayout: gitam\nS: s r g m p d | s r g m p d ||\n';
    expect(seps(gitam).flat(2)).toContain('akshara');
    expect(seps('Grouping: Off\n' + gitam).flat(2)).not.toContain('akshara');
  });

  test('applies from the next swara line on, and can be turned back on', () => {
    const s = staffs(CAPU + LINE + 'Grouping: Off\n' + LINE + 'Grouping: On\n' + LINE);
    expect(s.map((b) => b.grouping)).toEqual([true, false, true]);
    expect(staffs(CAPU + 'Heading: "pallavi"\nGrouping: off\n' + LINE).map((b) => b.grouping)).toEqual([false]);
  });

  test('timing and the notes themselves are untouched', () => {
    const ev = (src: string) => staffs(src).flatMap((b) => b.rows.flatMap((r) => r.events.map((e) => [e.display || e.text, e.t, e.dur])));
    expect(ev(CAPU + 'Grouping: Off\n' + LINE)).toEqual(ev(CAPU + LINE));
  });

  test('anything else is pointed out', () => {
    const doc = parse(CAPU + 'Grouping: maybe\n' + LINE);
    expect(doc.warnings.map((w) => w.message).join()).toMatch(/Grouping should be On or Off/);
    expect((doc.blocks.find((b) => b.type === 'staff') as StaffBlock).grouping).toBe(true);
  });

  test('the editor knows it', () => {
    expect(highlight('Grouping: Off')).not.toContain('hl-bad');
    expect(complete('gr')).toEqual({ remove: 2, insert: 'Grouping: ' });
    expect(complete('Grouping: o')?.insert).toBe('Off');
    expect(complete('g')?.insert).toBe('Gati: ');
  });
});
