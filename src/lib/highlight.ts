/*
 * Syntax colours for the notation text, like a code editor's.
 * Returns HTML (escaped) to draw behind the transparent textarea.
 * SPDX-License-Identifier: GPL-2.0-only
 */
import { SWARA_RE } from '../engine';
import { DIRECTIVES, type GroupId } from './directives';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const span = (cls: string, s: string) => (s ? '<span class="hl-' + cls + '">' + esc(s) + '</span>' : '');

/** Directive name (lower case) → its Assist group, plus the engine's aliases. */
const GROUP: Record<string, GroupId> = Object.fromEntries(DIRECTIVES.map((d) => [d.name.toLowerCase(), d.group]));
Object.assign(GROUP, { ragam: 'song', arohanam: 'song', avarohanam: 'song', section: 'song', text: 'song', pagesize: 'layout' });

const SCALE = /^(arohana|arohanam|avarohana|avarohanam)$/;
const PAUSE = /^(,|;|__|_|-|=)(-+)?$/;

/** One token of an S: line (or a scale line). */
function swaraToken(tok: string): string {
  if (tok === '(' || tok === ')') return span('speed', tok);
  if (tok === '|' || tok === '||') return span('bar', tok);
  if (PAUSE.test(tok)) return span('pause', tok);
  const m = tok.match(SWARA_RE);
  if (!m) return span('bad', tok);
  const [, note, variant = '', octave = '', gamaka = '', phrase = ''] = m;
  return span('swara', note + variant + octave) + span('gamaka', gamaka) + span('phrase', phrase);
}

/** The value of an S: line: an optional "label" first, then tokens. */
function swaraValue(v: string): string {
  let out = '';
  let rest = v;
  const label = rest.match(/^(\s*)("[^"]*"?)/);
  if (label) {
    out += esc(label[1]) + span('string', label[2]);
    rest = rest.slice(label[0].length);
  }
  // tokens are whitespace-separated, but a gamaka in brackets may hold spaces
  for (const part of rest.match(/\s+|[^\s(]+\([^)]*\)?\S*|\S+/g) || []) out += /^\s/.test(part) ? part : swaraToken(part);
  return out;
}

/** A lyric line: syllables, with the place-holders . _ - dimmed. */
function lyricValue(v: string): string {
  let out = '';
  for (const part of v.match(/\s+|\S+/g) || []) out += /^\s/.test(part) ? part : /^[._-]+$/.test(part) ? span('pause', part) : span('lyric', part);
  return out;
}

/** Any other directive's value: "strings", numbers, and the words between. */
function plainValue(v: string): string {
  let out = '';
  for (const part of v.match(/"[^"]*"?|-?\d+(?:\.\d+)?(?![A-Za-z])|[,]|[^",\d]+|./g) || []) {
    if (part[0] === '"') out += span('string', part);
    else if (/^-?\d/.test(part)) out += span('number', part);
    else if (part === ',') out += span('punct', part);
    else out += span('value', part);
  }
  return out;
}

function line(text: string): string {
  const t = text.trim();
  if (!t) return esc(text);
  if (/^(#|%|\/\/)/.test(t)) return span('comment', text);
  const m = text.match(/^(\s*)([A-Za-z][A-Za-z0-9_]*)(\s*)(:?)([\s\S]*)$/);
  if (!m) return span('bad', text);
  const [, lead, name, gap, colon, value] = m;
  const key = name.toLowerCase();
  const head = (cls: string) => esc(lead) + span(cls, name) + esc(gap) + span('colon', colon);
  if (key === 's' && colon) return head('s') + swaraValue(value);
  if (key === 'l' && colon) return head('l') + lyricValue(value);
  const group = GROUP[key];
  if (!group) return span('bad', text);
  if (SCALE.test(key)) return head('kw-' + group) + swaraValue(value);
  return head('kw-' + group) + plainValue(value);
}

/**
 * The whole text as highlighted HTML. <!-- … --> comments may span lines and
 * sit anywhere; everything else is coloured line by line.
 */
export function highlight(text: string): string {
  let out = '';
  let i = 0;
  while (i < text.length) {
    const open = text.indexOf('<!--', i);
    const chunk = open < 0 ? text.slice(i) : text.slice(i, open);
    const lines = chunk.split('\n');
    // text right after a comment, on the same line, is the end of that line
    const midLine = i > 0 && text[i - 1] !== '\n';
    out += lines.map((l, k) => (k === 0 && midLine ? esc(l) : line(l))).join('\n');
    if (open < 0) break;
    const close = text.indexOf('-->', open + 4);
    const end = close < 0 ? text.length : close + 3;
    out += span('comment', text.slice(open, end));
    i = end;
  }
  // a trailing newline needs something after it, or the last line has no height
  return out + '\n';
}
