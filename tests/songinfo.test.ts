// @vitest-environment jsdom
import { describe, expect, test } from 'vitest';
import { parse, render } from '../src/engine';
import { complete } from '../src/lib/directives';

type Meta = Extract<ReturnType<typeof parse>['blocks'][number], { type: 'meta' }>;
const meta = (doc: ReturnType<typeof parse>) => doc.blocks.filter((b): b is Meta => b.type === 'meta');
const SONG = `Title: "x"
Tala: Adi,Show
Heading: "x",bold,center
Raga: mOhanam
Arohana: s r2 g3 p d2 s'
Avarohana: s' d2 p g3 r2 s
Composer: tyAgarAja
%s
S: s r g m ||`;

describe('SongInfo', () => {
  test('everything in the middle, one item per line, by default', () => {
    const m = meta(parse(SONG.replace('%s', '')));
    expect(m).toHaveLength(1);
    expect(m[0].layout).toEqual({ composer: 'center', raga: 'center', ragaLines: 'lines', tala: 'center' });
    expect(m[0].items.map((i) => i.kind)).toEqual(['tala', 'raga', 'aro', 'ava', 'composer']);
  });
  test('each group gets its side, and the raga its lines', () => {
    const doc = parse(SONG.replace('%s', 'SongInfo: Composer Right, Raga Left TwoLines, Tala Left'));
    expect(doc.warnings).toEqual([]);
    expect(meta(doc)[0].layout).toEqual({ composer: 'right', raga: 'left', ragaLines: 'two', tala: 'left' });
  });
  test('a group left out keeps its place', () => {
    expect(meta(parse(SONG.replace('%s', 'SongInfo: raga oneline')))[0].layout).toEqual({ composer: 'center', raga: 'center', ragaLines: 'one', tala: 'center' });
  });
  test('a wrong value is reported', () => {
    expect(parse(SONG.replace('%s', 'SongInfo: Raga Sideways')).warnings[0].message).toMatch(/SongInfo should look like/);
    expect(parse(SONG.replace('%s', 'SongInfo: Left')).warnings[0].message).toMatch(/SongInfo should look like/);
  });
  test('the editor completes it without taking over S', () => {
    expect(complete('songi')?.insert).toBe('SongInfo: ');
    expect(complete('s')?.insert).toBe('S: ');
  });
});

describe('showing the tala', () => {
  test('only with ,Show', () => {
    expect(meta(parse(SONG.replace('Tala: Adi,Show', 'Tala: Adi').replace('%s', '')))[0].items.some((i) => i.kind === 'tala')).toBe(false);
  });
  test('labelled and written in the song’s script', () => {
    const doc = parse('Language: Kannada\nTala: Rupaka,Show\nRaga: mOhanam\nS: s r g m');
    const t = meta(doc)[0].items.find((i) => i.kind === 'tala')!;
    expect(t.label).toBe('ತಾಳ');
    expect(t.text).toBe('ರೂಪಕ');
  });
  test('without other details it goes under the title', () => {
    const doc = parse('Tala: MisraCapu,Show\nHeading: "Song"\nHeading: "pallavi"\nS: s r g m p d n');
    expect(doc.blocks.map((b) => b.type).slice(0, 3)).toEqual(['heading', 'meta', 'heading']);
    expect(meta(doc)[0].items[0].value).toBe('Misra Capu');
  });
  test('a Tala line after the details joins them', () => {
    const doc = parse('Raga: mOhanam\nTala: Adi,Show\nS: s r g m');
    expect(meta(doc)).toHaveLength(1);
    expect(meta(doc)[0].items.map((i) => i.kind)).toEqual(['raga', 'tala']);
  });
});

describe('song details on the page', () => {
  const html = (info: string) => {
    const el = document.createElement('div');
    render(parse(SONG.replace('%s', info)), el);
    return el.querySelector('.cm-meta')!;
  };
  test('same side: composer, then raga and scale, then tala', () => {
    const col = html('SongInfo: Composer Left, Raga Left, Tala Left').querySelector('.cm-meta-left')!;
    const labels = [...col.children].filter((c) => c.classList.contains('cm-meta-k')).map((c) => c.textContent);
    expect(labels).toEqual(['Composer', 'Rāgam', 'Ārōhaṇam', 'Avarōhaṇam', 'Tālam']);
  });
  test('different sides sit next to each other', () => {
    const m = html('SongInfo: Composer Right, Raga Left, Tala Left');
    expect([...m.children].map((c) => c.className)).toEqual(['cm-meta-col cm-meta-left', 'cm-meta-col cm-meta-right']);
  });
  test('two lines: the scale shares a line; one line: all three do', () => {
    const rows = (info: string) => html(info).querySelectorAll('.cm-meta-col > .cm-meta-k').length;
    expect(rows('SongInfo: Raga Center Lines')).toBe(5);
    expect(rows('SongInfo: Raga Center TwoLines')).toBe(4);
    expect(rows('SongInfo: Raga Center OneLine')).toBe(3);
  });
});
