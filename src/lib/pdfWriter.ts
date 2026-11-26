/*
 * A small PDF writer: one JPEG image per page, filling the page. Enough for
 * sending a notation sheet as a PDF (WhatsApp, email) without a library.
 * SPDX-License-Identifier: GPL-2.0-only
 */

export interface PdfPage {
  /** JPEG bytes */
  jpeg: Uint8Array;
  /** image size in pixels */
  width: number;
  height: number;
}

const enc = new TextEncoder();

/** Builds a PDF whose pages are `pageWidthPt` × `pageHeightPt` points (1/72 inch), one image each. */
export function buildPdf(pages: PdfPage[], pageWidthPt: number, pageHeightPt: number, title = ''): Blob {
  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (chunk: Uint8Array | string) => {
    const bytes = typeof chunk === 'string' ? enc.encode(chunk) : chunk;
    parts.push(bytes);
    length += bytes.length;
  };
  // objects: 1 catalog, 2 pages, 3 info, then per page: page, content, image
  const obj = (n: number, body: () => void) => {
    offsets[n] = length;
    push(n + ' 0 obj\n');
    body();
    push('\nendobj\n');
  };
  const W = pageWidthPt.toFixed(2);
  const H = pageHeightPt.toFixed(2);
  const pageObj = (i: number) => 4 + i * 3;

  push('%PDF-1.4\n%âãÏÓ\n');
  obj(1, () => push('<< /Type /Catalog /Pages 2 0 R >>'));
  obj(2, () => push('<< /Type /Pages /Count ' + pages.length + ' /Kids [' + pages.map((_, i) => pageObj(i) + ' 0 R').join(' ') + '] >>'));
  obj(3, () => push('<< /Title ' + pdfString(title) + ' /Producer (Carnatic Notation Typesetter) >>'));
  pages.forEach((p, i) => {
    const n = pageObj(i);
    obj(n, () =>
      push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + W + ' ' + H + '] /Resources << /XObject << /Im0 ' + (n + 2) + ' 0 R >> >> /Contents ' + (n + 1) + ' 0 R >>'),
    );
    const draw = 'q ' + W + ' 0 0 ' + H + ' 0 0 cm /Im0 Do Q';
    obj(n + 1, () => push('<< /Length ' + draw.length + ' >>\nstream\n' + draw + '\nendstream'));
    obj(n + 2, () => {
      push('<< /Type /XObject /Subtype /Image /Width ' + p.width + ' /Height ' + p.height + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + p.jpeg.length + ' >>\nstream\n');
      push(p.jpeg);
      push('\nendstream');
    });
  });
  const xref = length;
  const count = 4 + pages.length * 3;
  push('xref\n0 ' + count + '\n0000000000 65535 f \n');
  for (let n = 1; n < count; n++) push(String(offsets[n]).padStart(10, '0') + ' 00000 n \n');
  push('trailer\n<< /Size ' + count + ' /Root 1 0 R /Info 3 0 R >>\nstartxref\n' + xref + '\n%%EOF\n');
  return new Blob(parts as BlobPart[], { type: 'application/pdf' });
}

/** A PDF text string: plain ASCII in ( ), anything else as UTF-16BE hex. */
function pdfString(s: string): string {
  if (/^[\x20-\x7e]*$/.test(s)) return '(' + s.replace(/[\\()]/g, '\\$&') + ')';
  let hex = 'FEFF';
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    if (cp > 0xffff) {
      const v = cp - 0x10000;
      hex += (0xd800 + (v >> 10)).toString(16).padStart(4, '0') + (0xdc00 + (v & 0x3ff)).toString(16).padStart(4, '0');
    } else hex += cp.toString(16).padStart(4, '0');
  }
  return '<' + hex.toUpperCase() + '>';
}
