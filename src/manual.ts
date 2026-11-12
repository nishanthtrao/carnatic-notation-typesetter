/*
 * Carnatic Music Notation Typesetter — renders the live examples in the manual
 * SPDX-License-Identifier: GPL-2.0-or-later
 */
import { parse, render } from './engine';

const sheets = Array.from(document.querySelectorAll<HTMLPreElement>('pre.ex')).map((pre) => {
  const out = document.createElement('div');
  out.className = 'out';
  pre.after(out);
  return { pre, out };
});
const draw = () => {
  for (const s of sheets) render(parse(s.pre.textContent || ''), s.out);
};
draw();
document.fonts?.ready.then(draw);
