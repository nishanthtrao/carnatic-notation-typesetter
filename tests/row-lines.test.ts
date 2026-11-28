// @vitest-environment jsdom
import { expect, test } from 'vitest';
import { parse, render } from '../src/engine';

const rows = (text: string) => {
  const el = document.createElement('div');
  document.body.append(el);
  render(parse(text), el);
  return [...el.querySelectorAll<HTMLElement>('.cm-row')].map((r) => [r.dataset.from, r.dataset.to].map(Number));
};

test('each typeset row knows the S: lines it came from', () => {
  const text = `Tala: Adi
DefaultSpeed: 1
AvartanamsPerLine: 1
S: s r g m p d n s' | s' n d p | m g r s ||
L: sa ri ga ma pa da ni sa sa ni da pa ma ga ri sa
Heading: "anupallavi"
S: s , r , g , m , | p , d , | n , s' , ||
S: sa ; ; ; | ; ; | ; ; ||`;
  expect(rows(text)).toEqual([[4, 4], [7, 7], [8, 8]]);
});

test('a row made of two S: lines spans both', () => {
  const text = `Tala: Adi
DefaultSpeed: 1
AvartanamsPerLine: 1
S: s r g m p d n s' |
S: s' n d p | m g r s ||`;
  expect(rows(text)).toEqual([[4, 5]]);
});
