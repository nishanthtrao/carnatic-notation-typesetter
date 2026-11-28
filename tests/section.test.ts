import { describe, expect, test } from 'vitest';
import { parse } from '../src/engine';

const heading = (text: string) => parse(text).blocks.find((b) => b.type === 'heading')!;

describe('Section: a heading for a part of the song', () => {
  test('bold and on the left by default, with the section spacing', () => {
    expect(heading('Section: pallavi')).toMatchObject({ bold: true, align: 'left', section: true, html: 'pallavi' });
  });
  test('follows the Language, like Heading', () => {
    expect(heading('Language: Kannada\nSection: pallavi')).toMatchObject({ lang: 'kannada', html: heading('Language: Kannada\nHeading: "pallavi"').html });
  });
  test('takes the options of Heading, in quotes', () => {
    expect(heading('Section: "caraNam",italic,center,15')).toMatchObject({ html: 'caraNam', bold: true, italic: true, align: 'center', size: 15 });
  });
  test('uses HeadingPrefs', () => {
    expect(heading('HeadingPrefs: 14,maroon\nSection: pallavi')).toMatchObject({ size: 14, color: 'maroon' });
  });
  test('empty: nothing at all (Heading: "" is the blank line)', () => {
    expect(parse('Section: ""\nS: s').blocks.map((b) => b.type)).toEqual(['staff']);
  });
});

describe('Text: a plain line, with the options of Heading', () => {
  test('plain and on the left by default, in the Language script', () => {
    expect(heading('Text: "repeat pallavi"')).toMatchObject({ bold: false, italic: false, align: 'left', html: 'repeat pallavi' });
    expect(heading('Language: Kannada\nText: "pallavi"')).toMatchObject({ lang: 'kannada' });
    expect(heading('Text: repeat pallavi').html).toBe('repeat pallavi'); // quotes are optional without options
  });
  test('takes the options of Heading', () => {
    expect(heading('Text: "(repeat pallavi)",italic,right,10,#336699')).toMatchObject({ italic: true, align: 'right', size: 10, color: '#336699' });
  });
  test('HeadingPrefs leave it alone', () => {
    expect(heading('HeadingPrefs: 16,maroon\nText: "note"')).toMatchObject({ size: null, color: null });
  });
  test('empty: nothing', () => {
    expect(parse('Text: ""\nS: s').blocks.map((b) => b.type)).toEqual(['staff']);
  });
});
