import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

/** One stop on the tour. With no target it is a card in the middle of the window. */
interface Stop {
  /** data-tour names to point at, first one that is on screen wins */
  targets?: string[];
  title: string;
  body: string;
  /** on phones, which side to show first */
  view?: 'notation' | 'text';
  /** put the card inside the target (for the two big panes) */
  inside?: boolean;
}

const STOPS: Stop[] = [
  {
    title: 'Welcome',
    body: 'This typesets Carnatic music notation: you type swaras and sahitya as plain text, and it draws a neat page you can print or share. The tour takes about a minute.',
  },
  {
    targets: ['editor'],
    view: 'text',
    inside: true,
    title: 'Type your notation here',
    body: 'Lines starting with S: are swaras and lines starting with L: are the sahitya under them. Header lines such as Tala: and Raga: set up the song. A new song starts with sample lines you can replace.',
  },
  {
    targets: ['preview'],
    view: 'notation',
    inside: true,
    title: 'See it typeset',
    body: 'The page is redrawn as you type. Click a line of notation to jump to the text that made it.',
  },
  {
    targets: ['view'],
    title: 'Notation or Text',
    body: 'On a small screen you see one at a time. Switch between the typeset page and the text here.',
  },
  {
    targets: ['new', 'open', 'save'],
    title: 'New, Open and Save',
    body: 'Start a new song, open a notation file from your device, or save your work as a file. Your work is also kept in this browser between visits.',
  },
  {
    targets: ['history'],
    title: 'History',
    body: 'Earlier versions of your notation, kept automatically while you work. Pick one to preview it and restore it.',
  },
  {
    targets: ['assist'],
    title: 'Assist',
    body: 'Not sure how to write something? Put the cursor on a line and press Assist: it shows a form for that line (tala, raga and scale, headings, fonts, language and more) and writes the text for you.',
  },
  {
    targets: ['letters'],
    title: 'Letters',
    body: 'A chart of similar-sounding letters and how to type them, for sahitya in Kannada, Tamil, Telugu, Malayalam or Devanagari.',
  },
  {
    targets: ['align'],
    title: 'Align',
    body: 'Lines up each syllable of sahitya under its swara in the text, so it is easier to read and correct.',
  },
  {
    targets: ['examples'],
    title: 'Examples',
    body: 'Ready-made songs showing what the typesetter can do. Open one, change it and see what happens: the quickest way to learn.',
  },
  {
    targets: ['photo'],
    title: 'Read Photo',
    body: 'Turns a photo of handwritten or printed notation into text you can edit. It uses an AI model with your own account, and you check the result before using it.',
  },
  {
    targets: ['share', 'exportPdf', 'print'],
    title: 'Share and Print',
    body: 'Share copies a link that opens this notation for someone else. Print makes a paper copy or a PDF; the page always prints on white.',
  },
  {
    targets: ['issues'],
    view: 'text',
    title: 'Problems are pointed out',
    body: 'If a line has a mistake, it gets an orange dot beside its number and is listed here. Click to go to the line.',
  },
  {
    targets: ['zoom'],
    view: 'notation',
    title: 'Zoom',
    body: 'Make the page bigger or smaller. You can also hold Ctrl or ⌘ and scroll.',
  },
  {
    targets: ['tour', 'help'],
    title: 'That’s the tour',
    body: 'Press Tour whenever you forget what a button does, and Help for the full manual with every directive explained.',
  },
];

const visible = (el: Element | null): el is HTMLElement => !!el && el.getClientRects().length > 0 && (el as HTMLElement).offsetWidth > 0;
const find = (name: string) => [...document.querySelectorAll('[data-tour="' + name + '"]')].find(visible) as HTMLElement | undefined;

interface Found {
  rect: DOMRect | null;
  /** the command is tucked away under More on this screen */
  underMore: boolean;
}

/** Where a stop points right now; null when it has nothing to point at on this screen. */
function locate(stop: Stop): Found | null {
  if (!stop.targets) return { rect: null, underMore: false };
  const els = stop.targets.map(find).filter(Boolean) as HTMLElement[];
  if (!els.length) {
    // these live in the toolbar; in a narrow window they are under More
    const more = find('more');
    const inToolbar = stop.targets.some((t) => document.querySelector('.toolbar [data-tour="' + t + '"]'));
    return more && inToolbar ? { rect: more.getBoundingClientRect(), underMore: true } : null;
  }
  const rs = els.map((e) => e.getBoundingClientRect());
  const l = Math.min(...rs.map((r) => r.left));
  const t = Math.min(...rs.map((r) => r.top));
  const r = Math.max(...rs.map((x) => x.right));
  const b = Math.max(...rs.map((x) => x.bottom));
  return { rect: new DOMRect(l, t, r - l, b - t), underMore: false };
}

/**
 * A guided tour: dims the window, lights up one control at a time and
 * explains it. Opens on a first visit (with a welcome) and from the Tour button.
 */
export function Tour({ open, onClose, onView }: { open: boolean; onClose: () => void; onView: (v: 'notation' | 'text') => void }) {
  const [i, setI] = useState(0);
  const [found, setFound] = useState<Found | null>({ rect: null, underMore: false });
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const stop = STOPS[i];

  useEffect(() => {
    if (open) setI(0);
  }, [open]);

  // move on to the next stop that exists on this screen
  const go = useCallback(
    (from: number, dir: 1 | -1) => {
      for (let n = from; n >= 0 && n < STOPS.length; n += dir) {
        if (!STOPS[n].targets || STOPS[n].view || locate(STOPS[n])) {
          setI(n);
          return;
        }
      }
      if (dir > 0) onClose();
    },
    [onClose],
  );

  const place = useCallback(() => {
    const f = locate(stop);
    setFound(f);
    return f;
  }, [stop]);

  useLayoutEffect(() => {
    if (!open) return;
    if (stop.view) onView(stop.view);
    // the view switch re-lays the page out; look once it has
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => {
        if (!place() && stop.targets) go(i + 1, 1);
      });
    });
    const again = () => place();
    window.addEventListener('resize', again);
    window.addEventListener('scroll', again, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', again);
      window.removeEventListener('scroll', again, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, i]);

  // place the card next to what it describes, inside the window
  useLayoutEffect(() => {
    const el = card.current;
    if (!open || !el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const m = 12;
    const r = found?.rect;
    if (!r) {
      setPos({ left: (vw - w) / 2, top: Math.max(m, (vh - h) / 2.4) });
      return;
    }
    let top: number;
    if (stop.inside) top = r.top + Math.min(r.height - h - m, Math.max(m, r.height * 0.18));
    else if (r.bottom + m + h <= vh - m) top = r.bottom + m;
    else if (r.top - m - h >= m) top = r.top - m - h;
    else top = vh - h - m;
    const left = r.left + r.width / 2 - w / 2;
    setPos({ left: Math.min(vw - w - m, Math.max(m, left)), top: Math.min(vh - h - m, Math.max(m, top)) });
  }, [open, found, i, stop.inside]);

  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight' || e.key === 'Enter') go(i + 1, 1);
      else if (e.key === 'ArrowLeft') go(i - 1, -1);
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('keydown', key, true);
    card.current?.querySelector<HTMLElement>('.primary')?.focus();
    return () => window.removeEventListener('keydown', key, true);
  }, [open, i, go, onClose]);

  // number only the stops this screen has (the Notation/Text switch is phone-only)
  const shown = useMemo(() => STOPS.map((_, n) => n).filter((n) => n > 0 && (STOPS[n].view || locate(STOPS[n]))), [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const count = STOPS.length;
  if (!open) return null;
  const r = found?.rect;
  const pad = stop.inside ? -4 : 6;
  const first = i === 0;
  const last = i === count - 1;
  return (
    <div className="tour" role="dialog" aria-modal="true" aria-label={'Tour: ' + stop.title}>
      <div className={'tour-shade' + (r ? '' : ' full')} style={r ? { left: r.left - pad, top: r.top - pad, width: r.width + pad * 2, height: r.height + pad * 2 } : undefined} />
      <div ref={card} className={'tour-card' + (first ? ' welcome' : '')} style={pos ? { left: pos.left, top: pos.top } : { visibility: 'hidden' }}>
        <h2>{stop.title}</h2>
        <p>{stop.body}</p>
        {found?.underMore && <p className="tour-note">On this screen it is under More (⋯).</p>}
        <div className="tour-foot">
          <span className="tour-count" aria-label={'Step ' + (i + 1) + ' of ' + count}>
            {first ? '' : shown.indexOf(i) + 1 + ' / ' + shown.length}
          </span>
          {!last && (
            <button type="button" className="tour-skip" onClick={onClose}>
              {first ? 'Not now' : 'Skip'}
            </button>
          )}
          {!first && (
            <button type="button" onClick={() => go(i - 1, -1)}>
              Back
            </button>
          )}
          <button type="button" className="primary" onClick={() => (last ? onClose() : go(i + 1, 1))}>
            {first ? 'Show me around' : last ? 'Done' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
