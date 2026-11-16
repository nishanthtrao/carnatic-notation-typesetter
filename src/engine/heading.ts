/*
 * Carnatic Music Notation Typesetter — Heading directive
 * SPDX-License-Identifier: GPL-2.0-only
 *
 * Part of an unofficial rebuild of the Carnatic Music Notation Typesetter
 * created by Arun K (sourceforge.net/projects/cmnt, GPLv2). See NOTICE.md.
 *
 *   Heading: "text",attr,attr,...
 * attrs: a number (point size), bold, italic, underline, left|right|center,
 *        a language (english, diacritics, sanskrit, telugu, tamil, kannada, malayalam,
 *        optionally with :attributes), a #colour, or any other word = font.
 *
 * Text formatting (a subset of the Wiky syntax used by v1.5):
 *   *bold*  _italic_  ^sup^  ~sub~  {c:red}text  {c:=}underlined
 *   [br] line break   ---  horizontal rule   [img:https://...] image
 *   [|cell|cell|\ |cell|cell|]  table (rows separated by "\" + newline)
 */
import type { LangSpec } from './types';
import { parseLangSpec, transliterate } from './translit';

export function esc(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

export const SAFE_COLOR = /^(#[0-9a-f]{3,8}|[a-z]+|rgba?\(\s*[\d.\s,%]+\))$/i;

/** The sheet's text colours on a dark background (see notation.css). */
export const DARK_INK = '#f2f2f7';
export const DARK_LYRIC = '#cfcfd4';

// Named colours too dark to read on a dark sheet (the rest are left alone).
const DARK_NAMED: Record<string, string> = {
  black: '#000', navy: '#000080', darkblue: '#00008b', mediumblue: '#0000cd', blue: '#0000ff', midnightblue: '#191970',
  maroon: '#800000', darkred: '#8b0000', firebrick: '#b22222', brown: '#a52a2a', saddlebrown: '#8b4513', sienna: '#a0522d',
  darkgreen: '#006400', green: '#008000', darkolivegreen: '#556b2f', olive: '#808000', forestgreen: '#228b22',
  teal: '#008080', darkcyan: '#008b8b', darkslategray: '#2f4f4f', darkslategrey: '#2f4f4f', dimgray: '#696969', dimgrey: '#696969',
  gray: '#808080', grey: '#808080', indigo: '#4b0082', purple: '#800080', darkmagenta: '#8b008b', darkviolet: '#9400d3',
  darkslateblue: '#483d8b', rebeccapurple: '#663399', crimson: '#dc143c',
};

/** [r, g, b] (0–255) of a hex, rgb() or dark named colour; null if unknown. */
function rgbOf(color: string): [number, number, number] | null {
  const c = (DARK_NAMED[color.toLowerCase()] || color).trim();
  let m = c.match(/^#([0-9a-f]{3,8})$/i);
  if (m) {
    const h = m[1].length < 6 ? m[1].slice(0, 3).replace(/./g, (x) => x + x) : m[1].slice(0, 6);
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
  }
  m = c.match(/^rgba?\(\s*([\d.]+)(%?)[\s,]+([\d.]+)(%?)[\s,]+([\d.]+)(%?)/i);
  if (m) return [[m[1], m[2]], [m[3], m[4]], [m[5], m[6]]].map(([v, p]) => (p ? parseFloat(v) * 2.55 : parseFloat(v))) as [number, number, number];
  return null;
}

/**
 * A colour the person chose, made readable on a dark sheet too. The sheet
 * uses light-dark(), so in light mode (and in print) the colour is exactly as
 * chosen. On a dark sheet a dark colour is lifted towards white, keeping its
 * hue; a dark grey or black becomes `fallback`, the sheet's own text colour.
 */
export function forDark(color: string, fallback: string): string {
  const rgb = rgbOf(color);
  if (!rgb) return color;
  const lin = rgb.map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  const lum = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  if (lum >= 0.18) return color; // light enough already
  const spread = Math.max(...rgb) - Math.min(...rgb);
  const dark = spread < 40 ? fallback : 'color-mix(in srgb, ' + color + ' 45%, #fff)';
  return 'light-dark(' + color + ', ' + dark + ')';
}

/** Split a comma separated attribute list, keeping rgb(...) together. */
export function splitAttrs(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '(') depth++;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out.filter(Boolean);
}

export interface ParsedHeading {
  text: string;
  size: number | null;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  align: string | null;
  font: string | null;
  lang: LangSpec | null;
  color: string | null;
}

export function parseHeading(value: string): ParsedHeading {
  const v = value.trim();
  let text: string;
  let rest = '';
  const m = v.match(/^"([\s\S]*)"\s*(?:,([\s\S]*))?$/);
  if (m) {
    text = m[1];
    rest = m[2] || '';
  } else {
    text = v; // lenient: unquoted heading text, no attributes
  }
  const h: ParsedHeading = { text, size: null, bold: false, italic: false, underline: false, align: null, font: null, lang: null, color: null };
  for (const a of splitAttrs(rest)) {
    const low = a.toLowerCase();
    const lang = parseLangSpec(a);
    if (/^\d+(\.\d+)?$/.test(a)) h.size = parseFloat(a);
    else if (low === 'bold') h.bold = true;
    else if (low === 'italic') h.italic = true;
    else if (low === 'underline' || low === 'underlined') h.underline = true;
    else if (['left', 'right', 'center', 'centre'].includes(low)) h.align = low === 'centre' ? 'center' : low;
    else if (lang) h.lang = lang;
    else if (SAFE_COLOR.test(a) && /^(#|rgb)/i.test(a)) h.color = a;
    else h.font = a;
  }
  return h;
}

/** Convert formatted heading text to safe HTML, transliterating text runs. */
export function formatText(text: string, lang: LangSpec | null): string {
  let t = text;
  let style = '';
  let mm: RegExpMatchArray | null;
  while ((mm = t.match(/^\{c:([^}]*)\}/))) {
    const c = mm[1].trim();
    if (c === '=') style += 'text-decoration:underline;';
    else if (SAFE_COLOR.test(c)) style += 'color:' + forDark(c, DARK_INK) + ';';
    t = t.slice(mm[0].length);
  }
  if (/^\s*-{3,}\s*$/.test(t)) return '<hr class="cm-hr">';

  const tbl = t.match(/^\s*\[\|([\s\S]*)\|\]\s*$/);
  if (tbl) {
    const rows = ('|' + tbl[1] + '|').split(/\|\s*(?:\\\s*\n|\\n|\n)\s*\|/);
    let html = '<table class="cm-table">';
    for (const row of rows) {
      const cells = row.replace(/^\|/, '').replace(/\|$/, '').split('|');
      html += '<tr>' + cells.map((c) => {
        const lead = /^\s/.test(c);
        const trail = /\s$/.test(c);
        const align = lead && !trail ? 'right' : trail && !lead ? 'left' : 'center';
        return '<td style="text-align:' + align + '">' + inline(c.trim(), lang) + '</td>';
      }).join('') + '</tr>';
    }
    return wrap(html + '</table>', style);
  }
  return wrap(inline(t, lang), style);
}

function wrap(html: string, style: string): string {
  return style ? '<span style="' + style + '">' + html + '</span>' : html;
}

const TAG: Record<string, string> = { '*': 'b', _: 'i', '^': 'sup', '~': 'sub' };

// Inline markup: *b* _i_ ^sup^ ~sub~ [br] [img:url]
function inline(text: string, lang: LangSpec | null): string {
  const tokens: { t: 'text' | 'mark'; v: string }[] = [];
  const re = /(\[br\]|\[img:[^\]]+\]|[*_]|\^(?!n)|~(?![nN]))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) tokens.push({ t: 'text', v: text.slice(last, m.index) });
    tokens.push({ t: 'mark', v: m[1] });
    last = re.lastIndex;
  }
  if (last < text.length) tokens.push({ t: 'text', v: text.slice(last) });

  const open: Record<string, boolean> = {};
  let html = '';
  for (const tk of tokens) {
    if (tk.t === 'text') html += esc(lang ? transliterate(tk.v, lang) : tk.v);
    else if (tk.v === '[br]') html += '<br>';
    else if (tk.v.startsWith('[img:')) {
      const url = tk.v.slice(5, -1).trim();
      // no-referrer: the picture's server is not told which page (or shared song) showed it
      if (/^https?:\/\//i.test(url)) html += '<img class="cm-img" alt="" referrerpolicy="no-referrer" src="' + esc(url) + '">';
    } else {
      const tag = TAG[tk.v];
      html += open[tk.v] ? '</' + tag + '>' : '<' + tag + '>';
      open[tk.v] = !open[tk.v];
    }
  }
  for (const k of Object.keys(open)) if (open[k]) html += '</' + TAG[k] + '>';
  return html;
}
