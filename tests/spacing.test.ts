// Spacing: Tight / Normal / Wide / percentage — run with: npm test
import { describe, expect, test } from 'vitest';
import { parse } from '../src/engine';
import type { StaffBlock } from '../src/engine/types';
import { complete } from '../src/lib/directives';
import { highlight } from '../src/lib/highlight';

const staffs = (src: string) => parse(src).blocks.filter((b): b is StaffBlock => b.type === 'staff');
const LINE = "S: s r g m | p d | n s' ||";

describe('Spacing', () => {
  test('is normal unless set, and takes names or a percentage', () => {
    expect(staffs('Tala: Adi\n' + LINE)[0].spacing).toBe(1);
    expect(staffs('Tala: Adi\nSpacing: Tight\n' + LINE)[0].spacing).toBe(0.7);
    expect(staffs('Tala: Adi\nSpacing: wide\n' + LINE)[0].spacing).toBe(1.4);
    expect(staffs('Tala: Adi\nSpacing: Normal\n' + LINE)[0].spacing).toBe(1);
    expect(staffs('Tala: Adi\nSpacing: 85\n' + LINE)[0].spacing).toBeCloseTo(0.85);
    expect(staffs('Tala: Adi\nSpacing: 120%\n' + LINE)[0].spacing).toBeCloseTo(1.2);
    expect(parse('Tala: Adi\nSpacing: Tight\n' + LINE).warnings).toEqual([]);
  });

  test('applies from the next swara line on', () => {
    const s = staffs('Tala: Adi\n' + LINE + '\nSpacing: Tight\n' + LINE + '\nSpacing: Normal\n' + LINE);
    expect(s.map((b) => b.spacing)).toEqual([1, 0.7, 1]);
    // set after a heading has opened the section, before any swaras: no extra section
    expect(staffs('Tala: Adi\nHeading: "pallavi"\nSpacing: Tight\n' + LINE).map((b) => b.spacing)).toEqual([0.7]);
  });

  test('values that make no sense are pointed out and ignored', () => {
    for (const v of ['huge', '10', '900', '-50', '']) {
      const doc = parse('Tala: Adi\nSpacing: ' + v + '\n' + LINE);
      expect(doc.warnings.map((w) => w.message).join()).toMatch(/Spacing should be/);
      expect((doc.blocks.find((b) => b.type === 'staff') as StaffBlock).spacing).toBe(1);
    }
  });

  test('the editor knows it', () => {
    expect(highlight('Spacing: Tight')).not.toContain('hl-bad');
    expect(complete('spa')).toEqual({ remove: 3, insert: 'Spacing: ' });
    expect(complete('Spacing: t')).toEqual({ remove: 1, insert: 'Tight' });
    // the short ones still win
    expect(complete('s')?.insert).toBe('S: ');
    expect(complete('sp')?.insert).toBe('SpeedMarks: ');
  });
});
