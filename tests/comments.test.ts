import { expect, test } from 'vitest';
import { toggleLineComments } from '../src/lib/comments';

const apply = (v: string, a: number, b: number) => {
  const c = toggleLineComments(v, a, b);
  return v.slice(0, c.start) + c.text + v.slice(c.end);
};

test('Ctrl+/ comments and uncomments the selected lines', () => {
  const v = 'Tala: Adi\nS: s r g m ||\n\nL: sa ri ga ma\nTitle: x';
  const a = v.indexOf('S:'), b = v.indexOf('ma') + 2;
  const once = apply(v, a, b);
  expect(once).toBe('Tala: Adi\n# S: s r g m ||\n\n# L: sa ri ga ma\nTitle: x');
  expect(apply(once, once.indexOf('# S'), once.indexOf('ma') + 2)).toBe(v);
  // caret only: just that line; selection ending at a line start excludes that line
  expect(apply(v, 2, 2)).toBe('# Tala: Adi\nS: s r g m ||\n\nL: sa ri ga ma\nTitle: x');
  expect(apply(v, 0, v.indexOf('S:'))).toBe('# Tala: Adi\nS: s r g m ||\n\nL: sa ri ga ma\nTitle: x');
});
