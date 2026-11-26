import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import type { Plugin } from 'vite';

// Content-Security-Policy for production builds (the dev server needs inline
// scripts, so it is only added at build time). Only the AI services the
// optional photo reader supports may be contacted (API_HOSTS in
// src/recognition/providers.ts; tests/headers.test.ts keeps them in step).
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "manifest-src 'self'",
  "worker-src 'self'",
  "connect-src 'self' blob: data: https://api.anthropic.com https://api.openai.com https://generativelanguage.googleapis.com https://openrouter.ai",
  "object-src 'none'",
  "base-uri 'none'",
].join('; ');

function csp(): Plugin {
  return {
    name: 'cmnt-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace('<head>', '<head>\n    <meta http-equiv="Content-Security-Policy" content="' + CSP + '">');
    },
  };
}

// PDF reading (Read Photo): PDF.js needs a few files of its own at run time:
// the plain-JavaScript image decoders for scans (JBIG2 / fax and JPEG 2000;
// the WebAssembly ones would need 'wasm-unsafe-eval' in the CSP) and the
// standard fonts for PDFs that don't embed theirs. Served under pdfjs/.
const PDFJS = resolve(import.meta.dirname, 'node_modules/pdfjs-dist');
const PDFJS_FILES = [
  ['LICENSE', join(PDFJS, 'LICENSE')],
  ...['jbig2_nowasm_fallback.js', 'openjpeg_nowasm_fallback.js', 'LICENSE_JBIG2', 'LICENSE_PDFJS_JBIG2', 'LICENSE_OPENJPEG', 'LICENSE_PDFJS_OPENJPEG']
    .map((f) => ['wasm/' + f, join(PDFJS, 'wasm', f)]),
  ...readdirSync(join(PDFJS, 'standard_fonts')).map((f) => ['standard_fonts/' + f, join(PDFJS, 'standard_fonts', f)]),
];
function pdfjsFiles(): Plugin {
  return {
    name: 'cmnt-pdfjs-files',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const m = req.url?.match(/\/pdfjs\/([^?#]+)/);
        const hit = m && PDFJS_FILES.find(([name]) => name === decodeURIComponent(m[1]));
        if (!hit) return next();
        res.setHeader('Content-Type', hit[0].endsWith('.js') ? 'text/javascript' : 'application/octet-stream');
        res.end(readFileSync(hit[1]));
      });
    },
    generateBundle() {
      // licence texts get .txt so every host serves them as text
      for (const [name, file] of PDFJS_FILES)
        this.emitFile({ type: 'asset', fileName: 'pdfjs/' + (/LICENSE[^.]*$/.test(name) ? name + '.txt' : name), source: readFileSync(file) });
    },
  };
}

// Offline support: after the build, write dist/sw.js from src/sw-template.js
// with the list of files to keep. The optional Sans/Rounded fonts are left out
// (cached when a sheet first uses them), and so is the PDF reader (about
// 2.5 MB, fetched only when a PDF is added); everything else is about 1 MB.
const OPTIONAL = /\/(anek|baloo|nunito)-[^/]*\.woff2$|\/pdfjs\/|\/pdf(\.worker)?(\.min)?-[^/]*\.m?js$/;
function serviceWorker(): Plugin {
  let outDir = 'dist';
  return {
    name: 'cmnt-service-worker',
    apply: 'build',
    configResolved(c) {
      outDir = resolve(c.root, c.build.outDir);
    },
    writeBundle() {
      const files: string[] = [];
      const walk = (dir: string) => {
        for (const name of readdirSync(dir)) {
          const p = join(dir, name);
          if (statSync(p).isDirectory()) walk(p);
          else files.push(relative(outDir, p).split('\\').join('/'));
        }
      };
      walk(outDir);
      const precache = files.filter((f) => f !== 'sw.js' && !OPTIONAL.test('/' + f)).sort();
      const hash = createHash('sha256');
      for (const f of precache) hash.update(f).update(readFileSync(join(outDir, f)));
      const sw = readFileSync(resolve(import.meta.dirname, 'src/sw-template.js'), 'utf8')
        .replace('__VERSION__', hash.digest('hex').slice(0, 12))
        .replace('__PRECACHE__', JSON.stringify(precache));
      writeFileSync(join(outDir, 'sw.js'), sw);
    },
  };
}

// Relative base so the same build works on any host path (GitHub Pages
// sub-folders, freepgs) and inside the desktop app (file://).
export default defineConfig({
  base: './',
  plugins: [react(), csp(), pdfjsFiles(), serviceWorker()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        manual: resolve(import.meta.dirname, 'docs/manual.html'),
      },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
