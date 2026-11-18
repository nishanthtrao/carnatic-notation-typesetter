import { describe, expect, test } from 'vitest';
import { checkCycles } from '../src/recognition/cycles';
import { checkReply } from '../src/recognition/recognize';

const head = 'Tala: Adi\nDefaultSpeed: 1\n';

describe('cycle check', () => {
  test('a full Adi cycle passes', () => {
    expect(checkCycles(head + 'S: ; , ( p d n , ) pa m | ga , g | m pa , ||')).toEqual([]);
  });
  test('a short cycle is reported with its line and count', () => {
    const w = checkCycles(head + 'S: s r g m p d n s ||');
    expect(w).toHaveLength(1);
    expect(w[0].line).toBe(3);
    expect(w[0].message).toMatch(/cycle 1 has 8 matras; Adi at DefaultSpeed 1 needs 16/);
  });
  test('dheerga forms and nested speeds count right', () => {
    expect(checkCycles(head + 'S: sA rI gA mA pA dA ( ( s r g m s r g m ) ) ( s r g m ) ||')).toEqual([]);
  });
  test('Rupaka at speed 1 needs 12', () => {
    expect(checkCycles('Tala: Rupaka\nDefaultSpeed: 1\nS: sA ; r g m p d n s r ||')).toEqual([]);
    expect(checkCycles('Tala: Rupaka\nDefaultSpeed: 1\nS: sA ; r g m p d n ||')[0].message).toMatch(/has 10 matras; Rupaka at DefaultSpeed 1 needs 12/);
  });
  test('no check without ||, in Manual tala, or without DefaultSpeed', () => {
    expect(checkCycles(head + 'S: s r g')).toEqual([]);
    expect(checkCycles('Tala: Manual\nDefaultSpeed: 1\nS: s r g ||')).toEqual([]);
    expect(checkCycles('Tala: Adi\nS: s r g ||')).toEqual([]);
  });
  test('a pasted reply gets cycle problems with the typesetter warnings', () => {
    const r = checkReply('```\n' + head + 'S: s r g m ||\n```\n- none');
    expect(r.warnings.map((w) => w.message).join()).toMatch(/needs 16/);
  });
});
