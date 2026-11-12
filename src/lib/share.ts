/*
 * Share links: the notation is compressed into the URL hash, so nothing is
 * uploaded. #z= is deflate-raw, #t= is plain UTF-8 (fallback).
 */
function b64urlFromBytes(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function bytesFromB64url(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function shareUrl(text: string): Promise<string> {
  const base = location.href.split('#')[0];
  const bytes = new TextEncoder().encode(text);
  if (typeof CompressionStream === 'function') {
    try {
      const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
      return base + '#z=' + b64urlFromBytes(new Uint8Array(await new Response(stream).arrayBuffer()));
    } catch {
      /* fall through */
    }
  }
  return base + '#t=' + b64urlFromBytes(bytes);
}

/**
 * Largest notation a link may hold once unpacked. Real songs are a few KB; the
 * limit stops a small crafted link from expanding into gigabytes and freezing
 * the page of whoever opens it (a "decompression bomb").
 */
export const MAX_SHARED_BYTES = 1024 * 1024;

export class SharedLinkTooLarge extends Error {
  constructor() {
    super('This link holds more notation than a song needs, so it was not opened.');
  }
}

/** The notation in the current URL hash, or null. Throws if it is corrupt or too large. */
export async function readShareHash(hash = location.hash): Promise<string | null> {
  if (hash.startsWith('#z=') && typeof DecompressionStream === 'function') {
    const stream = new Blob([bytesFromB64url(hash.slice(3)) as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    // read piece by piece and stop as soon as it grows past the limit
    const reader = stream.getReader();
    const parts: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_SHARED_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new SharedLinkTooLarge();
      }
      parts.push(value);
    }
    const all = new Uint8Array(size);
    let at = 0;
    for (const p of parts) {
      all.set(p, at);
      at += p.byteLength;
    }
    return new TextDecoder().decode(all);
  }
  if (hash.startsWith('#t=')) {
    const bytes = bytesFromB64url(hash.slice(3));
    if (bytes.byteLength > MAX_SHARED_BYTES) throw new SharedLinkTooLarge();
    return new TextDecoder().decode(bytes);
  }
  return null;
}
