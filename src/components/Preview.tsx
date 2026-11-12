import { useEffect, useLayoutEffect, useRef } from 'react';
import { render, type NotationDoc, type RenderHandle } from '../engine';

/** The typeset sheet. Rendering is done by the engine directly into the DOM. */
export function Preview({ doc, onJumpToLine, landscape }: { doc: NotationDoc; onJumpToLine?: (line: number) => void; landscape?: boolean }) {
  const sheet = useRef<HTMLDivElement>(null);
  const handle = useRef<RenderHandle | null>(null);

  useLayoutEffect(() => {
    if (sheet.current) handle.current = render(doc, sheet.current, { emptyText: 'Type your notation below, or open an example.' });
  }, [doc]);

  useEffect(() => {
    const el = sheet.current;
    if (!el) return;
    let raf = 0;
    const refit = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => handle.current?.refit());
    };
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(refit) : null;
    ro?.observe(el);
    // text is measured for layout, so lay out again once web fonts arrive
    let fontTimer = 0;
    const relayout = () => {
      clearTimeout(fontTimer);
      fontTimer = window.setTimeout(() => handle.current?.refit(true), 50);
    };
    document.fonts?.ready.then(relayout);
    document.fonts?.addEventListener?.('loadingdone', relayout);
    const beforePrint = () => handle.current?.refit();
    window.addEventListener('beforeprint', beforePrint);
    return () => {
      ro?.disconnect();
      document.fonts?.removeEventListener?.('loadingdone', relayout);
      window.removeEventListener('beforeprint', beforePrint);
    };
  }, []);

  return (
    <div className={'paper' + (landscape ? ' landscape' : '')}>
      <div
        ref={sheet}
        className="cm-sheet"
        onClick={(e) => {
          const st = (e.target as HTMLElement).closest<HTMLElement>('.cm-staff[data-line]');
          if (!st || window.getSelection()?.toString()) return;
          onJumpToLine?.(+st.dataset.line!);
          st.classList.remove('flash');
          void st.offsetWidth;
          st.classList.add('flash');
        }}
      />
    </div>
  );
}
