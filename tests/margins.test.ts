import { describe, expect, test } from 'vitest';
import { marginShare, pageRule, parse, parseMargin } from '../src/engine';

describe('reading a margin', () => {
  test.each([
    ['15mm', '15mm', 15], ['1.5 cm', '1.5cm', 15], ['0.5in', '0.5in', 12.7], ['.5in', '.5in', 12.7], ['1"', '1in', 25.4], ['2 inches', '2in', 50.8],
  ])('%s', (text, css, mm) => {
    const m = parseMargin(text)!;
    expect(m.mm).toBeCloseTo(mm, 5);
    expect(parseMargin(m.css)!.mm).toBeCloseTo(mm, 5);
    expect(m.css.replace(/^\./, '0.')).toBe(css.replace(/^\./, '0.'));
  });
  test.each(['15', 'wide', '5px', '-1in'])('%s is not a margin', (text) => expect(parseMargin(text)).toBeNull());
});

describe('Margin directive', () => {
  test('sets the printed page margin', () => {
    expect(pageRule(parse('Margin: 20mm\nS: s').page)).toBe('@page { size: A4 portrait; margin: 20mm; }');
  });
  test('default is 12mm', () => {
    expect(pageRule(parse('S: s').page)).toContain('margin: 12mm');
  });
  test('the original Orientation form still works, and takes mm too', () => {
    expect(parse('Orientation: Landscape,0.5in').page).toMatchObject({ orientation: 'landscape', margin: '0.5in' });
    expect(parse('Orientation: Portrait, 25mm').page.margin).toBe('25mm');
  });
  test('".5in" is half an inch, not five', () => {
    expect(parseMargin(parse('Orientation: Portrait,.5in').page.margin!)!.mm).toBeCloseTo(12.7, 5);
  });
  test('no unit, or too wide, is reported and ignored', () => {
    const a = parse('Margin: 15');
    expect(a.warnings[0].message).toMatch(/needs a number and a unit/);
    expect(a.page.margin).toBeUndefined();
    expect(parse('Margin: 4in').warnings[0].message).toMatch(/too wide/);
  });
});

describe('the margin on screen', () => {
  test('is the same share of the page width as on paper', () => {
    expect(marginShare(parse('S: s').page)).toBeCloseTo(12 / 210, 5);
    expect(marginShare(parse('Margin: 1in\nOrientation: Landscape').page)).toBeCloseTo(25.4 / 297, 5);
    expect(marginShare(parse('PageSize: Letter\nMargin: 0.5in').page)).toBeCloseTo(12.7 / 215.9, 5);
  });
});
