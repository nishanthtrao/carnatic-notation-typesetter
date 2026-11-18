import { describe, expect, test } from 'vitest';
import { parse } from '../src/engine';
import { complete } from '../src/lib/directives';

const info = (extra: string) => {
  const doc = parse('Tala: Adi\n' + extra + '\nRaga: mOhanam\nArohana: s r2 g3 p d2 s\'\nComposer: tyAgarAja\nS: s r g m ||');
  return { doc, block: doc.blocks.find((b) => b.type === 'meta') as Extract<(typeof doc.blocks)[number], { type: 'meta' }> };
};

describe('SongInfo', () => {
  test('a list in the middle by default', () => {
    expect(info('').block.layout).toEqual({ style: 'list', align: 'center' });
  });
  test('style and side in any order', () => {
    expect(info('SongInfo: Left,Inline').block.layout).toEqual({ style: 'inline', align: 'left' });
    expect(info('SongInfo: list right').block.layout).toEqual({ style: 'list', align: 'right' });
  });
  test('can come right after the lines it lays out', () => {
    const doc = parse('Raga: mOhanam\nComposer: x\nSongInfo: Inline\nS: s r g m');
    const b = doc.blocks.find((x) => x.type === 'meta') as { layout?: unknown };
    expect(b.layout).toEqual({ style: 'inline', align: 'center' });
    expect(doc.warnings).toEqual([]);
  });
  test('a wrong value is reported', () => {
    expect(info('SongInfo: Sideways').doc.warnings[0].message).toMatch(/SongInfo should be List or Inline/);
  });
  test('the editor completes it without taking over S', () => {
    expect(complete('songi')?.insert).toBe('SongInfo: ');
    expect(complete('s')?.insert).toBe('S: ');
  });
});
