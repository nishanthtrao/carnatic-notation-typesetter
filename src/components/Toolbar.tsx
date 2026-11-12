import { Icon } from './Icons';

export type Command =
  | 'new' | 'open' | 'save' | 'saveAs' | 'assist' | 'update' | 'align' | 'photo'
  | 'examples' | 'share' | 'exportPdf' | 'print';

interface Item {
  cmd: Command | 'help';
  label: string;
  title: string;
  icon: string;
  only?: 'web' | 'desktop';
  prominent?: boolean;
}

// Grouped like a macOS toolbar: document, editing, reading, output
const GROUPS: Item[][] = [
  [
    { cmd: 'new', label: 'New', title: 'New song (⌘N)', icon: 'new' },
    { cmd: 'open', label: 'Open', title: 'Open a notation file (⌘O)', icon: 'open' },
    { cmd: 'save', label: 'Save', title: 'Save (⌘S)', icon: 'save' },
  ],
  [
    { cmd: 'assist', label: 'Assist', title: 'Help with the directive on this line', icon: 'assist' },
    { cmd: 'align', label: 'Align', title: 'Line up lyrics under their swaras', icon: 'align' },
    { cmd: 'examples', label: 'Examples', title: 'Open an example', icon: 'examples' },
  ],
  [{ cmd: 'photo', label: 'Read Photo', title: 'Read handwritten notation from a photo', icon: 'photo', prominent: true }],
  [
    { cmd: 'share', label: 'Share', title: 'Copy a link to this notation', icon: 'share', only: 'web' },
    { cmd: 'exportPdf', label: 'PDF', title: 'Export as PDF (⌘E)', icon: 'pdf', only: 'desktop' },
    { cmd: 'print', label: 'Print', title: 'Print (⌘P)', icon: 'print' },
    { cmd: 'help', label: 'Help', title: 'Manual and syntax reference', icon: 'help' },
  ],
];

export function Toolbar({ onCommand, desktop }: { onCommand: (c: Command) => void; desktop: boolean }) {
  return (
    <nav className="toolbar" aria-label="Commands">
      {GROUPS.map((group, gi) => (
        <div key={gi} className="tb-group" role="group">
          {group
            .filter((it) => !it.only || (it.only === 'desktop') === desktop)
            .map((it) =>
              it.cmd === 'help' ? (
                <a key={it.cmd} className="tb-btn" href="docs/manual.html" target="_blank" rel="noopener" title={it.title} aria-label={it.label}>
                  <Icon name={it.icon} />
                  <span className="tb-label">{it.label}</span>
                </a>
              ) : (
                <button
                  key={it.cmd}
                  type="button"
                  className={'tb-btn' + (it.prominent ? ' prominent' : '')}
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
    </nav>
  );
}
