/*
 * Version history: earlier versions of the notation, kept in this browser.
 * SPDX-License-Identifier: GPL-2.0-only
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal } from '../components/Modal';
import { Icon } from '../components/Icons';
import { parse, render } from '../engine';
import { clearHistory, EVERY_MINUTES, loadHistory, MAX_VERSIONS, type Snapshot } from '../lib/history';

const day = (t: number) => {
  const d = new Date(t);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
};
const time = (t: number) => new Date(t).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

/** How different a version is from the current text, in lines (a quick measure). */
function changes(from: string, to: string): string {
  const count = (xs: string[]) => xs.reduce((m, x) => m.set(x, (m.get(x) || 0) + 1), new Map<string, number>());
  const ca = count(from.split('\n'));
  const cb = count(to.split('\n'));
  let diff = 0;
  for (const [line, n] of ca) diff += Math.max(0, n - (cb.get(line) || 0));
  for (const [line, n] of cb) diff += Math.max(0, n - (ca.get(line) || 0));
  return diff ? diff + (diff === 1 ? ' line differs' : ' lines differ') + ' from now' : 'the same as now';
}

function SheetPreview({ text }: { text: string }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (el.current) render(parse(text), el.current, { emptyText: 'This version is empty.' });
  }, [text]);
  return <div ref={el} className="history-sheet" />;
}

export function HistoryDialog({ open, onClose, current, onRestore }: { open: boolean; onClose: () => void; current: string; onRestore: (s: Snapshot) => void }) {
  const [list, setList] = useState<Snapshot[]>([]);
  const [picked, setPicked] = useState(0);
  const [confirmClear, setConfirmClear] = useState(false);
  useEffect(() => {
    if (!open) return;
    setList(loadHistory());
    setPicked(0);
    setConfirmClear(false);
  }, [open]);
  const sel = list[picked];
  const groups = useMemo(() => {
    const out: { day: string; items: { s: Snapshot; i: number }[] }[] = [];
    list.forEach((s, i) => {
      const d = day(s.t);
      if (!out.length || out[out.length - 1].day !== d) out.push({ day: d, items: [] });
      out[out.length - 1].items.push({ s, i });
    });
    return out;
  }, [list]);

  return (
    <Modal
      title="Version history"
      open={open}
      onClose={onClose}
      wide={list.length > 0}
      footer={
        <>
          {list.length > 0 &&
            (confirmClear ? (
              <button
                type="button"
                className="danger"
                onClick={() => {
                  clearHistory();
                  setList([]);
                  setConfirmClear(false);
                }}
              >
                Delete all {list.length} versions
              </button>
            ) : (
              <button type="button" onClick={() => setConfirmClear(true)}>
                Clear history…
              </button>
            ))}
          <span className="spacer" />
          <button type="button" className={list.length ? undefined : 'primary'} onClick={onClose}>
            Done
          </button>
          {list.length > 0 && (
            <button type="button" className="primary" disabled={!sel || sel.text === current} onClick={() => sel && onRestore(sel)}>
              Restore this version
            </button>
          )}
        </>
      }
    >
      {list.length === 0 ? (
        <div className="empty-state">
          <Icon name="history" />
          <h3>No Earlier Versions</h3>
          <p>
            As you work, a version is kept every {EVERY_MINUTES} minutes, each time you save, and before anything replaces the notation (opening a file, an example or a new song). They stay
            in this browser only.
          </p>
        </div>
      ) : (
        <div className="history">
          <ul className="history-list" role="listbox" aria-label="Versions">
            {groups.map((g) => (
              <li key={g.day} className="history-day">
                <span className="history-day-name">{g.day}</span>
                <ul>
                  {g.items.map(({ s, i }) => (
                    <li key={s.t + ':' + i}>
                      <button type="button" role="option" aria-selected={i === picked} className={i === picked ? 'on' : ''} onClick={() => setPicked(i)}>
                        <span className="history-time">{time(s.t)}</span>
                        <span className="history-title">{s.title}</span>
                        {s.reason && <span className="history-reason">{s.reason}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          {sel && (
            <div className="history-view">
              <p className="hint">
                {day(sel.t)} at {time(sel.t)} · {changes(sel.text, current)}
              </p>
              <SheetPreview text={sel.text} />
            </div>
          )}
        </div>
      )}
      {list.length > 0 && (
        <p className="hint history-note">
          Kept in this browser only, up to {MAX_VERSIONS} versions. Restoring keeps what you have now as a version too, so nothing is lost.
        </p>
      )}
    </Modal>
  );
}
