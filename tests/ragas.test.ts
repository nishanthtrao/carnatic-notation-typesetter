import { describe, expect, test } from 'vitest';
import { RAGAS } from '../src/lib/ragaData';
import { findRagas, melaName, ragaKey } from '../src/lib/ragas';
import { SWARA_RE } from '../src/engine';

const RG = [[1, 1], [1, 2], [1, 3], [2, 2], [2, 3], [3, 3]];
const melaScale = (n: number) => {
  const k = (n - 1) % 36;
  const [r, g] = RG[Math.floor(k / 6)];
  const [d, nn] = RG[k % 6];
  return `s r${r} g${g} m${n <= 36 ? 1 : 2} p d${d} n${nn} s'`;
};
// ragas that really use a note outside their melakarta (bhashanga), or a Hindustani raga filed under one
const BORROWS = new Set(['Āhiri', 'Ghanta', 'Sindhubhairavi', 'Srimati', 'Sowrāshtram', 'Ānandabhairavi', 'Bhairavi', 'Brindāvana Sāranga', 'Brindāvani',
  'Jog', 'Kāpi', 'Miyān ki Malhār', 'Mukhāri', 'Peelu', 'Desh', 'Dwijāvanthi', 'Kāmbhoji', 'Khamāj', 'Tilang', 'Bihag', 'Yamuna Kalyāni']);

describe('raga data', () => {
  test('about 840 ragas, every scale written in valid swaras', () => {
    expect(RAGAS.length).toBeGreaterThan(800);
    for (const [name, , aro, ava] of RAGAS)
      for (const t of (aro + ' ' + ava).split(' ')) expect(SWARA_RE.test(t), name + ': ' + t).toBe(true);
  });
  test('all 72 melakartas, each with the scale its number gives', () => {
    const melas = RAGAS.filter((r) => r[5] === 1);
    expect(new Set(melas.map((r) => r[4])).size).toBe(72);
    for (const [name, , aro, ava, n] of melas) {
      expect(aro, name).toBe(melaScale(n));
      expect(ava, name).toBe(melaScale(n).split(' ').reverse().join(' '));
    }
  });
  test('a janya raga uses only its melakarta’s notes, unless it is known to borrow one', () => {
    for (const [name, , aro, ava, n, kind] of RAGAS) {
      if (kind === 1 || BORROWS.has(name)) continue;
      const allowed = new Set(melaScale(n).split(' ').map((t) => t.replace(/['`]/g, '')));
      for (const t of (aro + ' ' + ava).split(' ')) expect(allowed.has(t.replace(/['`]/g, '')), name + ' (' + n + '): ' + t).toBe(true);
    }
  });
  test('typed names have no stray capitals at the start of a word (a capital is another sound)', () => {
    for (const [name, typed] of RAGAS) for (const w of typed.split(' ')) expect(/^[A-Z][a-z]/.test(w) && !/^[AIUEOSLNTD]/.test(w), name + ': ' + typed).toBe(false);
  });
});

describe('finding a raga', () => {
  test.each([
    ['shankarabharanam', 'Śankarābharaṇam'], ['sankarabharanam', 'Śankarābharaṇam'], ['thodi', 'Tōḍi'], ['kalyaani', 'Kalyāṇi'],
    ['kamboji', 'Kāmbhoji'], ['madhyamavati', 'Madhyamāvathi'], ['hamsadh', 'Hamsadhwani'], ['shanmukha', 'Ṣaṇmukhapriyā'],
  ])('%s finds %s first', (q, name) => expect(findRagas(q)[0].name).toBe(name));
  test('a melakarta number lists it first, then its janya ragas', () => {
    const r = findRagas('29');
    expect(r[0].melakarta).toBe(true);
    expect(r.every((x) => x.mela === 29)).toBe(true);
    expect(r.length).toBeGreaterThan(20);
  });
  test('the best-known ragas when nothing is typed', () => {
    expect(findRagas('').slice(0, 3).map((r) => r.name)).toEqual(['Śankarābharaṇam', 'Kalyāṇi', 'Tōḍi']);
  });
  test('melakarta names and the spelling key', () => {
    expect(melaName(65)).toBe('Mechakalyāni');
    expect(ragaKey('Śaṅkarābharaṇam')).toBe(ragaKey('shankarabharanam'));
  });
});
