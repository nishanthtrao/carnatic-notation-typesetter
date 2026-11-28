/*
 * One-glance explanations of each directive, shown when the pointer rests
 * on (or a finger taps) a directive's name in the editor.
 * SPDX-License-Identifier: GPL-2.0-only
 */
import { DIRECTIVES } from './directives';

const TIPS: Record<string, string> = {
  Title: 'Names the saved file and the print header. To print the song’s name on the page, use Heading.',
  Heading: 'A line of text: the song’s name, a section name such as pallavi, or a caption. After the quotes: bold, italic, left, center, right, a size (14), english to keep roman letters. Heading: "" leaves a blank line.',
  Section: 'A heading for a part of the song: Section: pallavi. Bold and on the left, with a little space above, in the Language script; takes the same options as Heading (size, italic, center…).',
  Text: 'A plain line of text, such as a note: Text: "(repeat pallavi)". In the Language script; after the quotes it takes the options of Heading (size, bold, italic, center, a colour…).',
  Raga: 'The raga’s name, printed with the song details in the Language script. Write it after Language.',
  Arohana: "The scale going up, as swaras: s r2 g3 m1 p d2 n3 s'. Printed under the raga.",
  Avarohana: "The scale coming down, as swaras: s' n3 d2 p m1 g3 r2 s. Printed under the raga.",
  Composer: 'The composer’s name, printed with the song details in the Language script.',
  SongInfo: 'Where the song details go. Composer, Raga and Tala each take Left, Center or Right; Raga also takes Lines, TwoLines or OneLine. Size 9 sets their text size.',
  S: 'One written line of swaras. | between angas, || at the end of each cycle, ( ) for faster swaras, , and ; for pauses. A "label" in quotes may come first.',
  L: 'Lyrics for the S: line above: one entry per swara and pause. A syllable starts under its swara; . holds it on, _ leaves a spot empty.',
  SmartLyricMode: 'From here on, pauses (, ;) in the S: line need no entry in the L: line.',
  Tala: 'The tala: Adi, Rupaka, MisraCapu, KhandaCapu, a suladi tala such as Khanda_Ata, or Manual for none. Every cycle is checked against it. Add ,Show to print it with the song details.',
  DefaultSpeed: 'How many swaras fill one beat when they are not in ( ): 0 = one, 1 = two, 2 = four.',
  AvartanamsPerLine: 'How many tala cycles go on each line of the page: 1 to 8, or Default for the tala’s usual number.',
  Gati: 'Changes the nadai from this line on: tisra (3), catusra (4), khanda (5), misra (7) or sankirna (9).',
  SpeedMarks: 'Draws the speed lines of ( ) groups above or below the swaras.',
  PhraseEnds: 'How phrase ends (p-) look: Hide (default), Show, Handle or HandleThick. A number after the comma sets the gap; it is 5 unless given, and 0 removes it.',
  Language: 'The script the page is printed in: English, Diacritics, Sanskrit, Telugu, Kannada, Malayalam or Tamil. You still type in roman letters.',
  LanguageFont: 'The lettering for a script, or All: Serif, Sans, Rounded, Handwritten, or a font installed on this device. LanguageFont: Tamil,Rounded',
  Layout: 'The usual speed and spacing for the kind of song: krithi, varnam or gitam. Add ,compact or ,fullwidth.',
  Spacing: 'Room between the swaras from here on: Tight, Normal, Wide, or a percentage from 40 to 250.',
  Grouping: 'On leaves small gaps between the beats inside a bar (useful for capu talas, gitams and varnams); Off closes them.',
  SongBreak: 'Ends the line, leaves a full blank line and starts the tala cycle again. Write it twice for a bigger gap.',
  LineBreak: 'Starts a new line here; the tala keeps counting. In the middle of a cycle, the next line finishes it.',
  Pagebreak: 'Starts a new page when printing.',
  Orientation: 'Portrait or Landscape, then the margins: left, top, right, bottom (right = left and bottom = top unless given). Orientation: Portrait,25.4mm',
  SwaraPrefs: 'Size and colour of the swaras from here on: SwaraPrefs: 13,darkblue',
  LyricPrefs: 'Size and colour of the lyrics from here on: LyricPrefs: 12,darkgreen',
  GamakaPrefs: 'Size and colour of gamaka marks and words above swaras: GamakaPrefs: 10,gray',
  HeadingPrefs: 'Size and colour of headings from here on: HeadingPrefs: 14,maroon',
};

const BY_LOWER = new Map(DIRECTIVES.map((d) => [d.name.toLowerCase(), d.name]));

export interface DirectiveTip {
  name: string;
  text: string;
  /** where the name starts and ends on its line (columns) */
  from: number;
  to: number;
}

/** The directive named at the start of `line`, if `col` falls on its name. */
export function tipAt(line: string, col: number): DirectiveTip | null {
  const m = line.match(/^(\s*)([A-Za-z]+)\s*(:|$)/);
  if (!m) return null;
  const name = BY_LOWER.get(m[2].toLowerCase());
  if (!name || !TIPS[name]) return null;
  const from = m[1].length;
  const to = from + m[2].length;
  if (col < from || col > to) return null;
  return { name, text: TIPS[name], from, to };
}

export const tipNames = () => Object.keys(TIPS);
