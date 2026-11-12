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

/** The notation in the current URL hash, or null. Throws if it is corrupt. */
export async function readShareHash(hash = location.hash): Promise<string | null> {
  if (hash.startsWith('#z=') && typeof DecompressionStream === 'function') {
    const stream = new Blob([bytesFromB64url(hash.slice(3)) as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return await new Response(stream).text();
  }
  if (hash.startsWith('#t=')) return new TextDecoder().decode(bytesFromB64url(hash.slice(3)));
  return null;
}
