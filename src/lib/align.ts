/*
 * "Align": pads S and L lines with spaces so every lyric sits under its swara
 * in the input text. Uses the parser's own lyric matching.
 */
import { alignmentMap } from '../engine';

export function alignText(text: string): string {
  const lines = text.split('\n');
  let smart = false;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*SmartLyricMode\s*$/i.test(lines[i])) smart = true;
    const sm = lines[i].match(/^(\s*)S\s*:\s*(.*)$/i);
    if (!sm) continue;
    const lIdx: number[] = [];
    for (let j = i + 1; j < lines.length && /^\s*L\s*:/i.test(lines[j]); j++) lIdx.push(j);
    const lVals = lIdx.map((j) => lines[j].replace(/^\s*L\s*:\s*/i, ''));
    const a = alignmentMap(sm[2], lVals, smart);
    const widths = a.tokens.map((t, k) => Math.max(t.length, ...a.maps.map((mp) => (mp[k] || '').length)));
    const labelText = a.label !== null ? '"' + a.label + '" ' : '';
    const pad = (s: string, w: number) => s + ' '.repeat(Math.max(0, w - s.length));
    lines[i] = sm[1] + 'S: ' + labelText + a.tokens.map((t, k) => pad(t, widths[k])).join(' ').replace(/\s+$/, '');
    lIdx.forEach((j, n) => {
      const mp = a.maps[n];
      let out = ' '.repeat(labelText.length) + a.tokens.map((_t, k) => pad(mp[k] || '', widths[k])).join(' ');
      if (mp.length > a.tokens.length) out += ' ' + mp.slice(a.tokens.length).join(' ');
      lines[j] = sm[1] + 'L: ' + out.replace(/\s+$/, '');
    });
    i += lIdx.length;
  }
  return lines.join('\n');
}
