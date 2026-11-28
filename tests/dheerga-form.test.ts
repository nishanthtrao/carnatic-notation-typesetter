import { describe, expect, test } from 'vitest';
import { convertPasted } from '../src/lib/paste-convert';
import { SYSTEM_PROMPT } from '../src/recognition/prompt';
import { parse } from '../src/engine';

const LONG_OLD = /(^|\s|\()(sa|ri|ga|ma|pa|da|dha|ni|[SRGMPDN])(?=[\s,)'`|]|$)/;

describe('long swaras are written sA rI gA mA pA dA nI', () => {
  test('in the AI instructions’ examples', () => {
    const sLines = [...SYSTEM_PROMPT.matchAll(/^S: (?:"[^"]*" )?(.*)$/gm)].map((m) => m[1]);
    expect(sLines.length).toBeGreaterThan(3);
    for (const line of sLines) expect(line).not.toMatch(LONG_OLD);
  });
  test('when swaras are pasted in an Indian script', () => {
    expect(convertPasted('S: ಸಾ , ನಿ ದ | ಪ ಮ ಗಾ ರಿ ||', false).text).toBe('S: sA , n d | p m gA r ||');
    expect(convertPasted('S: सा , नी ध | पा म ग री ||', false).text).toBe('S: sA , nI d | pA m g rI ||');
    expect(convertPasted('S: சா , நி த ||', false).text).toBe('S: sA , n d ||');
  });
  test('and the typesetter reads them as long', () => {
    const doc = parse("Tala: Manual\nS: sA rI2 gA' mA pA dA` nI");
    const staff = doc.blocks.find((b) => b.type === 'staff');
    const evs = staff && staff.type === 'staff' ? staff.rows.flatMap((r) => r.events) : [];
    expect(evs.map((e) => e.long)).toEqual([true, true, true, true, true, true, true]);
    expect(doc.warnings).toEqual([]);
  });
});
