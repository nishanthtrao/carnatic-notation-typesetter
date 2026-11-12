import { expect, test } from 'vitest';
import { detectScript, fromScript, transliterate } from '../src/engine/translit';

const WORDS = [
  'brOva bhAramA raghurAmA', 'SrI kRShNa', 'tyAgarAja', 'nannu pAlimpa', 'kAmAkShi', 'saMgIta jnAna',
  'jagadAnandakAraka', 'Sankara', 'vAsudEva', 'rAmaH', 'kaNNan', 'aruL', 'tamizh', 'manam', 'avan', '_rANi',
  'bhakti', 'dhyAnamu', 'kSha', 'gaurI', 'Ishvara', 'Urdhva', 'vidyA',
];
const SCRIPTS = ['devanagari', 'telugu', 'kannada', 'malayalam', 'tamil'] as const;

for (const s of SCRIPTS) {
  test('round trip: typing scheme -> ' + s + ' -> typing scheme -> ' + s, () => {
    for (const w of WORDS) {
      const shown = transliterate(w, s);
      const back = fromScript(shown);
      expect(transliterate(back, s), w + ' -> ' + shown + ' -> ' + back).toBe(shown);
    }
  });
}

test('readable results for real text', () => {
  expect(fromScript('ബ്രോവ ഭാരമാ രഘുരാമാ')).toBe('brOva bhAramA raghurAmA');
  expect(fromScript('അവൻ മനം')).toBe('avan manaM');
  expect(fromScript('റാണി')).toBe('_rANi');
  expect(fromScript('रामा')).toBe('rAmA');
  expect(fromScript('శ్రీ రామ')).toBe('SrI rAma');
  expect(fromScript('ತ್ಯಾಗರಾಜ')).toBe('tyAgarAja');
  expect(fromScript('ராமா')).toBe('rAmA');
  expect(fromScript('க³ணபதி')).toBe('gaNapati'); // qualifier ³ = g
  expect(fromScript('क्ह')).toBe('k.ha'); // kept apart, not kh
  expect(fromScript('S: s r g, hello')).toBe('S: s r g, hello'); // other text untouched
  expect(detectScript('ബ്രോവ ഭാരമാ')).toBe('malayalam');
  expect(detectScript('hello')).toBeNull();
});
