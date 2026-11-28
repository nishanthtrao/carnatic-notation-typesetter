/*
 * Search box for the Scale form: type any spelling of a raga's name (or a
 * melakarta number) and pick it; its name, arohanam and avarohanam fill in.
 * SPDX-License-Identifier: GPL-2.0-only
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { Raga } from '../lib/ragas';

type Ragas = typeof import('../lib/ragas');

export function RagaPicker({ onPick }: { onPick: (r: Raga) => void }) {
  const [lib, setLib] = useState<Ragas | null>(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [picked, setPicked] = useState<Raga | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const id = useId();
  useEffect(() => {
    let live = true;
    import('../lib/ragas').then((m) => live && setLib(m));
    return () => {
      live = false;
    };
  }, []);
  const results = useMemo(() => (lib ? lib.findRagas(query, 40) : []), [lib, query]);
  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const choose = (r: Raga) => {
    setPicked(r);
    onPick(r);
  };
  const where = (r: Raga) =>
    r.melakarta ? 'Melakarta ' + r.mela : 'Janya of ' + r.mela + ' ' + (lib?.melaName(r.mela) ?? '') + (r.hindustani ? ' · Hindustani' : '');

  return (
    <div className="raga-picker">
      <input
        type="search"
        id={id + '-q'}
        role="combobox"
        aria-expanded="true"
        aria-controls={id + '-list'}
        aria-activedescendant={results[active] ? id + '-o' + active : undefined}
        aria-label="Search ragas"
        placeholder={lib ? 'Search ' + lib.RAGA_COUNT + ' ragas: name or melakarta number' : 'Loading ragas…'}
        value={query}
        autoComplete="off"
        spellCheck={false}
        autoCapitalize="off"
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, results.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === 'Enter' && results[active]) {
            e.preventDefault();
            choose(results[active]);
          }
        }}
      />
      <ul className="raga-results" id={id + '-list'} role="listbox" ref={listRef} aria-label={query ? 'Matching ragas' : 'Well-known ragas'}>
        {results.map((r, i) => (
          <li
            key={r.name + r.mela}
            id={id + '-o' + i}
            role="option"
            aria-selected={i === active}
            className={picked === r ? 'picked' : undefined}
            onMouseEnter={() => setActive(i)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => choose(r)}
          >
            <span className="raga-name">{r.name}</span>
            <span className="raga-where">{where(r)}</span>
            <span className="raga-scale">
              {r.aro} <span aria-hidden="true">·</span> {r.ava}
            </span>
          </li>
        ))}
        {lib && !results.length && <li className="raga-none">No raga by that name. Type the scale below yourself.</li>}
      </ul>
      {picked && <p className="hint raga-note">Filled in from {picked.name}. Schools differ on some ragas: change the scale below if yours is different.</p>}
    </div>
  );
}
