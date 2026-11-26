/*
 * The notation as page images and as a PDF, made in the browser, for sending
 * (WhatsApp, email) where printing to PDF takes too many steps. Pages are laid
 * out like the printed sheet: the song's page size and margin, light colours,
 * rows never split, a section heading kept with what follows it.
 * SPDX-License-Identifier: GPL-2.0-only
 */
import { pageMm, render, type NotationDoc } from '../engine';
import { buildPdf, type PdfPage } from './pdfWriter';

const PX_PER_MM = 96 / 25.4;
const PT_PER_MM = 72 / 25.4;
/** about 240 dpi: sharp on a phone when zoomed, a few hundred KB per page */
const PIXEL_RATIO = 2.5;

export interface PageImages {
  /** one JPEG per page */
  images: Blob[];
  width: number;
  height: number;
  /** page size in millimetres */
  mm: { width: number; height: number };
}

// The printed (light) colours of the sheet (notation.css). The picture is drawn
// by the browser under the phone's own light/dark setting, so the sheet's
// light-dark() colours are fixed to their light values first.
const LIGHT_VARS: Record<string, string> = {
  '--cm-ink': '#1a1a1a',
  '--cm-muted': '#5b5b5b',
  '--cm-accent': '#7a1f1f',
  '--cm-lyric-color': '#23408e',
};
const LIGHT_DARK = /light-dark\(\s*((?:[^(),]|\([^()]*\))+?)\s*,\s*(?:[^(),]|\([^()]*\))+\)/g;
function forceLight(sheet: HTMLElement) {
  for (const [k, v] of Object.entries(LIGHT_VARS)) sheet.style.setProperty(k, v);
  sheet.style.background = '#fff';
  sheet.style.colorScheme = 'light';
  for (const el of [sheet, ...sheet.querySelectorAll<HTMLElement>('[style*="light-dark"]')]) {
    const css = el.getAttribute('style');
    if (css && css.includes('light-dark')) el.setAttribute('style', css.replace(LIGHT_DARK, '$1'));
  }
}

/**
 * The site's own @font-face rules for the fonts on these pages, with the font
 * files inlined, so the picture uses the same fonts as the screen (and not the
 * phone's). Only faces whose family is in use and whose unicode-range covers
 * text on the pages are included.
 */
async function embedFonts(root: HTMLElement): Promise<string> {
  const families = new Set<string>();
  const chars = new Set<number>();
  for (const el of [root, ...root.querySelectorAll<HTMLElement>('*')]) {
    for (const f of getComputedStyle(el).fontFamily.split(',')) families.add(f.trim().replace(/^["']|["']$/g, '').toLowerCase());
    for (const node of el.childNodes) if (node.nodeType === 3) for (const ch of node.textContent || '') chars.add(ch.codePointAt(0)!);
  }
  const covers = (range: string) =>
    !range ||
    range.split(',').some((part) => {
      const m = part.trim().match(/^U\+([0-9a-f?]+)(?:-([0-9a-f]+))?$/i);
      if (!m) return true;
      const lo = parseInt(m[1].replace(/\?/g, '0'), 16);
      const hi = m[2] ? parseInt(m[2], 16) : parseInt(m[1].replace(/\?/g, 'f'), 16);
      for (const c of chars) if (c >= lo && c <= hi) return true;
      return false;
    });
  const faces: string[] = [];
  const cache = new Map<string, Promise<string>>();
  const inline = (url: string) => {
    if (!cache.has(url))
      cache.set(url, fetch(url).then(async (r) => {
        if (!r.ok) throw new Error(url);
        const buf = new Uint8Array(await r.arrayBuffer());
        let bin = '';
        for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
        return 'data:' + (r.headers.get('content-type') || 'font/woff2') + ';base64,' + btoa(bin);
      }));
    return cache.get(url)!;
  };
  for (const sheet of [...document.styleSheets]) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of [...rules]) {
      if (!(rule instanceof CSSFontFaceRule)) continue;
      const family = rule.style.getPropertyValue('font-family').trim().replace(/^["']|["']$/g, '').toLowerCase();
      if (!families.has(family) || !covers(rule.style.getPropertyValue('unicode-range'))) continue;
      let css = rule.cssText;
      for (const m of [...css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)]) {
        if (m[1].startsWith('data:')) continue;
        try {
          css = css.replace(m[0], 'url(' + (await inline(new URL(m[1], sheet.href || location.href).href)) + ')');
        } catch {
          // a font that can't be read is left out; the page falls back to the next font
        }
      }
      faces.push(css);
    }
  }
  return faces.join('\n');
}

const isWebKit = () => /AppleWebKit/.test(navigator.userAgent) && !/Chrome|Chromium|Edg|Android/.test(navigator.userAgent);
const nextFrame = () => new Promise((ok) => requestAnimationFrame(() => ok(null)));

/** Draws the notation as page images. `onPage` reports progress (page, pages). */
export async function pageImages(doc: NotationDoc, onPage?: (n: number, of: number) => void): Promise<PageImages> {
  const { toCanvas } = await import('html-to-image');
  const mm = pageMm(doc.page);
  const W = Math.round(mm.width * PX_PER_MM);
  const H = Math.round(mm.height * PX_PER_MM);
  const M = Math.round(mm.margin * PX_PER_MM);
  const contentW = W - 2 * M;
  const contentH = H - 2 * M;

  // lay the whole song out once, at the page's content width, out of sight
  const host = document.createElement('div');
  host.className = 'cm-export-host';
  host.style.cssText = 'position:fixed;left:-100000px;top:0;color-scheme:light;';
  document.body.appendChild(host);
  try {
    const sheet = document.createElement('div');
    sheet.style.width = contentW + 'px';
    host.appendChild(sheet);
    const handle = render(doc, sheet);
    await document.fonts.ready;
    handle.refit(true);
    forceLight(sheet);
    await nextFrame();

    // what may not be split: headings, details, each row of a staff
    interface Unit { el: HTMLElement; staff?: HTMLElement; top: number; bottom: number; heading: boolean; breakAfter: boolean }
    const styles = [...sheet.children].filter((c) => c.tagName === 'STYLE');
    const units: Unit[] = [];
    const base = sheet.getBoundingClientRect().top;
    for (const block of [...sheet.children] as HTMLElement[]) {
      if (block.tagName === 'STYLE') continue;
      if (block.classList.contains('cm-pagebreak')) {
        if (units.length) units[units.length - 1].breakAfter = true;
        continue;
      }
      const parts = block.classList.contains('cm-staff') ? ([...block.children] as HTMLElement[]) : [block];
      for (const el of parts) {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        units.push({
          el,
          staff: el === block ? undefined : block,
          top: r.top - base - (parseFloat(cs.marginTop) || 0),
          bottom: r.bottom - base + (parseFloat(cs.marginBottom) || 0),
          heading: block.classList.contains('cm-heading'),
          breakAfter: false,
        });
      }
    }

    // fill pages; a heading that would end a page moves to the next one
    const pages: Unit[][] = [];
    let page: Unit[] = [];
    let start = 0;
    for (const u of units) {
      if (page.length && u.bottom - start > contentH) {
        const carried: Unit[] = [];
        while (page.length > 1 && page[page.length - 1].heading) carried.unshift(page.pop()!);
        pages.push(page);
        page = carried;
        start = (carried[0] || u).top;
      }
      if (!page.length) start = u.top;
      page.push(u);
      if (u.breakAfter) {
        pages.push(page);
        page = [];
      }
    }
    if (page.length || !pages.length) pages.push(page);

    // draw each page: a white page with the margin, holding copies of its units
    const images: Blob[] = [];
    let fontEmbedCSS: string | undefined;
    for (let i = 0; i < pages.length; i++) {
      onPage?.(i + 1, pages.length);
      const pageEl = document.createElement('div');
      pageEl.style.cssText = `width:${W}px;height:${H}px;padding:${M}px;box-sizing:border-box;background:#fff;overflow:hidden;color-scheme:light;`;
      const copy = sheet.cloneNode(false) as HTMLElement;
      copy.style.width = contentW + 'px';
      copy.style.background = '#fff';
      for (const s of styles) copy.appendChild(s.cloneNode(true));
      let staffCopy: HTMLElement | null = null;
      let staffOf: HTMLElement | undefined;
      for (const u of pages[i]) {
        if (u.staff) {
          if (staffOf !== u.staff) {
            staffCopy = u.staff.cloneNode(false) as HTMLElement;
            copy.appendChild(staffCopy);
            staffOf = u.staff;
          }
          staffCopy!.appendChild(u.el.cloneNode(true));
        } else {
          staffOf = undefined;
          copy.appendChild(u.el.cloneNode(true));
        }
      }
      pageEl.appendChild(copy);
      host.appendChild(pageEl);
      fontEmbedCSS ??= await embedFonts(sheet);
      const options = { pixelRatio: PIXEL_RATIO, backgroundColor: '#ffffff', fontEmbedCSS, width: W, height: H };
      // Safari sometimes draws the first copy before its fonts are ready
      if (i === 0 && isWebKit()) await toCanvas(pageEl, options);
      const canvas = await toCanvas(pageEl, options);
      const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', 0.9));
      canvas.width = canvas.height = 0;
      pageEl.remove();
      if (!blob) throw new Error('A page could not be drawn.');
      images.push(blob);
    }
    return { images, width: Math.round(W * PIXEL_RATIO), height: Math.round(H * PIXEL_RATIO), mm: { width: mm.width, height: mm.height } };
  } finally {
    host.remove();
  }
}

/** The notation as a PDF (page images, at the song's page size). */
export async function notationPdf(doc: NotationDoc, onPage?: (n: number, of: number) => void): Promise<Blob> {
  const p = await pageImages(doc, onPage);
  const pages: PdfPage[] = [];
  for (const img of p.images) pages.push({ jpeg: new Uint8Array(await img.arrayBuffer()), width: p.width, height: p.height });
  return buildPdf(pages, p.mm.width * PT_PER_MM, p.mm.height * PT_PER_MM, doc.title || '');
}

/** A file name from the song's title. */
export function fileBase(doc: NotationDoc): string {
  return (doc.title || 'notation').replace(/[\\/:*?"<>|]+/g, '').trim() || 'notation';
}

/**
 * Sends files with the phone's share sheet (WhatsApp, email…) where it can;
 * otherwise downloads them. Returns how they went.
 */
export async function shareOrDownload(files: File[], title: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  if (typeof navigator.share === 'function' && navigator.canShare?.({ files })) {
    try {
      await navigator.share({ files, title });
      return 'shared';
    } catch (e) {
      if ((e as { name?: string })?.name === 'AbortError') return 'cancelled';
      // some browsers refuse files after asking; fall through to downloading
    }
  }
  for (const f of files) {
    const url = URL.createObjectURL(f);
    const a = document.createElement('a');
    a.href = url;
    a.download = f.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
  return 'downloaded';
}
