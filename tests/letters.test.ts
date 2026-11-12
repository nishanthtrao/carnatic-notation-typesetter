import { expect, test } from 'vitest';
import { renderUnit, searchGroups, SOUND_GROUPS, wordVariants } from '../src/lib/soundalikes';
import { lettersContext } from '../src/lib/letters-context';

test('Malayalam r sounds: ര is r, റ is _r', () => {
  const r = SOUND_GROUPS.find((g) => g.id === 'r')!;
  expect(r.units.map((u) => renderUnit(u, 'malayalam'))).toEqual(['ര', 'റ', 'ഋ']);
  const v = wordVariants('ra', 'malayalam');
  expect(v[0]).toMatchObject({ text: 'ra', shown: 'ര', current: true });
  expect(v.map((x) => x.shown)).toContain('റ');
  expect(v.find((x) => x.shown === 'റ')!.text).toBe('_ra');
  expect(v.map((x) => x.shown)).toContain('രാ'); // vowel length
});

test('variants skip spellings that look the same in the script', () => {
  // Malayalam writes dental n and alveolar n the same way
  const shown = wordVariants('na', 'malayalam').map((x) => x.shown);
  expect(new Set(shown).size).toBe(shown.length);
  expect(wordVariants('kaLa', 'tamil').map((x) => x.text)).toEqual(expect.arrayContaining(['kala', 'kazha']));
});

test('search finds groups by code, name or description', () => {
  expect(searchGroups('zh').map((g) => g.id)).toEqual(['l']);
  expect(searchGroups('ṟa').map((g) => g.id)).toContain('r');
  expect(searchGroups('').length).toBe(SOUND_GROUPS.length);
});

test('context: language above the cursor and the lyric word under it', () => {
  const text = 'Language: Tamil\nS: s r g\nLanguage: Malayalam\nL: brO va bhA ra\nS: p d n';
  const lines = text.split('\n');
  const at = (index: number, col: number) => ({ start: lines.slice(0, index).join('\n').length + (index ? 1 : 0), text: lines[index], index, col });
  const c = lettersContext(text, at(3, 'L: brO va bhA r'.length));
  expect(c.lang).toBe('malayalam');
  expect(c.word).toMatchObject({ text: 'ra' });
  expect(text.slice(c.word!.start, c.word!.end)).toBe('ra');
  expect(lettersContext(text, at(1, 4)).word).toBeNull(); // swara lines have no words
  expect(lettersContext(text, at(1, 4)).lang).toBe('tamil');
});
