/*
 * Saving notation files on the person's own device (web): Save is a normal
 * browser download, so the file appears in the downloads list and the
 * Downloads folder. Open uses a file input.
 * SPDX-License-Identifier: GPL-2.0-only
 */
/** Save by downloading. Returns the file name used. */
export function downloadText(name: string, text: string): string {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 1000);
  return name;
}
