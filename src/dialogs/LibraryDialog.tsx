/*
 * Library: the songs kept on this device.
 * SPDX-License-Identifier: GPL-2.0-only
 */
import { useMemo, useRef, useState } from 'react';
import { Modal } from '../components/Modal';
import { Icon } from '../components/Icons';
import { ago, listSongs, matches, songMeta, type Song } from '../lib/library';

export function LibraryDialog({
  open,
  currentId,
  version,
  onClose,
  onOpen,
  onNew,
  onDuplicate,
  onDelete,
  onImportFiles,
  onBackup,
  onRestore,
  undo,
}: {
  open: boolean;
  currentId: string | null;
  /** bump to re-read the list after changes */
  version: number;
  onClose: () => void;
  onOpen: (song: Song) => void;
  onNew: () => void;
  onDuplicate: (song: Song) => void;
  onDelete: (song: Song) => void;
  onImportFiles: (files: File[]) => void;
  onBackup: () => void;
  onRestore: (file: File) => void;
  /** "Deleted X" with an Undo button, shown inside the window */
  undo?: { message: string; run: () => void } | null;
}) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'recent' | 'title'>('recent');
  const filesRef = useRef<HTMLInputElement>(null);
  const backupRef = useRef<HTMLInputElement>(null);
  const songs = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    version;
    const list = listSongs().filter((s) => matches(s, q));
    if (sort === 'title') list.sort((a, b) => songMeta(a.text).title.localeCompare(songMeta(b.text).title));
    return list;
  }, [q, sort, version, open]);
  const total = useMemo(() => listSongs().length, [version, open]);

  return (
    <Modal
      title="Library"
      open={open}
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" onClick={() => filesRef.current?.click()}>Import files…</button>
          <button type="button" onClick={onBackup} disabled={!total}>Back up all</button>
          <button type="button" onClick={() => backupRef.current?.click()}>Restore…</button>
          <button type="button" className="primary" onClick={onNew}>New song</button>
        </>
      }
    >
      <div className="lib-top">
        <input type="search" placeholder="Search title, raga, tala, composer or words" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search songs" />
        <div className="segmented" role="tablist" aria-label="Sort">
          <button type="button" role="tab" aria-selected={sort === 'recent'} onClick={() => setSort('recent')}>Recent</button>
          <button type="button" role="tab" aria-selected={sort === 'title'} onClick={() => setSort('title')}>A–Z</button>
        </div>
      </div>

      {undo && (
        <div className="lib-undo" role="status">
          <span>{undo.message}</span>
          <button type="button" onClick={undo.run}>Undo</button>
        </div>
      )}
      {!total ? (
        <div className="lib-empty">
          <p><b>No songs yet.</b></p>
          <p>Songs are saved here automatically as you type. Start a new song, or import notation files you already have.</p>
        </div>
      ) : !songs.length ? (
        <p className="hint">No song matches “{q}”.</p>
      ) : (
        <ul className="lib-list">
          {songs.map((s) => {
            const m = songMeta(s.text);
            const sub = [m.raga, m.tala, m.composer].filter(Boolean).join(' · ');
            const current = s.id === currentId;
            return (
              <li key={s.id} className={current ? 'current' : ''}>
                <button type="button" className="lib-open" onClick={() => onOpen(s)} title={current ? 'This song is open' : 'Open ' + m.title}>
                  <span className="lib-title">
                    {m.title}
                    {current && <span className="lib-badge">Open</span>}
                  </span>
                  <span className="lib-sub">{sub || '—'}</span>
                  <span className="lib-when">{ago(s.updated)}</span>
                </button>
                <button type="button" className="lib-icon" title="Duplicate" aria-label={'Duplicate ' + m.title} onClick={() => onDuplicate(s)}>
                  <Icon name="duplicate" />
                </button>
                <button type="button" className="lib-icon danger" title="Delete" aria-label={'Delete ' + m.title} onClick={() => onDelete(s)}>
                  <Icon name="trash" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="hint">
        {total} {total === 1 ? 'song' : 'songs'} on this device, saved as you type. They stay in this browser only: use <b>Back up all</b> now and then, and{' '}
        <b>Restore</b> to bring them to another device.
      </p>

      <input
        ref={filesRef}
        type="file"
        multiple
        accept=".cmnt,.txt,text/plain"
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          e.target.value = '';
          if (files.length) onImportFiles(files);
        }}
      />
      <input
        ref={backupRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) onRestore(f);
        }}
      />
    </Modal>
  );
}
