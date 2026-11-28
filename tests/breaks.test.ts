import { describe, expect, test } from 'vitest';
import { parse } from '../src/engine';

const HEAD = 'Tala: Adi\nDefaultSpeed: 1\n';
const CYCLE = "S: s r g m p d n s' | s' n d p | m g r s ||";
const staffs = (text: string) => parse(HEAD + text).blocks.filter((b) => b.type === 'staff');
const rowSwaras = (text: string) =>
  staffs(text).flatMap((s) => (s.type === 'staff' ? s.rows.map((r) => r.events.filter((e) => e.kind === 'swara').length) : []));
const kinds = (text: string) => parse(HEAD + text).blocks.map((b) => b.type);

describe('LineBreak in the usual (automatic) layout', () => {
  test('starts a new line where it is written', () => {
    expect(rowSwaras(['AvartanamsPerLine: 2', CYCLE, 'LineBreak', CYCLE].join('\n'))).toEqual([16, 16]);
  });
  test('the lines after it hold AvartanamsPerLine cycles again, counted from the break', () => {
    expect(rowSwaras(['AvartanamsPerLine: 2', CYCLE, 'LineBreak', CYCLE, CYCLE, CYCLE].join('\n'))).toEqual([16, 32, 16]);
  });
  test('in the middle of a cycle: the next line finishes that cycle', () => {
    const text = ["S: s r g m p d n s' |", 'LineBreak', "S: s' n d p | m g r s ||", CYCLE].join('\n');
    expect(rowSwaras(text)).toEqual([8, 8, 16]);
  });
  test('does nothing before any notation', () => {
    expect(rowSwaras(['LineBreak', CYCLE].join('\n'))).toEqual([16]);
  });
});

describe('SongBreak', () => {
  test('starts a new block with a blank line before it', () => {
    expect(kinds([CYCLE, 'SongBreak', CYCLE].join('\n'))).toEqual(['staff', 'space', 'staff']);
  });
  test('twice: a bigger gap', () => {
    expect(kinds([CYCLE, 'SongBreak', 'SongBreak', CYCLE].join('\n'))).toEqual(['staff', 'space', 'space', 'staff']);
  });
  test('no extra gap before a heading, or at the very end', () => {
    expect(kinds([CYCLE, 'SongBreak', 'Heading: "caraNam"', CYCLE].join('\n'))).toEqual(['staff', 'heading', 'staff']);
    expect(kinds([CYCLE, 'SongBreak'].join('\n'))).toEqual(['staff']);
  });
  test('starts the tala afresh', () => {
    expect(rowSwaras(["S: s r g m p d n s' |", 'SongBreak', CYCLE].join('\n'))).toEqual([8, 16]);
  });
});
