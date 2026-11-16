import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { render, type NotationDoc, type RenderHandle } from '../engine';
import { store } from '../lib/storage';
import { Icon } from './Icons';

const ZOOM_KEY = 'cmnt.v3.zoom';
const MIN = 0.5;
const MAX = 3;
const STEPS = [0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3];
const clamp = (z: number) => Math.min(MAX, Math.max(MIN, Math.round(z * 100) / 100));

/** Where to keep still while zooming: a point on the page and where it is on screen. */
interface Anchor {
  fx: number;
  fy: number;
  vx: number;
  vy: number;
}

/**
 * The typeset sheet, with zoom. Rendering is done by the engine directly into
 * the DOM. Zooming scales the page as drawn (the layout stays the same, the
 * way it will print); printing ignores it.
 */
export function Preview({ doc, onJumpToLine, landscape, zoomable }: { doc: NotationDoc; onJumpToLine?: (line: number) => void; landscape?: boolean; zoomable?: boolean }) {
  const sheet = useRef<HTMLDivElement>(null);
  const paper = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const handle = useRef<RenderHandle | null>(null);
  const [zoom, setZoomState] = useState(() => {
    if (!zoomable) return 1;
    const z = parseFloat(store.get(ZOOM_KEY) || '1');
    return Number.isFinite(z) ? clamp(z) : 1;
  });
  const [size, setSize] = useState({ w: 0, h: 0 }); // the page's own size, unzoomed
  const anchor = useRef<Anchor | null>(null);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

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

  // the page's width when it fits (the pane, up to the page's largest width) and its height
  useEffect(() => {
    const sc = scroller.current;
    const pp = paper.current;
    if (!sc || !pp || typeof ResizeObserver !== 'function') return;
    const measure = () => {
      const cs = getComputedStyle(sc);
      const avail = sc.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const most = parseFloat(getComputedStyle(pp).maxWidth) || Infinity;
      const w = Math.max(200, Math.floor(Math.min(avail, most)));
      const h = pp.offsetHeight;
      setSize((s) => (s.w === w && s.h === h ? s : { w, h }));
    };
    const ro = new ResizeObserver(measure);
    ro.observe(sc);
    ro.observe(pp);
    return () => ro.disconnect();
  }, [landscape]);

  const anchorAt = (clientX: number, clientY: number): Anchor | null => {
    const sc = scroller.current;
    const target = zoomRef.current === 1 ? paper.current : box.current;
    if (!sc || !target) return null;
    const b = target.getBoundingClientRect();
    const p = sc.getBoundingClientRect();
    return { fx: (clientX - b.left) / (b.width || 1), fy: (clientY - b.top) / (b.height || 1), vx: clientX - p.left, vy: clientY - p.top };
  };
  const anchorAtCentre = () => {
    const p = scroller.current?.getBoundingClientRect();
    return p ? anchorAt(p.left + p.width / 2, p.top + Math.min(p.height / 2, 200)) : null;
  };

  const setZoom = (z: number, a: Anchor | null = anchorAtCentre()) => {
    const next = clamp(z);
    if (next === zoomRef.current) return;
    anchor.current = a;
    zoomRef.current = next;
    setZoomState(next);
    store.set(ZOOM_KEY, String(next));
  };

  // keep the anchored point where it was on screen
  useLayoutEffect(() => {
    const a = anchor.current;
    const sc = scroller.current;
    const target = zoom === 1 ? paper.current : box.current;
    anchor.current = null;
    if (!a || !sc || !target) return;
    const b = target.getBoundingClientRect();
    const p = sc.getBoundingClientRect();
    sc.scrollLeft += b.left + a.fx * b.width - (p.left + a.vx);
    sc.scrollTop += b.top + a.fy * b.height - (p.top + a.vy);
  }, [zoom, size]);

  // ⌘/Ctrl + wheel, and pinch on a trackpad (which arrives as Ctrl + wheel)
  useEffect(() => {
    const sc = scroller.current;
    if (!sc || !zoomable) return;
    const wheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      setZoom(zoomRef.current * Math.exp(-Math.max(-120, Math.min(120, dy)) * 0.0022), anchorAt(e.clientX, e.clientY));
    };
    sc.addEventListener('wheel', wheel, { passive: false });
    return () => sc.removeEventListener('wheel', wheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const step = (dir: 1 | -1) => {
    const z = zoomRef.current;
    const next = dir > 0 ? STEPS.find((s) => s > z + 0.001) : [...STEPS].reverse().find((s) => s < z - 0.001);
    setZoom(next ?? (dir > 0 ? MAX : MIN));
  };

  const fit = zoom === 1;
  const ready = size.w > 0;
  return (
    <>
      <div ref={scroller} className="preview-scroll">
        <div
          ref={box}
          className={'zoom-box' + (fit || !ready ? ' fit' : '')}
          style={fit || !ready ? undefined : { width: size.w * zoom, height: size.h * zoom }}
        >
          <div
            ref={paper}
            className={'paper' + (landscape ? ' landscape' : '') + (fit || !ready ? '' : ' zoomed')}
            style={fit || !ready ? undefined : { width: size.w, transform: `scale(${zoom})` }}
          >
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
        </div>
      </div>
      {zoomable && (
        <div className="zoom-pill" role="group" aria-label="Zoom">
          <button type="button" title="Zoom out (⌘/Ctrl + scroll)" aria-label="Zoom out" disabled={zoom <= MIN} onClick={() => step(-1)}>
            <Icon name="zoomout" />
          </button>
          <button type="button" className="zoom-value" title="Back to fit the window" aria-label={'Zoom ' + Math.round(zoom * 100) + '%, reset to fit'} onClick={() => setZoom(1)}>
            {fit ? 'Fit' : Math.round(zoom * 100) + '%'}
          </button>
          <button type="button" title="Zoom in (⌘/Ctrl + scroll)" aria-label="Zoom in" disabled={zoom >= MAX} onClick={() => step(1)}>
            <Icon name="zoomin" />
          </button>
        </div>
      )}
    </>
  );
}
