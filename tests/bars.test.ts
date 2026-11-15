import { test, expect } from 'vitest';
import { parse } from '../src/engine/parser';

const SONG = 'Tala: RupakaCapu\ndefaultspeed: 2\nLanguage: Kannada\nSmartLyricMode\n';
// third avartanam has 13 mātras (ni` is long)
const LINE = "S: \"1.\" ri ;- ;- sa ri pa || ga ;- ma ri sa ; || s  n` r  s- s   ni` ,- d`- ni` sa || ri pa- m  g g  m- r  s n`  s ||";
const barWarnings = (src: string) => parse(src).warnings.filter((w) => /mātra/.test(w.message));

test('a || that misses the end of the avartanam is reported once, with the count', () => {
  const w = barWarnings(SONG + LINE);
  expect(w).toHaveLength(1);
  expect(w[0].line).toBe(5);
  expect(w[0].message).toContain('1 mātra after the end of the avartanam');
  expect(w[0].message).toContain('12 mātras per avartanam');
});

test('correct bars, Manual tala and Tala,Manual', () => {
  expect(barWarnings(SONG + LINE.replace('ni` ,- d`-', 'n` ,- d`-'))).toHaveLength(0);
  expect(barWarnings(SONG.replace('RupakaCapu', 'Manual') + LINE)).toHaveLength(0);
  expect(barWarnings(SONG.replace('RupakaCapu', 'RupakaCapu,Manual') + LINE)).toHaveLength(1);
});

test('| is not checked (used loosely for phrasing); several misses on a line are summarised', () => {
  expect(barWarnings('Tala: Adi\nS: s r g m p d n | s r g m p d n s ||')).toHaveLength(1);
  expect(barWarnings('Tala: Adi\nS: s r g | m p d n s s r g m | p d n s ||')).toHaveLength(0);
  const many = barWarnings('Tala: Adi\nS: s r || g m || p d || n s ||');
  expect(many).toHaveLength(1);
  expect(many[0].message).toMatch(/more bars? on this line also miss/);
});
