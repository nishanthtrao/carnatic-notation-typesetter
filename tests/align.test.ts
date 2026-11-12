// SPDX-License-Identifier: GPL-2.0-or-later
import { expect, test } from 'vitest';
import { alignText } from '../src/lib/align';
import { complete } from '../src/lib/directives';

test('Align pads lyrics under their swaras', () => {
  const out = alignText('Tala: Adi\nSmartLyricMode\nS: "1)" s , r g ( m p ) d n\nL: ka ma la nA ya na\n');
  const [, , s, l] = out.split('\n');
  expect(s).toBe('S: "1)" s  , r  g  ( m  p  ) d  n');
  expect(l.indexOf('ma')).toBe(s.indexOf('r'));
  expect(l.indexOf('nA')).toBe(s.indexOf('m '));
});

test('TAB completion', () => {
  expect(complete('ta')).toEqual({ remove: 2, insert: 'Tala: ' });
  expect(complete('smart')).toEqual({ remove: 5, insert: 'SmartLyricMode' });
  expect(complete('Tala: kh')).toEqual({ remove: 2, insert: 'KhandaCapu' });
  expect(complete('Language: ta')).toEqual({ remove: 2, insert: 'Tamil' });
  expect(complete('S: s r')).toBeNull();
});
