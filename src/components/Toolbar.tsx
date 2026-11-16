import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icons';

export type Command =
  | 'new' | 'open' | 'save' | 'saveAs' | 'history' | 'assist' | 'letters' | 'update' | 'align' | 'photo'
  | 'examples' | 'share' | 'exportPdf' | 'print' | 'tour';

interface Item {
  cmd: Command | 'help';
  label: string;
  title: string;
  icon: string;
  only?: 'web' | 'desktop';
  prominent?: boolean;
  /** used less often: moves into the More menu when the window is narrow ('phone': only on phones) */
  secondary?: true | 'phone';
}

// Grouped like a macOS toolbar: document, editing, reading, output
const GROUPS: Item[][] = [
  [
    { cmd: 'new', label: 'New', title: 'New song (⌘N)', icon: 'new' },
    { cmd: 'open', label: 'Open', title: 'Open a notation file (⌘O)', icon: 'open' },
    { cmd: 'save', label: 'Save', title: 'Save to a file on your device (⌘S; ⇧⌘S to save a copy elsewhere)', icon: 'save' },
    { cmd: 'history', label: 'History', title: 'Earlier versions of this notation, kept in this browser', icon: 'history', secondary: true },
  ],
  [
    { cmd: 'assist', label: 'Assist', title: 'Help with the directive on this line', icon: 'assist' },
    { cmd: 'letters', label: 'Letters', title: 'Similar-sounding letters and how to type them (ര or റ?)', icon: 'letters', secondary: true },
    { cmd: 'align', label: 'Align', title: 'Line up lyrics under their swaras', icon: 'align', secondary: true },
    { cmd: 'examples', label: 'Examples', title: 'Open an example', icon: 'examples', secondary: true },
  ],
  [{ cmd: 'photo', label: 'Read Photo', title: 'Read handwritten notation from a photo', icon: 'photo', prominent: true }],
  [
    { cmd: 'share', label: 'Share', title: 'Copy a link to this notation', icon: 'share', only: 'web' },
    { cmd: 'exportPdf', label: 'PDF', title: 'Export as PDF (⌘E)', icon: 'pdf', only: 'desktop' },
    { cmd: 'print', label: 'Print', title: 'Print (⌘P)', icon: 'print', secondary: 'phone' },
    { cmd: 'tour', label: 'Tour', title: 'A quick guided tour: what each button does', icon: 'tour', secondary: true },
    { cmd: 'help', label: 'Help', title: 'Manual and syntax reference', icon: 'help', secondary: true },
  ],
];

const HELP_URL = 'docs/manual.html';

export function Toolbar({ onCommand, desktop }: { onCommand: (c: Command) => void; desktop: boolean }) {
  const groups = GROUPS.map((g) => g.filter((it) => !it.only || (it.only === 'desktop') === desktop));
  const secondary = groups.flat().filter((it) => it.secondary);
  return (
    <nav className="toolbar" aria-label="Commands">
      {groups.map((group, gi) => (
        <div key={gi} className={'tb-group' + (group.every((it) => it.secondary) ? ' all-secondary' : '')} role="group">
          {group.map((it) =>
            it.cmd === 'help' ? (
              <a key={it.cmd} data-tour="help" className="tb-btn tb-secondary" href={HELP_URL} target="_blank" rel="noopener" title={it.title} aria-label={it.label}>
                <Icon name={it.icon} />
                <span className="tb-label">{it.label}</span>
              </a>
            ) : (
              <button
                key={it.cmd}
                type="button"
                data-tour={it.cmd}
                className={'tb-btn' + (it.prominent ? ' prominent' : '') + (it.secondary === 'phone' ? ' tb-secondary-phone' : it.secondary ? ' tb-secondary' : '')}
                title={it.title}
                aria-label={it.label}
                onClick={() => onCommand(it.cmd as Command)}
              >
                <Icon name={it.icon} />
                <span className="tb-label">{it.label}</span>
              </button>
            ),
          )}
        </div>
      ))}
      <MoreMenu items={secondary} onCommand={onCommand} />
    </nav>
  );
}

/** "More": the less-used commands, when the window is too narrow to show them all. */
function MoreMenu({ items, onCommand }: { items: Item[]; onCommand: (c: Command) => void }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent) {
        if (e.key !== 'Escape') return;
        button.current?.focus();
      } else if (menu.current?.contains(e.target as Node) || button.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const away = () => setOpen(false);
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    window.addEventListener('resize', away);
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
      window.removeEventListener('resize', away);
    };
  }, [open]);

  const choose = (it: Item) => {
    setOpen(false);
    if (it.cmd === 'help') window.open(HELP_URL, '_blank', 'noopener');
    else onCommand(it.cmd as Command);
  };

  return (
    <div className="tb-group tb-more-group">
      <button
        ref={button}
        type="button"
        data-tour="more"
        className="tb-btn tb-more"
        title="More commands"
        aria-label="More"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          const r = button.current!.getBoundingClientRect();
          setPos({ top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right) });
          setOpen(!open);
        }}
      >
        <Icon name="more" />
        <span className="tb-label">More</span>
      </button>
      {open && (
        <div
          ref={menu}
          className="menu"
          role="menu"
          style={{ top: pos.top, right: pos.right }}
          onKeyDown={(e) => {
            // arrow keys move between the items
            if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
            e.preventDefault();
            const all = [...menu.current!.querySelectorAll<HTMLElement>('[role="menuitem"]')];
            const i = all.indexOf(document.activeElement as HTMLElement);
            all[(i + (e.key === 'ArrowDown' ? 1 : all.length - 1)) % all.length]?.focus();
          }}
        >
          {items.map((it) => (
            <button key={it.cmd} type="button" role="menuitem" className={it.secondary === 'phone' ? 'menu-phone' : undefined} onClick={() => choose(it)}>
              <Icon name={it.icon} />
              <span>
                <b>{it.label}</b>
                <small>{it.title}</small>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
