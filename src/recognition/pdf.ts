/*
 * PDFs for Read Photo: each page is drawn to an image in the browser (with
 * Mozilla's PDF.js, loaded only when a PDF is added), so a scanned book or a
 * printed sheet goes through the same steps as a photo.
 * SPDX-License-Identifier: GPL-2.0-only
 */
import { MAX_EDGE } from './image';

export const isPdf = (f: File) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name);

export interface PdfPages {
  /** one JPEG per page, named after the PDF ("book-p3.jpg") */
  files: File[];
  /** pages in the PDF (more than files.length when only the first ones fit) */
  total: number;
}

/** Draws the first `max` pages of a PDF as JPEG images, about 2,576 px on the long edge. */
export async function pdfPages(file: File, max: number): Promise<PdfPages> {
  const [pdfjs, worker] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const here = (path: string) => new URL(path, document.baseURI).href;
  const task = pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    // the site's Content-Security-Policy doesn't allow WebAssembly; PDF.js has
    // plain-JavaScript image decoders for scans too
    useWasm: false,
    wasmUrl: here('pdfjs/wasm/'),
    standardFontDataUrl: here('pdfjs/standard_fonts/'),
  });
  let doc: Awaited<typeof task.promise>;
  try {
    doc = await task.promise;
  } catch (e) {
    if ((e as { name?: string })?.name === 'PasswordException') throw new Error('“' + file.name + '” is password-protected. Remove the password and try again.');
    throw new Error('“' + file.name + '” could not be opened as a PDF.');
  }
  const base = file.name.replace(/\.pdf$/i, '') || 'page';
  const files: File[] = [];
  try {
    for (let n = 1; n <= Math.min(doc.numPages, max); n++) {
      const page = await doc.getPage(n);
      const one = page.getViewport({ scale: 1 });
      // a scanned A4 page comes out at about 220 dpi; tiny pages are not blown up past 4x
      const viewport = page.getViewport({ scale: Math.min(4, MAX_EDGE / Math.max(one.width, one.height)) });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      await page.render({ canvas, viewport, background: '#ffffff' }).promise;
      const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', 0.92));
      canvas.width = canvas.height = 0;
      page.cleanup();
      if (!blob) throw new Error('Page ' + n + ' of “' + file.name + '” could not be drawn.');
      files.push(new File([blob], base + '-p' + n + '.jpg', { type: 'image/jpeg' }));
    }
    return { files, total: doc.numPages };
  } finally {
    await task.destroy();
  }
}
