/*
 * Carnatic Music Notation Typesetter — HTML renderer
 * SPDX-License-Identifier: GPL-2.0-or-later
 *
 * Layout works like a notation book: swaras within an anga (or akshara, in
 * the gitam/varnam layouts) are set close together and rows of the same
 * passage line up at those boundaries. Text is measured in the browser (so
 * Indic scripts and custom fonts are exact), positions are in em, and the
 * sheet is scaled with the container width (cqi units) so the widest row
 * always fits the screen or the printed page.
 */
import { parseFontStyle, styleFamilies } from './fonts';
import { esc } from './heading';
import type { HeadingBlock, Lang, LangSpec, MetaItem, NotationDoc, NoteEvent, Row, StaffBlock } from './types';

const EPS = 1e-6;

// Spacing, in em of the notation font.
const SP = {
  swara: 0.42, // gap after a swara in the default speed
  fast: 0.16, // gap after a swara inside ( )
  lyric: 0.45, // minimum gap after a lyric fragment
  empty: 0.55, // width of _ (doubled for __)
  bar: 1.15, // box for |
  dbar: 1.45, // box for ||
  akshara: 0.75, // gap between aksharas (gitam / varnam layouts)
  anga: 1.0, // gap between angas without a marker (capu talas)
  label: 0.7, // gap after the sangati label
  cellMin: 0.3,
};

type IndicSwara = 'devanagari' | 'telugu' | 'kannada' | 'malayalam' | 'tamil';
const SWARA_TEXT: Record<IndicSwara, Record<string, [string, string]>> = {
  devanagari: { s: ['स', 'सा'], r: ['रि', 'री'], g: ['ग', 'गा'], m: ['म', 'मा'], p: ['प', 'पा'], d: ['ध', 'धा'], n: ['नि', 'नी'] },
  telugu: { s: ['స', 'సా'], r: ['రి', 'రీ'], g: ['గ', 'గా'], m: ['మ', 'మా'], p: ['ప', 'పా'], d: ['ద', 'దా'], n: ['ని', 'నీ'] },
  kannada: { s: ['ಸ', 'ಸಾ'], r: ['ರಿ', 'ರೀ'], g: ['ಗ', 'ಗಾ'], m: ['ಮ', 'ಮಾ'], p: ['ಪ', 'ಪಾ'], d: ['ದ', 'ದಾ'], n: ['ನಿ', 'ನೀ'] },
  malayalam: { s: ['സ', 'സാ'], r: ['രി', 'രീ'], g: ['ഗ', 'ഗാ'], m: ['മ', 'മാ'], p: ['പ', 'പാ'], d: ['ധ', 'ധാ'], n: ['നി', 'നീ'] },
  tamil: { s: ['ஸ', 'ஸா'], r: ['ரி', 'ரீ'], g: ['க', 'கா'], m: ['ம', 'மா'], p: ['ப', 'பா'], d: ['த', 'தா'], n: ['நி', 'நீ'] },
};

// Gamaka glyphs (v1.5: ~ ~~ ^ / // \ \\), drawn as small SVGs.
const svg = (w: number, d: string) =>
  '<svg class="cm-gsvg" viewBox="0 0 ' + w + ' 10" style="width:' + ((w / 10) * 0.55).toFixed(2) + 'em" aria-hidden="true"><path d="' + d + '"/></svg>';
const GAMAKA_SVG: Record<string, string> = {
  '~': svg(17, 'M1 7Q3.5 1 6 7T11 7T16 7'),
  '~~': svg(27, 'M1 7Q3.5 1 6 7T11 7T16 7T21 7T26 7'),
  '^': svg(14, 'M2 5.5L5.5 9L12.5 1'),
  '/': svg(14, 'M2 9.5Q1 3 9 3.5M6.5 1L9.8 3.6L6.8 6'),
  '//': svg(20, 'M1 9.5Q0 4 6 6Q11 8 14 3.5M11.5 1.2L14.8 3.6L11.6 5.8'),
  '\\': svg(14, 'M1.5 2.5Q9.5 0.5 10 8.5M7.4 6.4L10 9.4L12.6 6.4'),
  '\\\\': svg(20, 'M1 3Q6 0 9 4Q12 8 15.5 8M13 5.3L16 8L13 10'),
};

const num = (v: number) => (Math.round(v * 1000) / 1000).toString();

/** The seven swaras as printed in a language, e.g. for font previews. */
export function swaraSample(lang: Lang): string {
  const t = SWARA_TEXT[lang as IndicSwara];
  return 'srgmpdn'.split('').map((k) => (t ? t[k][0] : k)).join(' ');
}

function swaraLang(lang?: LangSpec): IndicSwara | 'english' {
  const l = lang && lang.lang;
  return l && l in SWARA_TEXT ? (l as IndicSwara) : 'english';
}

export function swaraGlyph(ev: NoteEvent, phraseStyle?: string): string {
  const lang = swaraLang(ev.lang);
  const base = lang === 'english' ? ev.display || '' : SWARA_TEXT[lang][ev.note!][ev.long ? 1 : 0];
  let html = '<span class="cm-g cm-lang-' + lang + '">' + esc(base);
  if (ev.variant) html += '<sub>' + ev.variant + '</sub>';
  if (ev.octave) {
    const n = Math.min(3, Math.abs(ev.octave));
    html += '<span class="cm-oct ' + (ev.octave > 0 ? 'up' : 'down') + '">' + '<i></i>'.repeat(n) + '</span>';
  }
  if (ev.gamaka) {
    const g = GAMAKA_SVG[ev.gamaka];
    html += '<span class="cm-gam' + ((ev.octave || 0) > 0 ? ' over-dot' : '') + (g ? '' : ' cm-gam-text') + '">' + (g || esc(ev.gamaka.slice(1, -1))) + '</span>';
  }
  if (ev.phraseEnd && phraseStyle && phraseStyle !== 'hide') {
    html += phraseStyle === 'show' ? '<span class="cm-pe">-</span>' : '<span class="cm-pe cm-handle' + (phraseStyle === 'handlethick' ? ' thick' : '') + '"></span>';
  }
  return html + '</span>';
}

function eventHtml(ev: NoteEvent, phraseStyle: string): string {
  if (ev.kind === 'swara') return swaraGlyph(ev, phraseStyle);
  if (ev.kind === 'same') return '<span class="cm-g cm-same">‥</span>';
  if (ev.kind === 'empty') return '';
  return '<span class="cm-g cm-karvai">' + esc(ev.text || '') + (ev.phraseEnd && phraseStyle === 'show' ? '-' : '') + '</span>';
}

function inlineSwaras(swaras: NoteEvent[], lang?: LangSpec): string {
  return '<span class="cm-inline">' + swaras.map((ev) => swaraGlyph({ ...ev, lang })).join(' ') + '</span>';
}

function staffStyle(staff: StaffBlock): string {
  const sp = staff.prefs.swara;
  const lp = staff.prefs.lyric;
  const gp = staff.prefs.gamaka;
  const styles: string[] = [];
  if (sp.size) styles.push('--cm-max:' + num(sp.size * 1.3) + 'pt');
  if (sp.color) styles.push('--cm-swara-color:' + sp.color);
  if (lp.color) styles.push('--cm-lyric-color:' + lp.color);
  if (lp.size) styles.push('--cm-lyric-scale:' + num(lp.size / (sp.size || 10)));
  if (gp.color) styles.push('--cm-gamaka-color:' + gp.color);
  if (gp.size) styles.push('--cm-gamaka-scale:' + num(gp.size / (sp.size || 10)));
  return styles.join(';');
}

// ---- layout bookkeeping (kept outside the document model) -------------------
interface EvGeo {
  html: string;
  key: string | null;
  rx: number;
  w: number;
  x: number;
}
interface Cell {
  evs: NoteEvent[];
  natural: number;
  x: number;
  w: number;
  key: number | null;
  sep: Row['intervals'][number]['sep'];
}
interface RowGeo {
  labelKey: string | null;
  cells: Cell[];
  seps: { x: number; w: number; kind: string }[];
  lead: { x: number; w: number } | null;
  total: number;
  lyricKeys: Map<object, string>;
}

interface MeasureReq {
  kind: 'lyric' | 'label' | 'ev';
  html: string;
  cls?: string;
  style: string;
}

/** Measure many snippets in one layout pass; widths are returned in em. */
function measureAll(el: HTMLElement, reqs: Map<string, MeasureReq>): Map<string, number> {
  const box = document.createElement('div');
  box.setAttribute('aria-hidden', 'true');
  box.style.cssText = 'position:absolute;left:-99999px;top:0;visibility:hidden;contain:layout;';
  const keys: string[] = [];
  let html = '';
  for (const [key, r] of reqs) {
    keys.push(key);
    const inner =
      r.kind === 'lyric'
        ? '<span class="cm-lyr" style="position:static;display:inline-block"><span class="cm-t ' + r.cls + '">' + r.html + '</span></span>'
        : r.kind === 'label'
          ? '<span class="cm-label" style="position:static;display:inline-block;padding:0">' + r.html + '</span>'
          : '<span class="cm-ev" style="position:static;display:inline-block">' + r.html + '</span>';
    html += '<div class="cm-staff" style="font-size:100px;' + r.style + '">' + inner + '</div>';
  }
  box.innerHTML = html;
  el.appendChild(box);
  const out = new Map<string, number>();
  Array.from(box.children).forEach((div, i) => {
    out.set(keys[i], (div.firstElementChild as HTMLElement).getBoundingClientRect().width / 100);
  });
  box.remove();
  return out;
}

interface Geometry {
  maxTotal: number;
  labelW: number;
  rows: Map<Row, RowGeo>;
  evs: Map<NoteEvent, EvGeo>;
  styles: Map<StaffBlock, string>;
}

function layoutDoc(doc: NotationDoc, el: HTMLElement): Geometry {
  const staffs = doc.blocks.filter((b): b is StaffBlock => b.type === 'staff');
  const reqs = new Map<string, MeasureReq>();
  const want = (key: string, r: MeasureReq) => {
    if (!reqs.has(key)) reqs.set(key, r);
    return key;
  };
  const rowsGeo = new Map<Row, RowGeo>();
  const evGeo = new Map<NoteEvent, EvGeo>();
  const styles = new Map<StaffBlock, string>();

  for (const st of staffs) {
    const style = staffStyle(st);
    styles.set(st, style);
    for (const row of st.rows) {
      const g: RowGeo = { labelKey: null, cells: [], seps: [], lead: null, total: 0, lyricKeys: new Map() };
      if (row.label) g.labelKey = want('L|' + style + '|' + row.label, { kind: 'label', html: esc(row.label), style });
      for (const ev of row.events) {
        const html = eventHtml(ev, st.phraseEnds.style);
        evGeo.set(ev, { html, key: html ? want('E|' + style + '|' + html, { kind: 'ev', html, style }) : null, rx: 0, w: 0, x: 0 });
      }
      for (const line of row.lyricLines) {
        for (const it of line) {
          g.lyricKeys.set(it, want('Y|' + style + '|' + it.lang + '|' + it.text, { kind: 'lyric', html: esc(it.text), cls: 'cm-lang-' + (it.lang || 'english'), style }));
        }
      }
      rowsGeo.set(row, g);
    }
  }
  const widths = measureAll(el, reqs);
  const W = (key: string | null) => (key ? widths.get(key) || 0 : 0);

  let maxLabel = 0;
  for (const g of rowsGeo.values()) if (g.labelKey) maxLabel = Math.max(maxLabel, W(g.labelKey));
  const labelW = maxLabel ? maxLabel + SP.label : 0;
  let maxTotal = 0;

  for (const st of staffs) {
    const phraseEm = st.phraseEnds.space ? st.phraseEnds.space / 16 : 0;
    for (const row of st.rows) {
      const g = rowsGeo.get(row)!;
      const lyricAt = row.lyricLines.map((line) => new Map(line.map((it) => [+it.t.toFixed(6), it])));
      g.cells = row.intervals.map((iv, idx) => {
        const last = idx === row.intervals.length - 1;
        const evs = row.events.filter((ev) => ev.t >= iv.t0 - EPS && (last || ev.t < iv.t1 - EPS));
        let x = 0;
        const lyrEnd: number[] = [];
        let natural = 0;
        for (const ev of evs) {
          const eg = evGeo.get(ev)!;
          let start = x;
          const lyr = lyricAt.map((mp) => mp.get(+ev.t.toFixed(6)));
          lyr.forEach((it, li) => {
            if (it) start = Math.max(start, lyrEnd[li] || 0);
          });
          eg.rx = start;
          eg.w = eg.key ? W(eg.key) : ev.kind === 'empty' ? SP.empty * (ev.text === '__' ? 2 : 1) : 0;
          x = start + eg.w + (ev.path.length ? SP.fast : SP.swara);
          if (ev.phraseEnd && phraseEm) x += phraseEm;
          lyr.forEach((it, li) => {
            if (it) lyrEnd[li] = start + W(g.lyricKeys.get(it)!) + SP.lyric;
          });
          natural = Math.max(natural, x, ...lyrEnd.filter((v) => v !== undefined));
        }
        return { evs, natural: Math.max(natural, evs.length ? 0 : SP.cellMin), x: 0, w: 0, key: iv.key, sep: iv.sep };
      });
    }
    // column widths: shared between rows in the automatic layouts
    const colW = new Map<number | null, number>();
    for (const row of st.rows) {
      if (!row.align) continue;
      for (const c of rowsGeo.get(row)!.cells) colW.set(c.key, Math.max(colW.get(c.key) || 0, c.natural));
    }
    for (const row of st.rows) {
      const g = rowsGeo.get(row)!;
      let x = labelW;
      if (row.leadMarker) {
        g.lead = { x, w: row.leadMarker === '||' ? SP.dbar : SP.bar };
        x += g.lead.w;
      }
      for (const c of g.cells) {
        c.x = x;
        c.w = row.align ? colW.get(c.key)! : c.natural;
        for (const ev of c.evs) evGeo.get(ev)!.x = x + evGeo.get(ev)!.rx;
        x += c.w;
        if (c.sep) {
          const w = c.sep === '||' ? SP.dbar : c.sep === '|' ? SP.bar : c.sep === 'akshara' ? SP.akshara : SP.anga;
          if (c.sep === '|' || c.sep === '||') g.seps.push({ x, w, kind: c.sep });
          x += w;
        }
      }
      g.total = x;
      maxTotal = Math.max(maxTotal, x);
    }
  }
  return { maxTotal: Math.max(maxTotal, 4), labelW, rows: rowsGeo, evs: evGeo, styles };
}

function renderStaff(st: StaffBlock, geo: Geometry, stretch: number): string {
  const { labelW } = geo;
  const style = geo.styles.get(st) || '';
  const sx = (x: number) => num(labelW + (x - labelW) * stretch) + 'em';
  let html = '<div class="cm-staff' + (st.speedMarks === 'below' ? ' marks-below' : '') + '"' + (style ? ' style="' + style + '"' : '') + ' data-line="' + st.line + '">';
  for (const row of st.rows) {
    const g = geo.rows.get(row)!;
    const E = (ev: NoteEvent) => geo.evs.get(ev)!;
    const hasGamaka = row.events.some((ev) => ev.gamaka);
    // Inline tala markers sit just above the swaras when nothing else needs that space
    // (speed lines above, gamakas); otherwise they keep a band of their own.
    const roomAbove = !hasGamaka && (st.speedMarks === 'below' || !row.groups.length);
    const cls = (hasGamaka ? ' has-gamaka' : '') + (row.inline.length ? ' has-inline' + (roomAbove ? ' it-tight' : '') : '');
    html += '<div class="cm-row' + cls + '" style="width:' + sx(g.total) + '">';
    if (row.label) html += '<span class="cm-label">' + esc(row.label) + '</span>';

    if (row.inline.length) {
      html += '<div class="cm-inline-tala">';
      for (const mk of row.inline) {
        const ev = row.events.find((e) => e.t >= mk.t - EPS);
        html += '<span class="cm-it" style="left:' + sx(ev ? E(ev).x : g.total) + '"><span>' + esc(mk.kind) + '</span></span>';
      }
      html += '</div>';
    }

    html += '<div class="cm-swaras">';
    for (const ev of row.events) {
      const eg = E(ev);
      if (eg.html) html += '<span class="cm-ev" style="left:' + sx(eg.x) + '">' + eg.html + '</span>';
    }
    for (const gr of row.groups) {
      const a = row.events.find((e) => Math.abs(e.t - gr.start) < EPS);
      let b: NoteEvent | null = null;
      for (const e of row.events) if (e.t < gr.end - EPS && e.t >= gr.start - EPS) b = e;
      if (!a || !b) continue;
      const x0 = E(a).x;
      const x1 = E(b).x + Math.max(E(b).w, 0.35);
      html += '<span class="cm-speed d' + Math.min(gr.depth, 4) + '" style="left:' + sx(x0) + ';width:' + num((x1 - x0) * stretch) + 'em"></span>';
    }
    if (g.lead) html += '<span class="cm-bar" style="left:' + sx(g.lead.x) + ';width:' + num(g.lead.w * stretch) + 'em">' + row.leadMarker + '</span>';
    for (const s of g.seps) html += '<span class="cm-bar" style="left:' + sx(s.x) + ';width:' + num(s.w * stretch) + 'em">' + s.kind + '</span>';
    html += '</div>';

    for (const line of row.lyricLines) {
      html += '<div class="cm-lyrics">';
      for (const it of line) {
        const ev = row.events.find((e) => Math.abs(e.t - it.t) < EPS);
        html += '<span class="cm-lyr' + (it.missing ? ' cm-missing' : '') + '" style="left:' + sx(ev ? E(ev).x : 0) + '"><span class="cm-t cm-lang-' + (it.lang || 'english') + '">' + esc(it.text) + '</span></span>';
      }
      html += '</div>';
    }
    html += '</div>';
  }
  return html + '</div>';
}

function renderHeading(b: HeadingBlock): string {
  const st: string[] = [];
  if (b.size) st.push('font-size:min(' + num(b.size * 1.15) + 'pt,' + num(b.size * 0.42) + 'cqi)');
  if (b.color) st.push('color:' + b.color);
  if (b.bold) st.push('font-weight:700');
  if (b.italic) st.push('font-style:italic');
  if (b.underline) st.push('text-decoration:underline');
  if (b.align) st.push('text-align:' + b.align);
  if (b.font) st.push('font-family:' + cssFont(b.font, b.lang || 'english') + ', var(--cm-fallback)');
  return '<div class="cm-heading' + (b.section ? ' cm-section' : '') + ' cm-lang-' + (b.lang || 'english') + '"' + (st.length ? ' style="' + esc(st.join(';')) + '"' : '') + '>' + b.html + '</div>';
}

function renderMeta(items: MetaItem[]): string {
  return '<div class="cm-meta">' + items.map((it) => it.value === '' ? '' :
    '<div class="cm-meta-item"><span class="cm-meta-k">' + esc(it.label) + '</span> <span class="cm-meta-v">' +
    (it.swaras && it.swaras.length ? inlineSwaras(it.swaras, it.lang) : esc(it.value)) + '</span></div>').join('') + '</div>';
}

function cssFont(name: string, lang?: Lang): string {
  if (/^fixed$/i.test(name.trim())) return 'ui-monospace, "Courier New", monospace';
  const style = parseFontStyle(name);
  if (style) return styleFamilies(style, lang);
  return name.split(',').map((f) => f.trim()).filter(Boolean).map((f) => (/^[\w-]+$/.test(f) ? f : '"' + f.replace(/["\\<>]/g, '') + '"')).join(', ');
}

let sheetCounter = 0;

export interface RenderHandle {
  /** Re-layout; pass true after web fonts load (text is measured). */
  refit(fontsChanged?: boolean): void;
}

/** Render a parsed document into `el`. */
export function render(doc: NotationDoc, el: HTMLElement, options: { emptyText?: string } = {}): RenderHandle {
  if (!el.dataset.cmSheet) el.dataset.cmSheet = 'cm' + ++sheetCounter;
  el.classList.add('cm-sheet');

  // Per-language fonts (LanguageFont directive) — needed before measuring
  const sel = '[data-cm-sheet="' + el.dataset.cmSheet + '"]';
  let css = '';
  for (const [lang, font] of Object.entries(doc.langFonts) as [Lang, string][]) {
    if (!font) continue;
    const f = cssFont(font, lang);
    css += sel + ' .cm-lang-' + lang + '{font-family:' + f + ', var(--cm-fallback)}';
    // English is the sheet's base language: labels, numbers and plain headings follow it too
    if (lang === 'english') css += sel + '{font-family:' + f + ', var(--cm-fallback)}';
    if (lang === 'english' && !doc.langFonts.iast) css += sel + ' .cm-lang-iast{font-family:' + cssFont(font, 'iast') + ', var(--cm-fallback)}';
  }
  const styleTag = css ? '<style>' + css + '</style>' : '';
  el.innerHTML = styleTag;

  const geo = layoutDoc(doc, el);
  el.style.setProperty('--cm-k', num(99.5 / geo.maxTotal));
  const fullWidth = doc.blocks.some((b) => b.type === 'staff' && b.fullWidth);

  const draw = () => {
    let stretchFor = (_st: StaffBlock) => 1;
    if (fullWidth && el.clientWidth) {
      const probe = document.createElement('div');
      probe.className = 'cm-staff';
      el.appendChild(probe);
      const fontPx = parseFloat(getComputedStyle(probe).fontSize) || 16;
      probe.remove();
      const availEm = el.clientWidth / fontPx;
      stretchFor = (st) => (st.fullWidth ? Math.max(1, (availEm - geo.labelW - 0.2) / (geo.maxTotal - geo.labelW)) : 1);
    }
    let html = '';
    for (const b of doc.blocks) {
      if (b.type === 'heading') html += renderHeading(b);
      else if (b.type === 'space') html += '<div class="cm-space"></div>';
      else if (b.type === 'pagebreak') html += '<div class="cm-pagebreak"></div>';
      else if (b.type === 'meta') html += renderMeta(b.items);
      else if (b.type === 'staff') html += renderStaff(b, geo, stretchFor(b));
    }
    if (!doc.blocks.length) html = '<p class="cm-empty">' + esc(options.emptyText || 'Nothing to show yet.') + '</p>';
    el.innerHTML = styleTag + html;
  };
  draw();

  return {
    refit(fontsChanged?: boolean) {
      if (fontsChanged) render(doc, el, options);
      else if (fullWidth) draw();
    },
  };
}
