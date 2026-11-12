import { useRef } from 'react';

/** Drag handle between the two panes; value is the first pane's size in percent. */
export function Splitter({
  value,
  onChange,
  container,
  orientation,
}: {
  value: number;
  onChange: (pct: number) => void;
  container: React.RefObject<HTMLElement | null>;
  orientation: 'vertical' | 'horizontal';
}) {
  const dragging = useRef(false);
  const set = (pct: number) => onChange(Math.max(18, Math.min(82, pct)));
  const vertical = orientation === 'vertical';
  return (
    <div
      className={'splitter ' + orientation}
      role="separator"
      aria-orientation={vertical ? 'vertical' : 'horizontal'}
      aria-label="Drag to resize"
      aria-valuenow={Math.round(value)}
      tabIndex={0}
      onPointerDown={(e) => {
        dragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        e.preventDefault();
      }}
      onPointerMove={(e) => {
        if (!dragging.current || !container.current) return;
        const r = container.current.getBoundingClientRect();
        set(vertical ? ((e.clientX - r.left) / r.width) * 100 : ((e.clientY - r.top) / r.height) * 100);
      }}
      onPointerUp={() => (dragging.current = false)}
      onPointerCancel={() => (dragging.current = false)}
      onKeyDown={(e) => {
        const back = vertical ? 'ArrowLeft' : 'ArrowUp';
        const fwd = vertical ? 'ArrowRight' : 'ArrowDown';
        if (e.key === back) set(value - 4);
        else if (e.key === fwd) set(value + 4);
        else return;
        e.preventDefault();
      }}
    >
      <span />
    </div>
  );
}
