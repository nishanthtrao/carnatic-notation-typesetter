/*
 * Carnatic Music Notation Typesetter — input parser
 * SPDX-License-Identifier: GPL-2.0-or-later
 *
 * Implements the input format of Carnatic Music Notation Typesetter v1.5
 * Beta (see docs/manual.html), plus a few extensions marked as such there.
 */
import { formatText, parseHeading, SAFE_COLOR, splitAttrs } from './heading';
import { layoutSegment, type Segment } from './layout';
import { GATIS, isTalaError, parseGati, parseTala } from './talas';
import { LANGS, normaliseLang, parseLangSpec, transliterate } from './translit';
import type { Block, JatiName, Lang, LangSpec, MetaItem, NotationDoc, NoteEvent, PhraseEnds, Prefs, Tala } from './types';

// swara + optional variant (extension) + stayi + gamaka + phrase end
export const SWARA_RE = /^(sa|ri|ga|ma|pa|dha|da|ni|[srgmpdn]|[SRGMPDN])([1-3])?(['`]*)(~~|~|\^|\/\/|\/|\\\\|\\|\([^)]*\))?(-)?$/;
const PAUSE_RE = /^(,|;|__|_|-)(-)?$/;
const PAUSE_MATRAS: Record<string, number> = { ',': 1, ';': 2, _: 1, __: 2, '-': 1 };
const LYRIC_PAUSE_OK: Record<string, boolean> = { '-': true, '.': true, _: true };

const META_LABELS: Record<string, string> = {
  raga: 'Rāgam', ragam: 'Rāgam', composer: 'Composer',
  arohana: 'Ārōhaṇam', arohanam: 'Ārōhaṇam', avarohana: 'Avarōhaṇam', avarohanam: 'Avarōhaṇam',
};
const SWARA_META = new Set(['arohana', 'arohanam', 'avarohana', 'avarohanam']);

/** Swaras per akshara for a default speed (0–2) and gati. */
export function perAkshara(speed: number, gati: JatiName | null): number {
  const g = (gati && GATIS[gati]) || 4;
  if (gati === 'catusra' || !gati) return Math.pow(2, speed);
  return speed === 0 ? g / 2 : g * Math.pow(2, speed - 1);
}

function parsePrefs(value: string, target: Prefs): Prefs {
  for (const a of splitAttrs(value)) {
    if (/^\d+(\.\d+)?$/.test(a)) target.size = parseFloat(a);
    else if (SAFE_COLOR.test(a)) target.color = a;
  }
  return target;
}

export type SwaraToken = string | { bad: string };

/** Split a raw swara-line token into simpler tokens (lenient tokenizer). */
function expandToken(tok: string, out: SwaraToken[]): void {
  if (!tok) return;
  if (['|', '||', '(', ')', '=', '=-'].includes(tok)) {
    out.push(tok);
    return;
  }
  if (SWARA_RE.test(tok) || PAUSE_RE.test(tok)) {
    out.push(tok);
    return;
  }
  if (/^[,;]{2,}$/.test(tok)) {
    tok.split('').forEach((c) => out.push(c));
    return;
  }
  if (/^\|+$/.test(tok)) {
    out.push(tok.length >= 2 ? '||' : '|');
    return;
  }
  // Extension: joined plain swaras "srgm" = s r g m
  if (/^[srgmpdn]{2,}$/.test(tok)) {
    tok.split('').forEach((c) => out.push(c));
    return;
  }
  if (tok[0] === '(' || tok[0] === '|') {
    out.push(tok[0]);
    expandToken(tok.slice(1), out);
    return;
  }
  const tail = tok.match(/^(.*?)(\)|\|+|[,;]+)$/);
  if (tail && tail[1]) {
    const before = out.length;
    expandToken(tail[1], out);
    if (out.length > before && typeof out[out.length - 1] === 'string') {
      expandToken(tail[2], out);
      return;
    }
    out.length = before;
  }
  out.push({ bad: tok });
}

export function tokenizeSwaraLine(value: string): { label: string | null; tokens: SwaraToken[] } {
  let label: string | null = null;
  let rest = value.trim();
  const lm = rest.match(/^"([^"]*)"\s*/);
  if (lm) {
    label = lm[1];
    rest = rest.slice(lm[0].length);
  }
  const out: SwaraToken[] = [];
  for (const raw of rest.split(/\s+/)) expandToken(raw, out);
  return { label, tokens: out };
}

const DHIRGHA: Record<string, string> = { s: 'sa', r: 'ri', g: 'ga', m: 'ma', p: 'pa', d: 'da', n: 'ni' };

/** Details of a swara token matched by SWARA_RE. */
export function swaraInfo(m: RegExpMatchArray) {
  const name = m[1];
  const isUpper = /^[SRGMPDN]$/.test(name);
  const letter = name[0].toLowerCase();
  return {
    note: letter,
    long: name.length > 1 || isUpper,
    display: isUpper ? DHIRGHA[letter] : name,
    variant: m[2] || null,
    octave: (m[3].match(/'/g) || []).length - (m[3].match(/`/g) || []).length,
    gamaka: m[4] || null,
    phraseEnd: !!m[5],
  };
}

interface State {
  layout: 'krithi' | 'varnam' | 'gitam';
  fullWidth: boolean;
  compact: boolean;
  tala: Tala | null;
  speed: number;
  songSpeed: number;
  explicitSpeed: boolean;
  gati: JatiName;
  songGati: JatiName;
  lang: LangSpec;
  speedMarks: 'above' | 'below';
  phraseEnds: PhraseEnds;
  smartLyric: boolean;
  perRow: number | null;
  swaraPrefs: Prefs;
  lyricPrefs: Prefs;
  headingPrefs: Prefs;
  gamakaPrefs: Prefs;
}

interface SwaraLine {
  entries: NoteEvent[];
  lyricCount: number;
}

/** Parse the text input into a document model. */
export function parse(input: string): NotationDoc {
  const warnings: NotationDoc['warnings'] = [];
  const warn = (line: number, message: string) => warnings.push({ line, message });
  const doc: NotationDoc = { title: '', page: { orientation: 'portrait', size: 'A4' }, langFonts: {}, blocks: [], warnings };

  const st: State = {
    layout: 'krithi',
    fullWidth: false,
    compact: false,
    tala: null,
    speed: 1,
    songSpeed: 1,
    explicitSpeed: false,
    gati: 'catusra',
    songGati: 'catusra',
    lang: { lang: 'english', opts: {} },
    speedMarks: 'above',
    phraseEnds: { style: 'hide', space: 0 },
    smartLyric: false,
    perRow: null,
    swaraPrefs: {},
    lyricPrefs: {},
    headingPrefs: {},
    gamakaPrefs: {},
  };

  let seg: Segment | null = null;
  let lastSwaraLine: SwaraLine | null = null;
  let metaBlock: { type: 'meta'; items: MetaItem[] } | null = null;

  const applySpeedForLayout = () => {
    if (!st.explicitSpeed) st.speed = st.songSpeed = st.layout === 'gitam' ? 0 : 1;
  };

  const openSeg = (): Segment => {
    if (seg) return seg;
    seg = {
      type: 'staff',
      tala: st.tala,
      layout: st.layout,
      fullWidth: st.fullWidth,
      compact: st.compact,
      perRow: st.perRow,
      speedMarks: st.speedMarks,
      phraseEnds: { ...st.phraseEnds },
      prefs: { swara: { ...st.swaraPrefs }, lyric: { ...st.lyricPrefs }, gamaka: { ...st.gamakaPrefs } },
      rows: [],
      line: 0,
      events: [],
      markers: [],
      lineBreaks: [],
      labels: [],
      time: 0,
      groupCounter: 0,
    };
    doc.blocks.push(seg);
    metaBlock = null;
    return seg;
  };

  const closeSeg = () => {
    if (!seg) return;
    const s: Segment = seg;
    layoutSegment(s);
    if (!s.rows.length) doc.blocks.splice(doc.blocks.indexOf(s), 1);
    // keep only the StaffBlock fields in the document
    const clean = s as Partial<Segment>;
    delete clean.events;
    delete clean.markers;
    delete clean.lineBreaks;
    delete clean.labels;
    seg = null;
    lastSwaraLine = null;
  };

  const pushBlock = (b: Block) => {
    closeSeg();
    doc.blocks.push(b);
    if (b.type !== 'meta') metaBlock = null;
  };

  const addMeta = (key: string, val: string) => {
    closeSeg();
    if (!metaBlock) {
      metaBlock = { type: 'meta', items: [] };
      doc.blocks.push(metaBlock);
    }
    const item: MetaItem = { label: META_LABELS[key] || key, value: val };
    if (SWARA_META.has(key)) {
      item.swaras = [];
      for (const t of tokenizeSwaraLine(val).tokens) {
        const m = typeof t === 'string' ? t.match(SWARA_RE) : null;
        if (m) item.swaras.push({ kind: 'swara', t: 0, dur: 0, path: [], lyrics: [], ...swaraInfo(m) });
      }
      item.lang = st.lang;
    }
    metaBlock.items.push(item);
  };

  // ---- read lines, joining "\" continuations ----------------------------
  const rawLines = String(input || '').replace(/\r\n?/g, '\n').split('\n');
  const lines: { no: number; text: string }[] = [];
  for (let i = 0; i < rawLines.length; i++) {
    let text = rawLines[i];
    const start = i;
    while (/\\\s*$/.test(text) && i + 1 < rawLines.length) text = text.replace(/\s*$/, '') + '\n' + rawLines[++i];
    lines.push({ no: start + 1, text });
  }

  // ---- S: -----------------------------------------------------------------
  const handleSwaras = (value: string, no: number) => {
    const s = openSeg();
    if (!s.line) s.line = no;
    const { label, tokens } = tokenizeSwaraLine(value);
    const sline: SwaraLine = { entries: [], lyricCount: 0 };
    if (label !== null) s.labels.push({ t: s.time, text: label });
    const per = () => perAkshara(st.speed, st.gati);
    const pathStack: number[] = [];
    for (const tok of tokens) {
      if (typeof tok === 'object') {
        warn(no, 'Ignored "' + tok.bad + '" — not a swara, pause, ( ) or tala marker');
        continue;
      }
      if (tok === '|' || tok === '||') {
        if (!s.tala || s.tala.manual === 2) s.markers.push({ t: s.time, kind: tok });
        continue;
      }
      if (tok === '(') {
        pathStack.push(++s.groupCounter);
        continue;
      }
      if (tok === ')') {
        if (!pathStack.length) warn(no, 'Unmatched ")"');
        else pathStack.pop();
        continue;
      }
      const factor = Math.pow(0.5, pathStack.length);
      let ev: NoteEvent;
      const sm = tok.match(SWARA_RE);
      if (sm) {
        const info = swaraInfo(sm);
        ev = { kind: 'swara', t: 0, dur: ((info.long ? 2 : 1) * factor) / per(), path: [], lyrics: [], lang: st.lang, ...info };
      } else if (tok === '=' || tok === '=-') {
        ev = { kind: 'same', t: 0, dur: 1, path: [], lyrics: [], phraseEnd: tok === '=-' };
      } else {
        const pm = tok.match(PAUSE_RE)!;
        const p = pm[1];
        ev = {
          kind: p === ',' || p === ';' ? 'karvai' : p === '-' ? 'dash' : 'empty',
          text: p,
          t: 0,
          dur: (PAUSE_MATRAS[p] * factor) / per(),
          path: [],
          lyrics: [],
          phraseEnd: !!pm[2],
        };
      }
      ev.t = s.time;
      ev.path = pathStack.slice();
      s.time += ev.dur;
      s.events.push(ev);
      sline.entries.push(ev);
    }
    if (pathStack.length) warn(no, 'Missing ")" — speed change not closed on this line');
    lastSwaraLine = sline;
  };

  // ---- L: -----------------------------------------------------------------
  const handleLyrics = (value: string, no: number) => {
    if (!lastSwaraLine || !seg) {
      warn(no, 'Lyric line without a swara (S:) line before it');
      return;
    }
    const sl: SwaraLine = lastSwaraLine;
    const idx = sl.lyricCount++;
    const tokens = value.split(/\s+/).filter(Boolean);
    const isPause = (ev: NoteEvent) => ev.kind === 'karvai' || ev.kind === 'dash' || ev.kind === 'empty';
    const render = (tok: string) => {
      if (tok === '_') return '';
      if (['.', '-', '?', ','].includes(tok)) return tok;
      return transliterate(tok, st.lang, { lyric: true });
    };
    if (!st.smartLyric) {
      if (tokens.length !== sl.entries.length) {
        warn(no, 'Lyric line has ' + tokens.length + ' entries but its swara line has ' + sl.entries.length +
          ' (one lyric is needed for every swara and pause; use _ for an empty one, or add SmartLyricMode)');
      }
      sl.entries.forEach((ev, i) => {
        if (i < tokens.length) ev.lyrics[idx] = { text: render(tokens[i]), lang: st.lang.lang };
      });
      return;
    }
    let k = 0;
    for (const ev of sl.entries) {
      if (isPause(ev)) {
        if (k < tokens.length && LYRIC_PAUSE_OK[tokens[k]]) ev.lyrics[idx] = { text: render(tokens[k++]), lang: st.lang.lang };
        continue;
      }
      if (k < tokens.length) ev.lyrics[idx] = { text: render(tokens[k++]), lang: st.lang.lang };
      else ev.lyrics[idx] = { text: '?', lang: 'english', missing: true };
    }
    if (k < tokens.length) warn(no, 'Lyric line has ' + (tokens.length - k) + ' more entries than its swara line can take');
    if (sl.entries.some((ev) => ev.lyrics[idx] && ev.lyrics[idx]!.missing)) warn(no, 'Some swaras have no lyric (shown as ?)');
  };

  for (const { no, text } of lines) {
    const line = text.trim();
    if (!line) continue; // blank lines are ignored, as in v1.5
    if (/^(#|%|\/\/)/.test(line)) continue;

    const m = line.match(/^([A-Za-z][A-Za-z0-9_]*)\s*(?::\s*([\s\S]*))?$/);
    if (!m) {
      warn(no, 'Not a directive — expected something like "S: s r g m" or "L: …"');
      continue;
    }
    const name = m[1].toLowerCase();
    const hasColon = m[2] !== undefined;
    const value = (m[2] || '').trim();

    switch (name) {
      case 's':
        handleSwaras(value, no);
        break;
      case 'l':
        handleLyrics(value, no);
        break;
      case 'heading': {
        const h = parseHeading(value);
        if (h.text === '') {
          pushBlock({ type: 'space' });
          break;
        }
        const lang = h.lang || (st.lang.lang !== 'english' ? st.lang : null);
        pushBlock({
          type: 'heading',
          html: formatText(h.text, lang),
          size: h.size || st.headingPrefs.size || null,
          color: h.color || st.headingPrefs.color || null,
          bold: h.bold,
          italic: h.italic,
          underline: h.underline,
          align: h.align || 'left',
          font: h.font,
          lang: (lang && lang.lang) || 'english',
        });
        break;
      }
      case 'title':
        doc.title = value.replace(/^"([\s\S]*)"$/, '$1');
        break;
      case 'tala': {
        closeSeg();
        const t = parseTala(value);
        if (isTalaError(t)) {
          warn(no, t.error + ' — using Manual (no tala tracking)');
          st.tala = parseTala('Manual') as Tala;
        } else st.tala = t;
        st.gati = st.songGati = st.tala.gati || 'catusra';
        break;
      }
      case 'layout': {
        closeSeg();
        const v = value.split(',')[0].trim().toLowerCase();
        st.fullWidth = /,\s*fullwidth/i.test(value);
        st.compact = /,\s*compact/i.test(value);
        if (['gitam', 'geetam', 'githam', 'geetham'].includes(v)) st.layout = 'gitam';
        else if (v === 'varnam') st.layout = 'varnam';
        else if (['kriti', 'krithi', 'krti'].includes(v)) st.layout = 'krithi';
        else warn(no, 'Layout should be gitam, varnam or krithi');
        applySpeedForLayout();
        break;
      }
      case 'defaultspeed': {
        const v = parseInt(value, 10);
        if (![0, 1, 2].includes(v)) warn(no, 'DefaultSpeed must be 0, 1 or 2');
        else {
          st.speed = st.songSpeed = v;
          st.explicitSpeed = true;
        }
        break;
      }
      case 'gati': {
        const g = parseGati(value);
        if (!g) {
          warn(no, 'Gati should be tisra, catusra, khanda, misra or sankirna');
          break;
        }
        if (g === st.songGati) st.speed = st.songSpeed;
        else if (st.gati === 'catusra' && g !== 'catusra' && st.speed === 2) st.speed = 1;
        else if (st.gati !== 'catusra' && g === 'catusra' && st.speed === 1) st.speed = 2;
        st.gati = g;
        break;
      }
      case 'speedmarks': {
        const v = value.toLowerCase();
        if (v === 'above' || v === 'below') {
          st.speedMarks = v;
          const open = seg as Segment | null;
          if (open && !open.events.length) open.speedMarks = v;
          else closeSeg();
        } else warn(no, 'SpeedMarks must be above or below');
        break;
      }
      case 'phraseends': {
        const parts = value.split(',').map((x) => x.trim());
        const style = (parts[0] || '').toLowerCase() as PhraseEnds['style'];
        if (!['hide', 'show', 'handle', 'handlethick'].includes(style)) {
          warn(no, 'PhraseEnds style must be Hide, Show, Handle or HandleThick');
          break;
        }
        let space = 0;
        if (parts[1]) {
          const sm = parts[1].match(/^(\d+(?:\.\d+)?)\s*(in|px)?$/i);
          if (sm) space = parseFloat(sm[1]) * (sm[2] && sm[2].toLowerCase() === 'in' ? 96 : 1);
          else warn(no, 'PhraseEnds spacing should be a number of pixels or e.g. 0.15in');
        }
        st.phraseEnds = { style, space };
        closeSeg();
        break;
      }
      case 'smartlyricmode':
        st.smartLyric = true;
        break;
      case 'language': {
        const spec = parseLangSpec(value);
        if (!spec) warn(no, 'Unknown language "' + value + '" — use English, Diacritics, Sanskrit, Telugu, Tamil, Kannada or Malayalam');
        else st.lang = spec;
        break;
      }
      case 'languagefont': {
        // LanguageFont: <language|All>,<Serif|Sans|Rounded|Fixed|installed font name>
        const parts = splitAttrs(value);
        const all = /^all$/i.test((parts[0] || '').trim());
        const lang = all ? null : normaliseLang(parts[0]);
        if ((!all && !lang) || !parts[1]) warn(no, 'LanguageFont should look like "LanguageFont: Tamil,Rounded" (styles: Serif, Sans, Rounded; or an installed font name)');
        else if (all) for (const l of Object.keys(LANGS) as Lang[]) doc.langFonts[l] = parts.slice(1).join(',');
        else doc.langFonts[lang!] = parts.slice(1).join(',');
        break;
      }
      case 'swaraprefs':
      case 'lyricprefs':
      case 'gamakaprefs': {
        const key = name === 'swaraprefs' ? 'swara' : name === 'lyricprefs' ? 'lyric' : 'gamaka';
        const target = key === 'swara' ? st.swaraPrefs : key === 'lyric' ? st.lyricPrefs : st.gamakaPrefs;
        parsePrefs(value, target);
        const open = seg as Segment | null;
        if (open && !open.events.length) open.prefs[key] = { ...target };
        break;
      }
      case 'headingprefs':
        parsePrefs(value, st.headingPrefs);
        break;
      case 'songbreak':
        closeSeg();
        break;
      case 'linebreak': {
        const open = seg as Segment | null;
        if (open && open.tala && open.tala.manual === 1) open.lineBreaks.push(open.time);
        else if (open && open.tala && open.tala.manual === 2) closeSeg();
        break;
      }
      case 'pagebreak':
        pushBlock({ type: 'pagebreak' });
        break;
      case 'orientation': {
        const v = value.toLowerCase();
        if (v.startsWith('land')) doc.page.orientation = 'landscape';
        else if (v.startsWith('port')) doc.page.orientation = 'portrait';
        else warn(no, 'Orientation should be Portrait or Landscape');
        const mm = value.match(/(\d+(?:\.\d+)?)\s*in/i);
        if (mm) doc.page.margin = parseFloat(mm[1]) + 'in';
        break;
      }
      // ---- extensions (not in v1.5) ----------------------------------------
      case 'pagesize': {
        const v = value.trim().toUpperCase();
        if (['A3', 'A4', 'A5', 'LETTER', 'LEGAL'].includes(v)) doc.page.size = v.length > 2 ? v.toLowerCase() : v;
        else warn(no, 'PageSize should be A4, A5, A3, Letter or Legal');
        break;
      }
      case 'avartanamsperline': {
        const v = parseInt(value, 10);
        if (v >= 1 && v <= 8) {
          closeSeg();
          st.perRow = v;
        } else warn(no, 'AvartanamsPerLine should be 1–8');
        break;
      }
      case 'section':
        pushBlock({ type: 'heading', html: formatText(value.replace(/^"([\s\S]*)"$/, '$1'), null), bold: true, italic: true, align: 'left', section: true, lang: 'english' });
        break;
      case 'text':
        pushBlock({ type: 'heading', html: formatText(value.replace(/^"([\s\S]*)"$/, '$1'), st.lang.lang !== 'english' ? st.lang : null), align: 'left', lang: st.lang.lang });
        break;
      case 'raga':
      case 'ragam':
      case 'composer':
      case 'arohana':
      case 'arohanam':
      case 'avarohana':
      case 'avarohanam':
        addMeta(name, value);
        break;
      default:
        warn(no, hasColon ? 'Unknown directive "' + m[1] + ':" — ignored' : 'Unknown directive "' + m[1] + '"');
    }
  }
  closeSeg();
  return doc;
}

/**
 * For the "Align" command: which lyric token belongs to which swara token
 * of an S line, so the input can be padded into columns.
 */
export function alignmentMap(sValue: string, lValues: string[], smart: boolean) {
  const { label, tokens } = tokenizeSwaraLine(sValue);
  const entryIdx: number[] = [];
  tokens.forEach((t, i) => {
    if (typeof t === 'string' && !['|', '||', '(', ')'].includes(t)) entryIdx.push(i);
  });
  const isPause = (t: SwaraToken) => typeof t === 'string' && PAUSE_RE.test(t);
  const maps = lValues.map((lv) => {
    const lt = lv.split(/\s+/).filter(Boolean);
    const map: (string | null)[] = new Array(tokens.length).fill(null);
    if (!smart) {
      entryIdx.forEach((ti, k) => (map[ti] = k < lt.length ? lt[k] : null));
    } else {
      let k = 0;
      for (const ti of entryIdx) {
        if (isPause(tokens[ti])) {
          if (k < lt.length && LYRIC_PAUSE_OK[lt[k]]) map[ti] = lt[k++];
        } else if (k < lt.length) map[ti] = lt[k++];
      }
      if (k < lt.length) map.push(lt.slice(k).join(' '));
    }
    return map;
  });
  return { label, tokens: tokens.map((t) => (typeof t === 'string' ? t : t.bad)), maps };
}
