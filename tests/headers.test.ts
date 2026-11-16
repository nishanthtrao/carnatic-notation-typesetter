import { test, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (f: string) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');

/** The CSP that vite.config.ts writes into each page's <meta> tag. */
function metaCsp(): string {
  const src = read('vite.config.ts');
  const block = src.slice(src.indexOf('const CSP = ['), src.indexOf("].join('; ')"));
  return [...block.matchAll(/"([^"]+)"/g)].map((m) => m[1]).join('; ');
}

test('the CSP header (Render and nginx) is the page policy plus frame-ancestors', () => {
  const want = metaCsp() + "; frame-ancestors 'self'";
  const render = read('render.yaml').match(/name: Content-Security-Policy\s+value: "([^"]+)"/);
  expect(render?.[1]).toBe(want);
  const nginx = read('deploy/security-headers.conf').match(/Content-Security-Policy "([^"]+)"/);
  expect(nginx?.[1]).toBe(want);
});

test('Render and nginx send the same security headers', () => {
  const names = (text: string, re: RegExp) => [...text.matchAll(re)].map((m) => m[1]).sort();
  const render = names(read('render.yaml'), /name: ((?:X-|Referrer|Permissions|Content-Security|Strict-Transport|Cross-Origin)[\w-]*)/g);
  const nginx = names(read('deploy/security-headers.conf'), /^add_header ([\w-]+)/gm);
  expect(nginx).toEqual(render);
});
