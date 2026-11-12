// Engine tests — run with: npm test
// SPDX-License-Identifier: GPL-2.0-or-later
import { readFileSync } from 'node:fs';
import { test, expect } from 'vitest';
import * as talas from '../src/engine/talas';
import * as translit from '../src/engine/translit';
import * as heading from '../src/engine/heading';
import * as parser from '../src/engine/parser';
import { examples, newSongTemplate } from '../src/engine/examples';
import { parseFontStyle, styleFamilies } from '../src/engine/fonts';
import type { HeadingBlock, NotationDoc, Row, StaffBlock, Tala } from '../src/engine/types';

const assert = {
  equal: (a: unknown, b: unknown, msg?: string) => expect(a, msg).toBe(b),
  deepEqual: (a: unknown, b: unknown, msg?: string) => expect(a, msg).toEqual(b),
  ok: (a: unknown, msg?: string) => expect(a, msg).toBeTruthy(),
  match: (a: string, re: RegExp) => expect(a).toMatch(re),
};
const staffs = (doc: NotationDoc) => doc.blocks.filter((b): b is StaffBlock => b.type === 'staff');
const row = (doc: NotationDoc, s = 0, r = 0): Row => staffs(doc)[s].rows[r];
const show = (r: Row) => r.events.map((e) => (e.display || e.text || '=') + '@' + +e.t.toFixed(3)).join(' ');
const example = (id: string) => examples.find((e) => e.id === id)!.text;

test('talas from the manual', () => {
  assert.deepEqual((talas.parseTala as (s: string) => Tala)('Adi').segments, [4, 2, 2]);
  assert.equal((talas.parseTala as (s: string) => Tala)('Tisra_Adi').gati, 'tisra');
  assert.deepEqual((talas.parseTala as (s: string) => Tala)('Adi2Kalai').segments, [8, 4, 4]);
  assert.deepEqual((talas.parseTala as (s: string) => Tala)('rupaka').segments, [2, 4]);
  assert.deepEqual((talas.parseTala as (s: string) => Tala)('rUpakacApu').segments, [1, 1, 1]);
  assert.equal((talas.parseTala as (s: string) => Tala)('KhandaCapu').perRow, 4);
  assert.equal((talas.parseTala as (s: string) => Tala)('KhandaCapu2').perRow, 2);
  assert.equal((talas.parseTala as (s: string) => Tala)('MisraCapu').beats, 3.5);
  assert.equal((talas.parseTala as (s: string) => Tala)('Dhruva2').rowsPerAvarta, 2);
  assert.deepEqual((talas.parseTala as (s: string) => Tala)('Khanda_Ata').segments, [5, 5, 2, 2]);
  assert.deepEqual((talas.parseTala as (s: string) => Tala)('Jhampa').segments, [7, 1, 2]);
  assert.equal((talas.parseTala as (s: string) => Tala)('Sankirna_Ata').beats, 22);
  assert.equal((talas.parseTala as (s: string) => Tala)('Adi,Manual').manual, 1);
  assert.equal((talas.parseTala as (s: string) => Tala)('Adi,Manual,InlineTalaMarkers').inlineMarkers, true);
  assert.equal((talas.parseTala as (s: string) => Tala)('Manual').manual, 2);
  assert.ok('error' in talas.parseTala('Bogus'));
  for (const t of talas.listTalas()) assert.ok(!('error' in talas.parseTala(t.spec)), t.spec);
});

test('transliteration (Unified scheme)', () => {
  assert.equal(translit.transliterate('SrI', 'sanskrit'), 'श्री');
  assert.equal(translit.transliterate('rAma', 'telugu'), 'రామ');
  assert.equal(translit.transliterate('bRova bhAramA', 'diacritics'), 'bṛova bhāramā');
  assert.equal(translit.transliterate('ninnE', 'kannada'), 'ನಿನ್ನೇ');
  // Malayalam: chillu letters / anusvara at word ends, unless :nochillu
  assert.equal(translit.transliterate('ninnE', 'malayalam'), 'നിന്നേ');
  assert.equal(translit.transliterate('SrI rAma', 'malayalam'), 'ശ്രീ രാമ');
  assert.equal(translit.transliterate('tyAgarAjan', 'malayalam'), 'ത്യാഗരാജൻ');
  assert.equal(translit.transliterate('avan kaNNan kAr pAl aruL manam', 'malayalam'), 'അവൻ കണ്ണൻ കാർ പാൽ അരുൾ മനം');
  assert.equal(translit.transliterate('avan', 'malayalam:nochillu'), 'അവന്');
  assert.equal(translit.transliterate('kRShNa', 'malayalam'), 'കൃഷ്ണ');
  assert.equal(translit.transliterate('sR.ShTi', 'diacritics'), 'sṛṣṭi');
  assert.equal(translit.transliterate('sa#ngIta', 'telugu'), 'సఙ్గీత');
  // Tamil: qualifiers by default, noqual turns them off
  assert.equal(translit.transliterate('dEvi', 'tamil'), 'தே³வி');
  assert.equal(translit.transliterate('dEvi nIyE tuNai', 'tamil:noqual'), 'தேவி நீயே துணை');
  // Tamil n in lyrics is ன unless written ^n or n2
  assert.equal(translit.transliterate('nO', 'tamil', { lyric: true }), 'னோ');
  assert.equal(translit.transliterate('^nO', 'tamil', { lyric: true }), 'நோ');
  assert.equal(translit.transliterate('n2O', 'tamil', { lyric: true }), 'நோ');
  assert.equal(translit.transliterate('manam nOgi', 'tamil:noqual'), 'மனம் நோகி');
  assert.equal(translit.transliterate('Siva', 'tamil:granthasa'), 'ஶிவ');
  assert.equal(translit.transliterate('as typed', 'english'), 'as typed');
});

test('quick start example lays out exactly like the manual', () => {
  const doc = parser.parse(example('quickstart'));
  assert.deepEqual(doc.warnings, []);
  const r1 = row(doc, 0, 0);
  assert.equal(r1.label, '1)');
  assert.equal(show(r1), ';@0 ,@1 p@1.5 d@1.75 n@2 ,@2.25 pa@2.5 m@3.5 ga@4 ,@5 g@5.5 m@6 pa@6.5 ,@7.5');
  assert.deepEqual(r1.markers.map((m) => m.kind + m.t), ['|4', '|6', '||8']);
  assert.deepEqual(r1.groups, [{ start: 1.5, end: 2.5, depth: 1 }]);
  assert.deepEqual(r1.lyricLines[0].map((l) => l.text), ['brO', 'va', 'bhA', 'ra', 'mA', 'ra', 'ghu', 'rA', ',']);
  const r2 = row(doc, 0, 1);
  assert.equal(r2.label, '2)');
  assert.equal(r2.events[0].gamaka, '~');
  assert.equal(r2.events.find((e) => e.octave === 1)!.note, 's');
});

test('smart lyric mode skips pauses', () => {
  const doc = parser.parse(example('smart'));
  assert.deepEqual(doc.warnings, []);
  assert.deepEqual(row(doc).lyricLines[0].map((l) => l.text + '@' + l.t), [
    'brO@1.5', '.@1.75', 'va@2', 'bhA@2.5', 'ra@3.5', 'mA@4', 'ra@5.5', 'ghu@6', 'rA@6.5',
  ]);
});

test('smart lyric mode marks missing lyrics with ?', () => {
  const doc = parser.parse('Tala: Adi\nSmartLyricMode\nS: s r g m\nL: a b');
  assert.deepEqual(row(doc).lyricLines[0].map((l) => l.text), ['a', 'b', '?', '?']);
  assert.equal(doc.warnings.length, 1);
});

test('default lyric mode needs one entry per swara and pause', () => {
  const doc = parser.parse('Tala: Adi\nS: s , r\nL: a b');
  assert.equal(doc.warnings.length, 1);
  assert.match(doc.warnings[0].message, /2 entries .* has 3/);
});

test('S lines join into one stream laid out by the tala', () => {
  const doc = parser.parse('Tala: Adi\nDefaultSpeed: 1\nS: s r g m p d\nS: n s\' s\' n d p m g r s\nS: s r');
  const rows = staffs(doc)[0].rows;
  assert.equal(rows.length, 2);
  assert.equal(rows[0].events.length, 16);
  assert.equal(rows[1].events.length, 2);
  assert.deepEqual(rows[1].markers, []); // partial avartanam: no markers yet
});

test('headings break the stream; SongBreak too', () => {
  const doc = parser.parse('Tala: Adi\nS: s r\nHeading: "x"\nS: g m\nSongBreak\nS: p d');
  assert.equal(staffs(doc).length, 3);
});

test('dhirga swaras, pauses, = and empty swaras', () => {
  const doc = parser.parse('Tala: Adi\nDefaultSpeed: 1\nS: sa ri ; , _ __ = s');
  assert.equal(show(row(doc)), 'sa@0 ri@1 ;@2 ,@3 _@3.5 __@4 =@5 s@6');
});

test('DefaultSpeed and layouts', () => {
  const g = parser.parse('Layout: gitam\nTala: Rupaka\nS: m p d s\' s\' r\'');
  const rg = row(g);
  assert.equal(rg.events[1].t, 1); // one swara per akshara
  assert.ok(rg.gaps.some((x) => x.size === 'akshara'));
  const d0 = parser.parse('DefaultSpeed: 0\nLayout: varnam\nTala: Adi\nS: s r ( s r ( g m p d ) ) r g ( r g ( m p d n ) )');
  const r0 = row(d0);
  assert.equal(r0.events.length, 16);
  assert.equal(staffs(d0)[0].rows.length, 1);
  assert.equal(r0.groups.filter((x) => x.depth === 2).length, 2);
});

test('gati changes switch speed implicitly', () => {
  const doc = parser.parse(example('speeds'));
  assert.deepEqual(doc.warnings, []);
  const last = staffs(doc).pop()!;
  assert.equal(last.rows.length, 2);
  // tisra at speed 1 = 3 swaras per akshara
  const r0 = last.rows[0];
  const tisra = r0.events.filter((e) => e.t >= 4 - 1e-6);
  assert.ok(Math.abs(tisra[1].t - tisra[0].t - 1 / 3) < 1e-6);
});

test('capu talas pack several avartanams per row without inner bars', () => {
  const doc = parser.parse('Tala: MisraCapu\nDefaultSpeed: 1\nS: s , n d m d n d , m g m d m');
  const r = row(doc);
  assert.equal(staffs(doc)[0].rows.length, 1);
  assert.deepEqual(r.markers.map((m) => m.kind), ['||', '||']);
  assert.equal(r.gaps.filter((g) => g.size === 'anga').length, 4);
});

test('manual mode 2 keeps the markers you write', () => {
  const doc = parser.parse('Tala: Manual\nS: s r g | m p ||');
  assert.deepEqual(row(doc).markers.map((m) => m.kind + m.t), ['|1.5', '||2.5']);
});

test('manual mode 1 with inline markers and LineBreak', () => {
  const doc = parser.parse(example('manual'));
  assert.deepEqual(doc.warnings, []);
  const rows = staffs(doc)[0].rows;
  assert.ok(rows.length >= 2);
  assert.equal(rows[0].inline[0].kind, '||');
  assert.ok(rows[0].inline.some((m) => m.kind === '*'));
  assert.deepEqual(rows[0].markers, []);
});

test('phrase ends break speed lines when shown', () => {
  const doc = parser.parse('PhraseEnds: Show,10\nTala: Adi\nS: ( s\' n\' d p- n d p m ) pa');
  const r = row(doc);
  assert.equal(r.groups.length, 2);
  assert.equal(r.gaps.length, 1);
});

test('headings: quoted text, attributes, wiki formatting, languages', () => {
  const h = heading.parseHeading('"rAga: AbhOgi",Verdana,12,bold,italic,center');
  assert.deepEqual([h.text, h.font, h.size, h.bold, h.italic, h.align], ['rAga: AbhOgi', 'Verdana', 12, true, true, 'center']);
  assert.equal(heading.formatText('*b* _i_ x^2^ h~2~o', null), '<b>b</b> <i>i</i> x<sup>2</sup> h<sub>2</sub>o');
  assert.equal(heading.formatText('---', null), '<hr class="cm-hr">');
  assert.match(heading.formatText('{c:red}hi', null), /color:red/);
  assert.match(heading.formatText('[|*P:*|nAda|\\\n||line two|]', null), /<table/);
  const doc = parser.parse('Language: telugu\nHeading: "rAma",center\nHeading: "rAma",english');
  assert.equal((doc.blocks[0] as HeadingBlock).html, 'రామ');
  assert.equal((doc.blocks[1] as HeadingBlock).html, 'rAma');
  assert.equal(parser.parse('Heading: ""').blocks[0].type, 'space');
});

test('lenient tokens: attached commas and parens, joined swaras', () => {
  const doc = parser.parse('Tala: Adi\nS: (p d) s, srgm');
  assert.deepEqual(doc.warnings, []);
  assert.equal(row(doc).events.length, 8);
});

test('mistakes produce line-numbered warnings', () => {
  const doc = parser.parse('L: orphan\nTala: Adi\nS: s x r\nFoo: bar\nS: ( s r');
  const lines = doc.warnings.map((w) => w.line);
  assert.deepEqual(lines, [1, 3, 4, 5]);
});

test('alignment map for the Align command', () => {
  const a = parser.alignmentMap('"1)" s , ( r g ) m', ['x _ y z w'], false);
  assert.equal(a.label, '1)');
  assert.deepEqual(a.maps[0], ['x', '_', null, 'y', 'z', null, 'w']);
});

test('every bundled example parses without warnings', () => {
  for (const ex of examples) assert.deepEqual(parser.parse(ex.text).warnings, [], ex.title);
  assert.deepEqual(parser.parse(newSongTemplate).warnings, []);
});

test('every live example in docs/manual.html parses without warnings', () => {
  const html = readFileSync(new URL('../docs/manual.html', import.meta.url), 'utf8');
  const decode = (x: string) => x.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  const blocks = [...html.matchAll(/<pre class="ex">([\s\S]*?)<\/pre>/g)].map((m) => decode(m[1]));
  assert.ok(blocks.length >= 15, 'found ' + blocks.length);
  for (const b of blocks) assert.deepEqual(parser.parse(b).warnings, [], b.slice(0, 60));
});

test('Layout: …,Compact keeps rows at their natural width', () => {
  const src = 'Tala: Adi\nS: s r g m p d n s\' | s r | g m ||\nS: s , , , r , , , | s r | g m ||\n';
  const rowsOf = (text: string) => (parser.parse(text).blocks.find((b) => b.type === 'staff') as StaffBlock).rows;
  expect(rowsOf(src).every((r) => r.align)).toBe(true);
  const compact = rowsOf('Layout: krithi,Compact\n' + src);
  expect(compact.every((r) => !r.align && r.intervals.every((iv) => iv.key === null))).toBe(true);
  const both = parser.parse('Layout: krithi,Compact,FullWidth\n' + src).blocks.find((b) => b.type === 'staff') as StaffBlock;
  expect(both.compact && both.fullWidth).toBe(true);
});

test('LanguageFont: bundled styles and All', () => {
  const d = parser.parse('LanguageFont: All,Sans\nLanguageFont: Tamil,Rounded\nS: s r g m ||\n');
  expect(d.warnings).toHaveLength(0);
  expect(d.langFonts.english).toBe('Sans');
  expect(d.langFonts.malayalam).toBe('Sans');
  expect(d.langFonts.tamil).toBe('Rounded');
  expect(styleFamilies('rounded', 'tamil')).toBe("'Baloo Thambi 2', 'Nunito'");
  expect(styleFamilies('sans', 'iast')).toBe("'Anek Latin'");
  expect(styleFamilies('serif', 'malayalam')).toBe("'Noto Serif Malayalam', 'Noto Serif'");
  expect(parseFontStyle(' rounded ')).toBe('rounded');
  expect(parseFontStyle('Latha')).toBeNull();
  expect(parser.parse('LanguageFont: Klingon,Sans\n').warnings).toHaveLength(1);
});
