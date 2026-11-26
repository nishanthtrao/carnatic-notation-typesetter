import { describe, expect, test } from 'vitest';
import { tipAt, tipNames } from '../src/lib/directive-tips';
import { DIRECTIVES } from '../src/lib/directives';

describe('directive tips', () => {
  test('every directive has one', () => {
    expect(tipNames().sort()).toEqual(DIRECTIVES.map((d) => d.name).sort());
  });
  test('found only on the name at the start of a line', () => {
    expect(tipAt('Tala: Adi,Show', 0)?.name).toBe('Tala');
    expect(tipAt('Tala: Adi,Show', 3)?.name).toBe('Tala');
    expect(tipAt('Tala: Adi,Show', 7)).toBeNull(); // on the value
    expect(tipAt('  defaultspeed: 1', 4)?.name).toBe('DefaultSpeed'); // any case, indented
    expect(tipAt('  defaultspeed: 1', 0)).toBeNull();
    expect(tipAt('SongBreak', 2)?.name).toBe('SongBreak'); // no value
    expect(tipAt('S: s r g m ||', 0)?.name).toBe('S');
    expect(tipAt('# Tala: Adi', 2)).toBeNull(); // a comment
    expect(tipAt('Talam: Adi', 1)).toBeNull(); // not a directive
  });
});
