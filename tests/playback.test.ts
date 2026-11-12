import { expect, test } from 'vitest';
import { parse } from '../src/engine/parser';
import { findRaga, melaScale, scaleFromText } from '../src/audio/ragas';
import { buildTimeline } from '../src/audio/schedule';

test('melakarta scales follow the chakra scheme', () => {
  expect(melaScale(29)).toEqual({ r: 2, g: 3, m: 1, d: 2, n: 3 }); // Dheerasankarabharanam
  expect(melaScale(15)).toEqual({ r: 1, g: 3, m: 1, d: 1, n: 3 }); // Mayamalavagowla
  expect(melaScale(22)).toEqual({ r: 2, g: 2, m: 1, d: 2, n: 2 }); // Kharaharapriya
  expect(melaScale(8)).toEqual({ r: 1, g: 2, m: 1, d: 1, n: 2 }); // Hanumatodi
  expect(melaScale(65)).toEqual({ r: 2, g: 3, m: 2, d: 2, n: 3 }); // Mechakalyani
});

test('raga names are matched loosely', () => {
  expect(findRaga('bahudAri')?.name).toBe('Bahudari');
  expect(findRaga('Sankarabharanam')?.name).toBe('Shankarabharanam');
  expect(findRaga('nATa')?.name).toBe('Nata');
  expect(findRaga('mAyAmALavagauLa')?.mela).toBe(15);
  expect(findRaga('Mohana')?.name).toBe('Mohanam');
  expect(findRaga('no such raga')).toBeNull();
});

test('the scale comes from Arohana lines, then the Raga line, then the heading', () => {
  expect(scaleFromText('Arohana: s r1 g3 m1 p d1 n3 s\'', '').fromLines).toEqual({ r: 1, g: 3, m: 1, d: 1, n: 3 });
  expect(scaleFromText('Raga: mOhanam', 'Kalyani')).toMatchObject({ source: 'raga-line', name: 'Mohanam' });
  expect(scaleFromText('Title: x', 'bahudAri')).toMatchObject({ source: 'heading', name: 'Bahudari' });
  expect(scaleFromText('Title: x', '')).toMatchObject({ source: 'default' });
});

test('timeline: pitches, karvai, variants, octaves and tala beats', () => {
  const doc = parse("Tala: Adi\nDefaultSpeed: 1\nS: s r g m | p , | m g ||\nS: s' r1 s` , | , , | , , ||\n");
  const tl = buildTimeline(doc, melaScale(29));
  const first = tl.notes.slice(0, 7);
  expect(first.map((n) => n.semis)).toEqual([0, 2, 4, 5, 7, 5, 4]);
  expect(first[4].dur).toBeCloseTo(1); // p plus its karvai
  expect(tl.notes.slice(7).map((n) => n.semis)).toEqual([12, 1, -12]);
  expect(tl.notes[9].dur).toBeCloseTo(3); // held through five karvais
  expect(tl.beats.slice(0, 8).map((b) => b.accent)).toEqual([2, 0, 0, 0, 1, 0, 1, 0]);
  expect(tl.length).toBeCloseTo(8); // both lines together fill one cycle of Adi at this speed
  expect(tl.notes[0].key).toMatch(/^\d+\.0\.0$/);
});

test('ragas with a different descent use it going down', () => {
  const bhairavi = findRaga('Bhairavi')!;
  const doc = parse('Tala: Adi\nDefaultSpeed: 1\nS: p d n s\' | n d | p , ||\n');
  const tl = buildTimeline(doc, bhairavi.up, bhairavi.down);
  const d = tl.notes.filter((_, i) => i === 1 || i === 5).map((n) => n.semis);
  expect(d).toEqual([9, 8]); // d2 going up, d1 coming down
});
