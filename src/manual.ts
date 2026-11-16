/*
 * Carnatic Music Notation Typesetter — the manual's live examples and contents
 * SPDX-License-Identifier: GPL-2.0-only
 */
import { parse, render } from './engine';
import { highlight } from './lib/highlight';

// Each example: a card with the input, coloured as in the editor, and the
// page it typesets to.
const sheets = Array.from(document.querySelectorAll<HTMLPreElement>('pre.ex')).map((pre) => {
  const source = pre.textContent || '';
  const card = document.createElement('figure');
  card.className = 'example';
  pre.replaceWith(card);
  const input = document.createElement('span');
  input.className = 'tag';
  input.textContent = 'You type';
  const result = document.createElement('div');
  result.className = 'result';
  const tag = document.createElement('span');
  tag.className = 'tag';
  tag.textContent = 'It typesets as';
  const out = document.createElement('div');
  out.className = 'out';
  result.append(tag, out);
  pre.innerHTML = highlight(source).replace(/\n$/, '');
  card.append(input, pre, result);
  return { source, out };
});
for (const pre of document.querySelectorAll<HTMLPreElement>('pre.plain')) pre.innerHTML = highlight(pre.textContent || '').replace(/\n$/, '');

const draw = () => {
  for (const s of sheets) render(parse(s.source), s.out);
};
draw();
document.fonts?.ready.then(draw);

// Wide tables scroll sideways on a phone instead of squeezing the page.
for (const table of document.querySelectorAll('table.t')) {
  const wrap = document.createElement('div');
  wrap.className = 'table-scroll';
  table.replaceWith(wrap);
  wrap.append(table);
}

// Contents: always open beside the text on a wide screen, folded on a phone;
// the section being read is marked.
const toc = document.querySelector<HTMLDetailsElement>('details.toc');
const wide = window.matchMedia('(min-width: 1040px)');
const fit = () => {
  if (toc) toc.open = wide.matches;
};
fit();
wide.addEventListener('change', fit);
toc?.querySelectorAll('a').forEach((a) =>
  a.addEventListener('click', () => {
    if (!wide.matches && toc) toc.open = false;
  }),
);

const links = new Map<string, HTMLAnchorElement>();
toc?.querySelectorAll<HTMLAnchorElement>('nav a[href^="#"]').forEach((a) => links.set(a.hash.slice(1), a));
const targets = [...links.keys()].map((id) => document.getElementById(id)).filter((el): el is HTMLElement => !!el);
const mark = () => {
  // the last section whose heading is above the top fifth of the window
  let current = targets[0];
  for (const el of targets) if (el.getBoundingClientRect().top < window.innerHeight * 0.2) current = el;
  links.forEach((a, id) => a.classList.toggle('here', id === current?.id));
};
let ticking = false;
window.addEventListener(
  'scroll',
  () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      mark();
    });
  },
  { passive: true },
);
mark();
