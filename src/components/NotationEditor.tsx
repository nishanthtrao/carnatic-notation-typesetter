import { convertPasted, hasIndic } from '../lib/paste-convert';
import { toggleLineComments } from '../lib/comments';
import { forwardRef, useImperativeHandle, useRef } from 'react';
import { complete } from '../lib/directives';

export interface LineInfo {
  start: number;
  end: number;
  text: string;
  index: number;
  col: number;
}

export interface EditorHandle {
  getValue(): string;
  /** Replace everything (opening a file etc.); not undoable. */
  setValue(text: string): void;
  /** Replace a range as if typed (undoable where the browser allows). */
  replaceRange(start: number, end: number, text: string): void;
  insertAtCursor(text: string): void;
  lineInfo(): LineInfo;
  goToLine(n: number): void;
  focus(): void;
  scrollTop: number;
}

interface Props {
  initialValue: string;
  onInput: (text: string) => void;
  onShortcut: (cmd: 'update' | 'save' | 'saveAs' | 'letters') => void;
  /** pasted Indian-script text was converted; original kept for "Keep original" */
  onPasteConverted?: (info: { start: number; original: string; converted: string; scriptName: string; languageWord: string }) => void;
}

const KEYS: [string, string, string?][] = [
  ['s', 's '], ['r', 'r '], ['g', 'g '], ['m', 'm '], ['p', 'p '], ['d', 'd '], ['n', 'n '],
  ["'", "'", 'tara stayi (upper octave)'], ['`', '`', 'mandra stayi (lower octave)'],
  [',', ', '], [';', '; '], ['(', '( '], [')', ') '], ['|', '| '], ['||', '|| '], ['_', '_ '], ['~', '~'],
  ['S:', '\nS: '], ['L:', '\nL: '],
];

export const NotationEditor = forwardRef<EditorHandle, Props>(function NotationEditor({ initialValue, onInput, onShortcut, onPasteConverted }, ref) {
  const ta = useRef<HTMLTextAreaElement>(null);

  const lineInfo = (): LineInfo => {
    const el = ta.current!;
    const v = el.value;
    const pos = el.selectionStart;
    const start = v.lastIndexOf('\n', pos - 1) + 1;
    let end = v.indexOf('\n', pos);
    if (end < 0) end = v.length;
    return { start, end, text: v.slice(start, end), index: v.slice(0, start).split('\n').length - 1, col: pos - start };
  };

  const replaceRange = (start: number, end: number, text: string) => {
    const el = ta.current!;
    el.focus();
    el.setSelectionRange(start, end);
    // execCommand keeps the browser's undo history; fall back if unsupported
    let ok = false;
    try {
      ok = document.execCommand('insertText', false, text);
    } catch {
      ok = false;
    }
    if (!ok || el.value.slice(start, start + text.length) !== text) {
      el.setRangeText(text, start, end, 'end');
      onInput(el.value);
    }
  };

  useImperativeHandle(ref, () => ({
    getValue: () => ta.current!.value,
    setValue: (text) => {
      ta.current!.value = text;
      ta.current!.scrollTop = 0;
    },
    replaceRange,
    insertAtCursor: (text) => {
      const el = ta.current!;
      const a = el.selectionStart;
      const before = el.value.slice(0, a);
      const needsSpace = /^[srgmpdn,;()|_]/.test(text) && before && !/[\s(]$/.test(before);
      replaceRange(a, el.selectionEnd, (needsSpace ? ' ' : '') + text);
    },
    lineInfo,
    goToLine: (n) => {
      const el = ta.current!;
      const lines = el.value.split('\n');
      let pos = 0;
      for (let i = 0; i < n - 1 && i < lines.length; i++) pos += lines[i].length + 1;
      el.focus();
      el.setSelectionRange(pos, pos + (lines[n - 1] || '').length);
      const lh = parseFloat(getComputedStyle(el).lineHeight) || 20;
      el.scrollTop = Math.max(0, (n - 4) * lh);
    },
    focus: () => ta.current!.focus(),
    get scrollTop() {
      return ta.current!.scrollTop;
    },
    set scrollTop(v: number) {
      ta.current!.scrollTop = v;
    },
  }));

  return (
    <>
      <div className="keys" aria-label="Swara keyboard">
        {KEYS.map(([label, ins, title]) => (
          <button
            key={label}
            type="button"
            className={label.endsWith(':') ? 'wide' : undefined}
            title={title}
            onPointerDown={(e) => e.preventDefault() /* keep the on-screen keyboard open */}
            onClick={() => {
              const el = ta.current!;
              const a = el.selectionStart;
              const before = el.value.slice(0, a);
              const needsSpace = /^[srgmpdn,;()|_]/.test(ins) && before && !/[\s(]$/.test(before);
              replaceRange(a, el.selectionEnd, (needsSpace ? ' ' : '') + ins);
            }}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          className="wide letters-key"
          title="Similar-sounding letters and how to type them"
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => onShortcut('letters')}
        >
          Letters
        </button>
      </div>
      <textarea
        ref={ta}
        id="input"
        defaultValue={initialValue}
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        wrap="off"
        aria-label="Notation input"
        onInput={(e) => onInput(e.currentTarget.value)}
        onPaste={(e) => {
          const original = e.clipboardData.getData('text/plain');
          if (!original || !hasIndic(original)) return; // ordinary paste
          e.preventDefault();
          const el = e.currentTarget;
          const start = el.selectionStart;
          const lineStart = el.value.lastIndexOf('\n', start - 1) + 1;
          const before = el.value.slice(lineStart, start);
          const intoSwaras = /^\s*S\s*:/i.test(before);
          const c = convertPasted(original, intoSwaras);
          replaceRange(start, el.selectionEnd, c.text);
          onPasteConverted?.({ start, original, converted: c.text, scriptName: c.scriptName, languageWord: c.languageWord });
        }}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            onShortcut('update');
          } else if ((e.ctrlKey || e.metaKey) && (e.key === '/' || e.code === 'Slash')) {
            e.preventDefault();
            const el = e.currentTarget;
            const c = toggleLineComments(el.value, el.selectionStart, el.selectionEnd);
            replaceRange(c.start, c.end, c.text);
            el.setSelectionRange(c.selStart, c.selEnd);
          } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
            e.preventDefault();
            onShortcut(e.shiftKey ? 'saveAs' : 'save'); // Ctrl+Shift+S: save a copy elsewhere
          } else if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
            const el = e.currentTarget;
            if (el.selectionStart !== el.selectionEnd) return;
            const li = lineInfo();
            const c = complete(li.text.slice(0, li.col));
            if (c) {
              e.preventDefault();
              replaceRange(el.selectionStart - c.remove, el.selectionStart, c.insert);
            }
          }
        }}
      />
    </>
  );
});
