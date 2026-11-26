import { describe, expect, test } from 'vitest';
import { existsSync, readdirSync } from 'node:fs';
import { isPdf } from '../src/recognition/pdf';

describe('PDFs in Read Photo', () => {
  test('recognised by type or by name', () => {
    expect(isPdf(new File([''], 'book.pdf', { type: 'application/pdf' }))).toBe(true);
    expect(isPdf(new File([''], 'SCAN.PDF'))).toBe(true); // some phones send no type
    expect(isPdf(new File([''], 'page.jpg', { type: 'image/jpeg' }))).toBe(false);
  });
  test('the decoders for scans and the standard fonts are where the build copies them from', () => {
    // vite.config.ts serves these under pdfjs/; a PDF.js upgrade that moves them would break scanned PDFs
    for (const f of ['jbig2_nowasm_fallback.js', 'openjpeg_nowasm_fallback.js']) expect(existsSync('node_modules/pdfjs-dist/wasm/' + f)).toBe(true);
    expect(readdirSync('node_modules/pdfjs-dist/standard_fonts').length).toBeGreaterThan(10);
  });
});
