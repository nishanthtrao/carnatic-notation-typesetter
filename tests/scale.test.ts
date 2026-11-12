import { test, expect } from 'vitest';
import { parse } from '../src/engine/parser';
import { assistModeFor, formFor } from '../src/dialogs/AssistDialog';

const metaOf = (src: string) => {
  const b = parse(src).blocks.find((x) => x.type === 'meta');
  if (!b || b.type !== 'meta') throw new Error('no meta block');
  return b.items;
};

test('scale lines: swaras with octave and variant', () => {
  const [aro, ava] = metaOf("Arohana: s r2 g2 m1 d2 n2 s'\nAvarohana: s' n2 p m1 g2 m1 r2 s`");
  expect(aro.swaras!.map((e) => [e.note, e.variant ?? null, e.octave ?? 0])).toEqual([
    ['s', null, 0], ['r', '2', 0], ['g', '2', 0], ['m', '1', 0], ['d', '2', 0], ['n', '2', 0], ['s', null, 1],
  ]);
  expect(ava.swaras![0].octave).toBe(1);
  expect(ava.swaras![ava.swaras!.length - 1].octave).toBe(-1);
  expect(aro.label).toBe('Ārōhaṇam');
});

test('scale labels and raga name follow an Indian-script language', () => {
  const items = metaOf("Language: Kannada\nRaga: kAnaDa\nArohana: s r2 g2 m1 d2 n2 s'\nAvarohana: s' n2 p m1 g2 m1 r2 s");
  expect(items.map((i) => i.label)).toEqual(['ರಾಗ', 'ಆರೋಹಣ', 'ಅವರೋಹಣ']);
  expect(items[0].text).toBe('ಕಾನಡ');
  const labels = (lang: string) => metaOf(`Language: ${lang}\nRaga: x\nArohana: s\nAvarohana: s`).map((i) => i.label);
  expect(labels('Telugu')).toEqual(['రాగం', 'ఆరోహణ', 'అవరోహణ']);
  expect(labels('Tamil')).toEqual(['ராகம்', 'ஆரோகணம்', 'அவரோகணம்']);
  expect(labels('Malayalam')).toEqual(['രാഗം', 'ആരോഹണം', 'അവരോഹണം']);
  expect(labels('Sanskrit')).toEqual(['राग', 'आरोहण', 'अवरोहण']);
  expect(labels('Diacritics')).toEqual(['Rāgam', 'Ārōhaṇam', 'Avarōhaṇam']);
  expect(metaOf('Raga: mOhanam')[0]).toMatchObject({ label: 'Rāgam', value: 'mOhanam' });
});

test('Assist opens the scale form on raga and scale lines', () => {
  for (const line of ['Arohana: s r g', 'avarohanam:', 'Raga: kAnaDa', '  Ragam: x'])
    expect(assistModeFor(line)).toMatchObject({ kind: 'form', name: 'Scale' });
  expect(formFor('Arohana')).toBe('Scale');
  expect(formFor('Composer')).toBeNull();
  expect(assistModeFor('Tala: Adi')).toMatchObject({ name: 'Tala' });
});
