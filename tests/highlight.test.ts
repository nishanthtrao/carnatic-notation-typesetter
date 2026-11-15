import { test, expect } from 'vitest';
import { highlight } from '../src/lib/highlight';
import { forDark } from '../src/engine/heading';

const classes = (html: string) => [...html.matchAll(/class="hl-([\w-]+)">([^<]*)</g)].map((m) => m[1] + ':' + m[2]);

test('swara lines: swaras, octave, variants, pauses, bars, speed, gamaka, labels', () => {
  const c = classes(highlight(`S: "1)" s r2 g' ( p~ d- ) , ; | n\` || xx`));
  expect(c).toEqual([
    's:S', 'colon::', 'string:"1)"', 'swara:s', 'swara:r2', "swara:g'", 'speed:(', 'swara:p', 'gamaka:~', 'swara:d', 'phrase:-',
    'speed:)', 'pause:,', 'pause:;', 'bar:|', 'swara:n`', 'bar:||', 'bad:xx',
  ]);
});

test('lyrics, directives by group, strings and numbers, comments', () => {
  expect(classes(highlight('L: sa . ri _'))).toEqual(['l:L', 'colon::', 'lyric:sa', 'pause:.', 'lyric:ri', 'pause:_']);
  expect(classes(highlight('Tala: Adi'))[0]).toBe('kw-rhythm:Tala');
  expect(classes(highlight('Language: Kannada'))[0]).toBe('kw-script:Language');
  expect(classes(highlight('SwaraPrefs: 12,red'))).toContain('number:12');
  expect(classes(highlight('Heading: "pallavi",bold'))).toContain('string:"pallavi"');
  expect(classes(highlight('Arohana: s r2 g3'))).toEqual(['kw-song:Arohana', 'colon::', 'swara:s', 'swara:r2', 'swara:g3']);
  expect(classes(highlight('# a note'))).toEqual(['comment:# a note']);
  expect(classes(highlight('Bogus: 1'))[0]).toBe('bad:Bogus: 1');
  const multi = highlight('S: s <!-- not\nyet --> r\nL: x');
  expect(multi).toContain('<span class="hl-comment">&lt;!-- not\nyet --&gt;</span> r\n');
});

test('the highlighted text is exactly the source (so it lines up with the textarea)', () => {
  const src = 'Title: "A & <B>"\nS: "1." s , r | g ;\nL: a . b\n<!-- c -->\n';
  const text = highlight(src).replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  expect(text).toBe(src + '\n');
});

test('forDark keeps light colours and lifts dark ones on a dark sheet', () => {
  expect(forDark('orange', '#fff')).toBe('orange');
  expect(forDark('#ffcc00', '#fff')).toBe('#ffcc00');
  expect(forDark('black', '#fff')).toBe('light-dark(black, #fff)');
  expect(forDark('#333', '#fff')).toBe('light-dark(#333, #fff)');
  expect(forDark('navy', '#fff')).toBe('light-dark(navy, color-mix(in srgb, navy 45%, #fff))');
  expect(forDark('rgb(120,0,0)', '#fff')).toContain('color-mix');
});
