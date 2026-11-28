import { convertPasted, hasIndic } from '../lib/paste-convert';
import { toggleLineComments } from '../lib/comments';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { highlight } from '../lib/highlight';
import { complete } from '../lib/directives';
import { tipAt, type DirectiveTip } from '../lib/directive-tips';

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

/** A problem on a line, shown as a marker beside its number. */
export interface LineIssue {
  line: number;
  message: string;
}

interface Props {
  initialValue: string;
  /** problems found by the parser, marked in the line-number strip */
  issues?: LineIssue[];
  /** a marked line number was clicked */
  onIssue?: (issue: LineIssue) => void;
  onInput: (text: string) => void;
  onShortcut: (cmd: 'update' | 'save' | 'saveAs' | 'letters') => void;
  /** the S: line being edited (the one above, for an L: line), or null; for the preview to follow */
  onCursorLine?: (line: number | null) => void;
  /** pasted Indian-script text was converted; original kept for "Keep original" */
  onPasteConverted?: (info: { start: number; original: string; converted: string; scriptName: string; languageWord: string }) => void;
}

const KEYS: [string, string, string?][] = [
  ['s', 's '], ['r', 'r '], ['g', 'g '], ['m', 'm '], ['p', 'p '], ['d', 'd '], ['n', 'n '],
  ["'", "'", 'tara stayi (upper octave)'], ['`', '`', 'mandra stayi (lower octave)'],
  [',', ', '], [';', '; '], ['(', '( '], [')', ') '], ['|', '| '], ['||', '|| '], ['_', '_ '], ['~', '~'],
  ['S:', '\nS: '], ['L:', '\nL: '],
];

export const NotationEditor = forwardRef<EditorHandle, Props>(function NotationEditor({ initialValue, issues = [], onIssue, onInput, onShortcut, onPasteConverted, onCursorLine }, ref) {
  const ta = useRef<HTMLTextAreaElement>(null);
  const hl = useRef<HTMLPreElement>(null);
  const gutter = useRef<HTMLDivElement>(null);
  const numbers = useRef<HTMLDivElement>(null);
  const code = useRef<HTMLDivElement>(null);
  const issuesRef = useRef(issues);
  issuesRef.current = issues;
  const cursorCb = useRef(onCursorLine);
  cursorCb.current = onCursorLine;
  const reported = useRef<number | null>(null);
  /** Tell the preview which S: line the cursor is in: an L: line belongs to the S: line above it. */
  const reportLine = (focused = document.activeElement === ta.current) => {
    const el = ta.current;
    if (!el || !cursorCb.current) return;
    let owner: number | null = null;
    if (focused) {
      const lines = el.value.split('\n');
      let i = el.value.slice(0, el.selectionStart).split('\n').length - 1;
      while (i > 0 && /^\s*L\s*:/i.test(lines[i])) i--;
      if (/^\s*S\s*:/i.test(lines[i] || '')) owner = i + 1;
    }
    if (owner === reported.current) return;
    reported.current = owner;
    cursorCb.current(owner);
  };

  // Syntax colours: the text is drawn again, coloured, in a <pre> behind the
  // textarea (whose own text is transparent), scrolled in step with it.
  // Line numbers are drawn the same way, in a strip on the left.
  const sync = () => {
    if (!hl.current || !ta.current) return;
    hl.current.scrollTop = ta.current.scrollTop;
    hl.current.scrollLeft = ta.current.scrollLeft;
    if (numbers.current) numbers.current.style.transform = 'translateY(' + -ta.current.scrollTop + 'px)';
    // fade the right edge while some lines run on past it
    const t = ta.current;
    t.parentElement?.classList.toggle('more-right', t.scrollLeft + t.clientWidth < t.scrollWidth - 2);
  };
  /** The line-number strip, with a marker on each line that has a problem. */
  const paintNumbers = () => {
    if (!numbers.current || !ta.current) return;
    const count = ta.current.value.split('\n').length;
    const byLine = new Map<number, string[]>();
    for (const w of issuesRef.current) byLine.set(w.line, [...(byLine.get(w.line) || []), w.message]);
    const cur = currentLine();
    let html = '';
    for (let n = 1; n <= count; n++) {
      const msgs = byLine.get(n);
      const cls = 'ln' + (msgs ? ' issue' : '') + (n === cur ? ' cur' : '');
      const title = msgs ? ' title="' + msgs.join('\n').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;') + '"' : '';
      html += '<div class="' + cls + '" data-line="' + n + '"' + title + '>' + n + '</div>';
    }
    numbers.current.innerHTML = html;
    reportLine();
    code.current?.style.setProperty('--digits', String(Math.max(2, String(count).length)));
    shownLine.current = cur;
  };
  const currentLine = () => {
    const el = ta.current;
    return el ? el.value.slice(0, el.selectionStart).split('\n').length : 0;
  };
  // highlight the number of the line the cursor is on
  const shownLine = useRef(0);
  const markCurrent = () => {
    reportLine();
    const n = currentLine();
    if (n === shownLine.current || !numbers.current) return;
    numbers.current.children[shownLine.current - 1]?.classList.remove('cur');
    numbers.current.children[n - 1]?.classList.add('cur');
    shownLine.current = n;
  };
  const frame = useRef(0);
  const paint = () => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      if (!hl.current || !ta.current) return;
      hl.current.innerHTML = highlight(ta.current.value);
      paintNumbers();
      sync();
    });
  };
  useEffect(() => {
    paint();
    // the edge fade depends on the width too (turning a phone, switching to Text)
    const ro = typeof ResizeObserver !== 'undefined' && ta.current ? new ResizeObserver(() => sync()) : null;
    if (ro && ta.current) ro.observe(ta.current);
    return () => {
      cancelAnimationFrame(frame.current);
      ro?.disconnect();
    };
  }, []);
  // the problems change after each parse: redraw the markers
  useEffect(() => {
    paintNumbers();
  }, [issues]);

  // A one-glance explanation of a directive: shown when the mouse rests on
  // its name, or when a finger taps the name (phones have no hover).
  const tipBox = useRef<HTMLDivElement>(null);
  const tipTimer = useRef(0);
  const tipShown = useRef('');
  const metrics = () => {
    const el = ta.current!;
    const cs = getComputedStyle(el);
    const ctx = document.createElement('canvas').getContext('2d');
    if (ctx) ctx.font = cs.fontSize + ' ' + cs.fontFamily;
    return {
      lh: parseFloat(cs.lineHeight) || 20,
      cw: ctx?.measureText('0').width || parseFloat(cs.fontSize) * 0.6,
      pt: parseFloat(cs.paddingTop) || 0,
      pl: parseFloat(cs.paddingLeft) || 0,
    };
  };
  const hideTip = () => {
    clearTimeout(tipTimer.current);
    tipShown.current = '';
    if (tipBox.current) tipBox.current.hidden = true;
  };
  const showTip = (tip: DirectiveTip, line: number) => {
    const el = ta.current;
    const box = tipBox.current;
    if (!el || !box) return;
    const key = line + ':' + tip.name;
    if (tipShown.current === key && !box.hidden) return;
    tipShown.current = key;
    const { lh, cw, pt, pl } = metrics();
    box.replaceChildren(Object.assign(document.createElement('strong'), { textContent: tip.name }), ' ' + tip.text);
    box.hidden = false;
    const area = box.parentElement!;
    let left = pl + tip.from * cw - el.scrollLeft;
    left = Math.max(4, Math.min(left, area.clientWidth - box.offsetWidth - 8));
    let top = pt + (line + 1) * lh - el.scrollTop + 2;
    if (top + box.offsetHeight > area.clientHeight - 4) top = pt + line * lh - el.scrollTop - box.offsetHeight - 2;
    box.style.left = left + 'px';
    box.style.top = Math.max(2, top) + 'px';
  };
  /** The tip for the directive name under a point on the screen, if any. */
  const tipUnder = (x: number, y: number): [DirectiveTip, number] | null => {
    const el = ta.current!;
    const r = el.getBoundingClientRect();
    const { lh, cw, pt, pl } = metrics();
    const dy = y - r.top - pt + el.scrollTop;
    const dx = x - r.left - pl + el.scrollLeft;
    if (dy < 0 || dx < 0) return null;
    const line = Math.floor(dy / lh);
    const text = el.value.split('\n')[line];
    const tip = text === undefined ? null : tipAt(text, Math.floor(dx / cw));
    return tip && dx < tip.to * cw ? [tip, line] : null;
  };
  /** After a tap: the tip for the name the caret landed in. */
  const tipAtCaret = () => {
    const el = ta.current;
    if (!el || el.selectionStart !== el.selectionEnd) return hideTip();
    const li = lineInfo();
    const tip = tipAt(li.text, li.col);
    if (!tip) return hideTip();
    showTip(tip, li.index);
    clearTimeout(tipTimer.current);
    tipTimer.current = window.setTimeout(hideTip, 6000);
  };
  useEffect(() => () => clearTimeout(tipTimer.current), []);

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
      paint();
    }
  };

  useImperativeHandle(ref, () => ({
    getValue: () => ta.current!.value,
    setValue: (text) => {
      ta.current!.value = text;
      ta.current!.scrollTop = 0;
      paint();
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
      sync();
      markCurrent();
    },
    focus: () => ta.current!.focus(),
    get scrollTop() {
      return ta.current!.scrollTop;
    },
    set scrollTop(v: number) {
      ta.current!.scrollTop = v;
      sync();
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
      <div className="code" ref={code}>
      <div
        className="gutter"
        ref={gutter}
        aria-hidden="true"
        onClick={(e) => {
          const el = (e.target as HTMLElement).closest<HTMLElement>('.ln');
          if (!el) return;
          const n = +el.dataset.line!;
          const lines = ta.current!.value.split('\n');
          let pos = 0;
          for (let i = 0; i < n - 1; i++) pos += lines[i].length + 1;
          ta.current!.focus();
          ta.current!.setSelectionRange(pos, pos + lines[n - 1].length);
          markCurrent();
          const found = issuesRef.current.find((w) => w.line === n);
          if (found) onIssue?.(found);
        }}
      >
        <div className="numbers" ref={numbers} />
      </div>
      <div className="code-area">
      <pre ref={hl} className="hl" aria-hidden="true" />
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
        onInput={(e) => {
          hideTip();
          paint();
          onInput(e.currentTarget.value);
        }}
        onScroll={() => {
          sync();
          hideTip();
        }}
        onSelect={markCurrent}
        onKeyUp={markCurrent}
        onPointerUp={(e) => {
          markCurrent();
          if (e.pointerType !== 'mouse') window.setTimeout(tipAtCaret, 50);
        }}
        onPointerMove={(e) => {
          if (e.pointerType !== 'mouse') return;
          const hit = tipUnder(e.clientX, e.clientY);
          if (!hit) return hideTip();
          const key = hit[1] + ':' + hit[0].name;
          if (key === tipShown.current) return;
          clearTimeout(tipTimer.current);
          // show at once when moving from one name to the next; after a short rest otherwise
          if (tipBox.current && !tipBox.current.hidden) showTip(...hit);
          else tipTimer.current = window.setTimeout(() => showTip(...hit), 450);
        }}
        onPointerLeave={hideTip}
        onFocus={() => reportLine(true)}
        onBlur={(e) => {
          if (e.relatedTarget) hideTip();
          reportLine(false);
        }}
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
          hideTip();
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
      <div ref={tipBox} className="directive-tip" role="tooltip" hidden />
      </div>
      </div>
    </>
  );
});
