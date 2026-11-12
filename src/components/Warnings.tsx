import { useEffect, useState } from 'react';
import type { Warning } from '../engine';
import { Icon } from './Icons';

/** Issues badge for the editor footer, with an expandable list (like Xcode's). */
export function IssuesBadge({ list, open, onToggle }: { list: Warning[]; open: boolean; onToggle: () => void }) {
  if (!list.length) {
    return (
      <span className="issues ok" title="No problems found">
        <Icon name="check" />
        No issues
      </span>
    );
  }
  return (
    <button type="button" className={'issues bad' + (open ? ' open' : '')} onClick={onToggle} aria-expanded={open} title="Show problems">
      <Icon name="warn" />
      {list.length === 1 ? '1 issue' : list.length + ' issues'}
    </button>
  );
}

export function IssuesList({ list, open, onJump }: { list: Warning[]; open: boolean; onJump: (line: number) => void }) {
  const [shown, setShown] = useState(open);
  useEffect(() => setShown(open), [open]);
  if (!list.length || !shown) return null;
  return (
    <ul className="warnings" aria-live="polite">
      {list.slice(0, 50).map((w, i) => (
        <li key={i} onClick={() => onJump(w.line)}>
          <b>Line {w.line}</b>
          {w.message}
        </li>
      ))}
      {list.length > 50 && <li>… and {list.length - 50} more</li>}
    </ul>
  );
}
