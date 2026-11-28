import { describe, expect, test } from 'vitest';
import { marginShare, pageRule, parse, parseMargin, parseMargins, writeMargins, type Margins } from '../src/engine';

describe('reading a margin', () => {
  test.each([['15mm', 15], ['1.5 cm', 15], ['0.5in', 12.7], ['.5in', 12.7], ['1"', 25.4], ['2 inches', 50.8]])('%s', (text, mm) => {
    const m = parseMargin(text)!;
    expect(m.mm).toBeCloseTo(mm, 5);
    expect(parseMargin(m.css)!.mm).toBeCloseTo(mm, 5);
  });
  test.each(['15', 'wide', '5px', '-1in'])('%s is not a margin', (text) => expect(parseMargin(text)).toBeNull());
});

const m = (text: string) => parse(text + '\nS: s').page.margins;
const all = (v: string): Margins => ({ left: v, top: v, right: v, bottom: v });

describe('margins after the orientation: left, top, right, bottom', () => {
  test('one value is every side, as on the old site', () => {
    expect(m('Orientation: Landscape,0.5in')).toEqual(all('0.5in'));
    expect(m('Orientation: Portrait, 25mm')).toEqual(all('25mm'));
  });
  test('left and top; right follows left and bottom follows top', () => {
    expect(m('Orientation: Portrait,20mm,15mm')).toEqual({ left: '20mm', top: '15mm', right: '20mm', bottom: '15mm' });
  });
  test('right and bottom can be set on their own', () => {
    expect(m('Orientation: Portrait,20mm,15mm,10mm')).toEqual({ left: '20mm', top: '15mm', right: '10mm', bottom: '15mm' });
    expect(m('Orientation: Portrait,20mm,15mm,10mm,25mm')).toEqual({ left: '20mm', top: '15mm', right: '10mm', bottom: '25mm' });
  });
  test('a part may name its side', () => {
    expect(m('Orientation: Portrait, Top 30mm')).toEqual({ left: '12mm', top: '30mm', right: '12mm', bottom: '30mm' });
    expect(m('Orientation: Portrait, 20mm, Bottom 1in')).toEqual({ left: '20mm', top: '12mm', right: '20mm', bottom: '1in' });
  });
  test('no margins: the default, and the printed page says so', () => {
    expect(m('Orientation: Landscape')).toBeUndefined();
    expect(pageRule(parse('S: s').page)).toBe('@page { size: A4 portrait; margin: 12mm; }');
  });
  test('bad margins warn and change nothing', () => {
    const a = parse('Orientation: Portrait,15');
    expect(a.warnings[0].message).toMatch(/number and a unit/);
    expect(a.page.margins).toBeUndefined();
    expect(parse('Orientation: Portrait,4in').warnings[0].message).toMatch(/too wide/);
    expect(parse('Orientation: Portrait,1mm,2mm,3mm,4mm,5mm').warnings[0].message).toMatch(/at most four/);
    expect(parseMargins(['10mm', 'x'])).toEqual({ error: expect.stringMatching(/unit/) });
  });
  test('the old Margin: line still works for now, with a note saying where it went', () => {
    const a = parse('Orientation: Landscape\nMargin: 20mm\nS: s');
    expect(a.page.margins).toEqual(all('20mm'));
    expect(a.warnings[0].message).toBe('Margin: is now part of Orientation: write Orientation: Landscape,20mm instead');
  });
});

describe('the printed page and the page on screen', () => {
  test('@page lists the margins top, right, bottom, left', () => {
    expect(pageRule(parse('Orientation: Portrait,20mm,15mm').page)).toBe('@page { size: A4 portrait; margin: 15mm 20mm; }');
    expect(pageRule(parse('Orientation: Landscape,20mm,15mm,10mm,25mm').page)).toBe('@page { size: A4 landscape; margin: 15mm 10mm 25mm 20mm; }');
  });
  test('each side as a share of the page width', () => {
    const s = marginShare(parse('Orientation: Portrait,21mm,10.5mm').page);
    expect(s.left).toBeCloseTo(0.1, 5);
    expect(s.top).toBeCloseTo(0.05, 5);
    expect(marginShare(parse('Orientation: Landscape,1in').page).right).toBeCloseTo(25.4 / 297, 5);
    expect(marginShare(parse('PageSize: Letter\nOrientation: Portrait,0.5in').page).bottom).toBeCloseTo(12.7 / 215.9, 5);
  });
});

describe('writing margins back (Assist)', () => {
  test.each([
    [all('12mm'), ''],
    [all('15mm'), '15mm'],
    [{ left: '20mm', top: '15mm', right: '20mm', bottom: '15mm' }, '20mm,15mm'],
    [{ left: '20mm', top: '15mm', right: '10mm', bottom: '15mm' }, '20mm,15mm,10mm'],
    [{ left: '20mm', top: '15mm', right: '20mm', bottom: '25mm' }, '20mm,15mm,20mm,25mm'],
  ] as [Margins, string][])('%o -> "%s"', (margins, text) => {
    expect(writeMargins(margins)).toBe(text);
    if (text) expect(m('Orientation: Portrait,' + text)).toEqual(margins);
  });
});
