import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
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

// Relative base so the same build works on any host path (GitHub Pages
// sub-folders, freepgs) and inside the desktop app (file://).
export default defineConfig({
  base: './',
  plugins: [react(), csp()],
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
