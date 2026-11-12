import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import type { Plugin } from 'vite';

// Content-Security-Policy for production builds (the dev server needs inline
// scripts, so it is only added at build time). Only Anthropic's API may be
// contacted, for the optional photo reader.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "manifest-src 'self'",
  "worker-src 'self'",
  "connect-src 'self' blob: data: https://api.anthropic.com",
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

// Offline support: after the build, write dist/sw.js from src/sw-template.js
// with the list of files to keep. The optional Sans/Rounded fonts are left out
// (cached when a sheet first uses them); everything else is about 1 MB.
const OPTIONAL = /\/(anek|baloo|nunito)-[^/]*\.woff2$/;
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
  plugins: [react(), csp(), serviceWorker()],
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
