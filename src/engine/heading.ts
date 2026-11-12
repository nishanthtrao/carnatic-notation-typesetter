/*
 * Carnatic Music Notation Typesetter — Heading directive
 * SPDX-License-Identifier: GPL-2.0-or-later
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
    else if (SAFE_COLOR.test(c)) style += 'color:' + c + ';';
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
      if (/^https?:\/\//i.test(url)) html += '<img class="cm-img" alt="" src="' + esc(url) + '">';
    } else {
      const tag = TAG[tk.v];
      html += open[tk.v] ? '</' + tag + '>' : '<' + tag + '>';
      open[tk.v] = !open[tk.v];
    }
  }
  for (const k of Object.keys(open)) if (open[k]) html += '</' + TAG[k] + '>';
  return html;
}
