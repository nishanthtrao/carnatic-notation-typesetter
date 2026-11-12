/*
 * Preparing photos for the vision model: fix orientation, rotate on request,
 * scale so the long edge is at most 2,576 px (the most current Claude models
 * read at that resolution) and encode as JPEG under the 10 MB limit.
 * SPDX-License-Identifier: GPL-2.0-only
 */

export interface PreparedImage {
  base64: string;
  mediaType: 'image/jpeg';
  width: number;
  height: number;
  bytes: number;
}

export const MAX_EDGE = 2576;
const MAX_BASE64 = 9.5 * 1024 * 1024;

export async function prepareImage(file: Blob, rotation = 0): Promise<PreparedImage> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('This file could not be opened as an image. Use a JPEG, PNG or WebP photo.');
  }
  const turn = ((rotation % 360) + 360) % 360;
  const sideways = turn === 90 || turn === 270;
  const srcW = sideways ? bitmap.height : bitmap.width;
  const srcH = sideways ? bitmap.width : bitmap.height;
  const scale = Math.min(1, MAX_EDGE / Math.max(srcW, srcH));
  const w = Math.round(srcW * scale);
  const h = Math.round(srcH * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.translate(w / 2, h / 2);
  ctx.rotate((turn * Math.PI) / 180);
  const dw = (sideways ? h : w);
  const dh = (sideways ? w : h);
  ctx.drawImage(bitmap, -dw / 2, -dh / 2, dw, dh);
  bitmap.close?.();

  for (const quality of [0.9, 0.8, 0.7, 0.6]) {
    const url = canvas.toDataURL('image/jpeg', quality);
    const base64 = url.slice(url.indexOf(',') + 1);
    if (base64.length <= MAX_BASE64 || quality === 0.6) {
      return { base64, mediaType: 'image/jpeg', width: w, height: h, bytes: Math.round((base64.length * 3) / 4) };
    }
  }
  throw new Error('unreachable');
}
