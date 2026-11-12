/*
 * Ctrl+/ (Cmd+/): comment or uncomment the lines touched by the selection.
 * SPDX-License-Identifier: GPL-2.0-only
 */

export interface CommentEdit {
  /** range of the original text to replace */
  start: number;
  end: number;
  text: string;
  /** selection to restore afterwards (in the new text) */
  selStart: number;
  selEnd: number;
}

export function toggleLineComments(value: string, selStart: number, selEnd: number): CommentEdit {
  const start = value.lastIndexOf('\n', selStart - 1) + 1;
  // a selection ending at the very start of a line does not include that line
  let endPos = selEnd > selStart && value[selEnd - 1] === '\n' ? selEnd - 1 : selEnd;
  let end = value.indexOf('\n', endPos);
  if (end < 0) end = value.length;
  const lines = value.slice(start, end).split('\n');
  const filled = lines.filter((l) => l.trim());
  const allCommented = filled.length > 0 && filled.every((l) => /^\s*#/.test(l));
  const out = lines.map((l) => {
    if (allCommented) return l.replace(/^(\s*)# ?/, '$1');
    return l.trim() ? '# ' + l : l;
  });
  const text = out.join('\n');
  return { start, end, text, selStart: start, selEnd: start + text.length };
}
