/*
 * Carnatic Music Notation Typesetter — the editor application
 * SPDX-License-Identifier: GPL-2.0-only
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { examples, newSongTemplate, parse, type Example, type NotationDoc } from '../engine';
import { NotationEditor, type EditorHandle } from '../components/NotationEditor';
import { Preview } from '../components/Preview';
import { Splitter } from '../components/Splitter';
import { Toolbar, type Command } from '../components/Toolbar';
import { useToast } from '../components/Toast';
import { IssuesBadge, IssuesList } from '../components/Warnings';
import { Icon } from '../components/Icons';
import { AssistDialog, assistModeFor, type AssistMode, type FormName } from '../dialogs/AssistDialog';
import { useConfirm } from '../dialogs/ConfirmDialog';
import { CopyTextDialog } from '../dialogs/CopyTextDialog';
import { LettersDialog, type LettersContext } from '../dialogs/LettersDialog';
import { lettersContext } from '../lib/letters-context';
import { useInstallPrompt } from '../lib/install';
import { AboutDialog } from '../dialogs/AboutDialog';
import { ExamplesDialog } from '../dialogs/ExamplesDialog';
import { NewSongDialog } from '../dialogs/NewSongDialog';
import { PhotoImportDialog } from '../dialogs/PhotoImportDialog';
import { SettingsDialog } from '../dialogs/SettingsDialog';
import { ShareDialog } from '../dialogs/ShareDialog';
import { alignText } from '../lib/align';
import { desk, inFrame, type DesktopFile } from '../lib/desktop';
import { readShareHash } from '../lib/share';
import { KEYS, store } from '../lib/storage';
import { backupJson, createSong, currentSongId, deleteSong, getSong, putSong, restoreBackup, setCurrentSongId, songMeta, type Song } from '../lib/library';
import { LibraryDialog } from '../dialogs/LibraryDialog';
import APP_ICON from '../assets/app-icon.png';

type DialogName = 'new' | 'examples' | 'share' | 'photo' | 'settings' | 'copy' | 'about' | 'letters' | 'library' | null;

interface Initial {
  text: string;
  file: { path: string; name: string } | null;
  dirty: boolean;
  message: string;
  /** library song the editor is bound to (null: not in the library until edited) */
  songId?: string | null;
}

/** Decide what the editor starts with (shared link, file, recovered work, draft, example). */
async function loadInitial(): Promise<Initial> {
  if (desk) {
    const st = await desk.startup();
    if (st.file) return { text: st.file.text, file: st.file, dirty: false, message: 'Opened ' + st.file.name };
    if (st.recovered) {
      const f = st.recovered.path ? { path: st.recovered.path, name: st.recovered.name || 'Untitled' } : null;
      return { text: st.recovered.text, file: f, dirty: true, message: 'Recovered your unsaved changes' };
    }
    if (st.lastFile) return { text: st.lastFile.text, file: st.lastFile, dirty: false, message: '' };
    return { text: st.additional ? newSongTemplate : examples[0].text, file: null, dirty: false, message: '' };
  }
  try {
    const shared = await readShareHash();
    if (shared !== null) {
      history.replaceState(null, '', location.pathname + location.search);
      return { text: shared, file: null, dirty: false, message: 'Opened shared notation' };
    }
  } catch {
    /* corrupt link: fall through */
  }
  const current = getSong(currentSongId());
  if (current) return { text: current.text, file: null, dirty: false, message: '', songId: current.id };
  const draft = store.get(KEYS.draft);
  if (draft && draft.trim()) {
    if (examples.some((e) => e.text === draft)) return { text: draft, file: null, dirty: false, message: '' };
    // earlier versions kept one draft: move it into the library
    const song = createSong(draft);
    setCurrentSongId(song.id);
    return { text: draft, file: null, dirty: false, message: 'Your draft is now in the Library', songId: song.id };
  }
  return { text: examples[0].text, file: null, dirty: false, message: '' };
}

export function App() {
  const [initial, setInitial] = useState<Initial | null>(null);
  useEffect(() => {
    loadInitial().then(setInitial);
  }, []);
  if (!initial) return null;
  return <Editor initial={initial} />;
}

function Editor({ initial }: { initial: Initial }) {
  const toast = useToast();
  const { confirm, element: confirmElement } = useConfirm();
  const editor = useRef<EditorHandle>(null);
  const [lettersCtx, setLettersCtx] = useState<LettersContext | null>(null);
  const installPrompt = useInstallPrompt();
  // Run an editor action once the current dialog has closed (a closing <dialog>
  // moves focus, so the editor must be focused after that, not before).
  const afterClose = useRef<(() => void) | null>(null);
  const appRef = useRef<HTMLElement>(null);

  const [text, setText] = useState(initial.text);
  const [doc, setDoc] = useState<NotationDoc>(() => parse(initial.text));
  const [autoUpdate, setAutoUpdate] = useState(store.get(KEYS.auto) !== '0');
  const [splitY, setSplitY] = useState(() => parseFloat(store.get(KEYS.split) || '') || 52);
  const [splitX, setSplitX] = useState(() => parseFloat(store.get(KEYS.splitX) || '') || 42);
  const [layout, setLayout] = useState<'side' | 'stack'>(() => (store.get(KEYS.layout) as 'side' | 'stack') || (window.innerWidth >= 1000 ? 'side' : 'stack'));
  const [view, setView] = useState<'notation' | 'text'>('notation');
  const [issuesOpen, setIssuesOpen] = useState(false);
  const [docState, setDocState] = useState({ name: '', dirty: initial.dirty });
  const [status, setStatus] = useState(initial.message);
  const [dialog, setDialog] = useState<DialogName>(null);
  const [assist, setAssist] = useState<AssistMode | null>(null);

  // When a dialog closes, put the cursor back in the editor if that is where the
  // person was typing (a closing <dialog> otherwise leaves focus on the page).
  const lastOutsideFocus = useRef<Element | null>(null);
  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      const t = e.target as Element | null;
      if (t && !t.closest('dialog')) lastOutsideFocus.current = t;
    };
    document.addEventListener('focusin', onFocusIn);
    return () => document.removeEventListener('focusin', onFocusIn);
  }, []);
  const assistWasOpen = useRef(false);
  useEffect(() => {
    if (assist !== null) assistWasOpen.current = true;
    if (dialog !== null || assist !== null) return;
    const fromAssist = assistWasOpen.current;
    assistWasOpen.current = false;
    if (afterClose.current) {
      const run = afterClose.current;
      afterClose.current = null;
      run();
    } else if ((document.activeElement === document.body || !document.activeElement) && (fromAssist || lastOutsideFocus.current?.id === 'input')) {
      editor.current?.focus();
    }
  }, [dialog, assist]);
  const [settingsVersion, setSettingsVersion] = useState(0);
  const [droppedImages, setDroppedImages] = useState<File[] | undefined>(undefined);

  // file state lives in refs so desktop callbacks always see the latest
  const dirty = useRef(initial.dirty);
  const file = useRef(initial.file);
  const textRef = useRef(initial.text);
  // library: the song being edited, and whether it has unsaved typing
  const songId = useRef<string | null>(initial.songId ?? null);
  const libPending = useRef(false);
  const [libVersion, setLibVersion] = useState(0);
  const [libUndo, setLibUndo] = useState<{ message: string; run: () => void } | null>(null);
  const [currentSong, setCurrentSong] = useState<string | null>(initial.songId ?? null);
  /** Save typing into the library now (creates the song on its first edit). */
  const flushLibrary = useCallback(() => {
    if (!libPending.current) return;
    libPending.current = false;
    const t = textRef.current;
    const existing = getSong(songId.current);
    if (existing) {
      if (existing.text !== t) putSong({ ...existing, text: t, updated: Date.now() });
    } else if (t.trim()) {
      const song = createSong(t);
      songId.current = song.id;
      setCurrentSong(song.id);
      setCurrentSongId(song.id);
    }
  }, []);
  const bindSong = useCallback((id: string | null) => {
    songId.current = id;
    libPending.current = false;
    setCurrentSong(id);
    setCurrentSongId(id);
  }, []);

  const say = useCallback((m: string) => {
    setStatus(m);
    if (m) toast(m);
  }, [toast]);

  const displayName = () => {
    if (file.current) return file.current.name;
    const m = textRef.current.match(/^\s*Title\s*:\s*"?([^"\n]*)"?/im);
    return (m && m[1].trim()) || 'Untitled';
  };

  const notifyState = useCallback(() => {
    store.set(KEYS.draftMeta, JSON.stringify({ path: file.current?.path ?? null, dirty: dirty.current }));
    const name = displayName();
    setDocState({ name, dirty: dirty.current });
    desk?.setState({ dirty: dirty.current, path: file.current?.path ?? null, name });
  }, []);

  // ---- parsing (debounced while typing) -----------------------------------------
  // the text the preview was last drawn from (shows whether Update has anything to do)
  const [drawnText, setDrawnText] = useState(initial.text);
  const drawnRef = useRef(drawnText);
  drawnRef.current = drawnText;
  const update = useCallback(() => {
    setDoc(parse(textRef.current));
    setDrawnText(textRef.current);
  }, []);
  useEffect(() => {
    const t = setTimeout(() => {
      if (autoUpdate) update();
      flushLibrary();
      store.set(KEYS.draft, text);
      store.set(KEYS.draftMeta, JSON.stringify({ path: file.current?.path ?? null, dirty: dirty.current }));
      if (desk && dirty.current) desk.saveDraft(text);
    }, 300);
    return () => clearTimeout(t);
  }, [text, autoUpdate, update, flushLibrary]);

  useEffect(() => {
    document.title = doc.title ? doc.title + ' · Carnatic Notation' : 'Carnatic Music Notation Typesetter';
    let el = document.getElementById('pageStyle');
    if (!el) {
      el = document.createElement('style');
      el.id = 'pageStyle';
      document.head.appendChild(el);
    }
    el.textContent = '@page { size: ' + (doc.page.size || 'A4') + ' ' + doc.page.orientation + '; margin: ' + (doc.page.margin || '12mm') + '; }';
  }, [doc]);

  useEffect(() => {
    notifyState();
    if (initial.message) toast(initial.message);
    if (desk) desk.setExamples(examples.map((e) => ({ id: e.id, title: e.title })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onHide = () => flushLibrary();
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [flushLibrary]);

  const onInput = (t: string) => {
    textRef.current = t;
    libPending.current = true;
    setText(t);
    if (!dirty.current) {
      dirty.current = true;
      notifyState();
    }
  };

  /** Replace the whole notation (open, example, new song). */
  const setAll = useCallback((t: string, msg: string, f: { path: string; name: string } | null = null, song: string | null = null) => {
    flushLibrary(); // keep what was typed in the song being left
    bindSong(song);
    editor.current?.setValue(t);
    textRef.current = t;
    setText(t);
    file.current = f;
    dirty.current = false;
    store.set(KEYS.draft, t);
    notifyState();
    setDoc(parse(t));
    setDrawnText(t);
    if (msg) say(msg);
  }, [notifyState, say, flushLibrary, bindSong]);

  const confirmReplace = useCallback(async () => {
    if (!desk) return true; // web: typing is saved in the Library as you go
    if (!dirty.current || !textRef.current.trim()) return true;
    return confirm({ title: 'Replace the current notation?', message: 'Your changes since you last saved will be replaced. Save first if you want to keep them.', ok: 'Replace' });
  }, [confirm]);

  // ---- commands -------------------------------------------------------------------
  const save = useCallback(async (saveAs = false): Promise<boolean> => {
    const current = parse(textRef.current);
    if (desk) {
      const r = await desk.saveFile({ text: textRef.current, path: file.current?.path ?? null, saveAs, suggestedName: current.title || 'Untitled' });
      if (!r) return false;
      file.current = r;
      dirty.current = false;
      notifyState();
      say('Saved ' + r.name);
      return true;
    }
    const name = (current.title || 'notation').replace(/[\\/:*?"<>|]+/g, '').trim() || 'notation';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([textRef.current], { type: 'text/plain;charset=utf-8' }));
    a.download = name + '.txt';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 1000);
    dirty.current = false;
    notifyState();
    say('Saved ' + a.download);
    if (inFrame) setDialog('copy');
    return true;
  }, [notifyState, say]);

  const openFileInput = useRef<HTMLInputElement>(null);

  // ---- library ---------------------------------------------------------------------
  /** Open notation from a file as a new song in the library (web). */
  const openAsSong = useCallback((t: string, name: string) => {
    setAll(t, 'Opened ' + name + ' (added to the Library)', null, createSong(t).id);
  }, [setAll]);

  const download = (name: string, data: string, type: string) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([data], { type }));
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 1000);
  };

  const library = {
    open: (s: Song) => {
      setDialog(null);
      if (s.id === songId.current) return;
      setAll(s.text, 'Opened “' + songMeta(s.text).title + '”', null, s.id);
    },
    duplicate: (s: Song) => {
      const copyText = /^\s*Title\s*:/im.test(s.text)
        ? s.text.replace(/^(\s*Title\s*:\s*"?)([^"\n]*)/im, (_m, a: string, b: string) => a + b.trim() + ' (copy)')
        : 'Title: "' + songMeta(s.text).title + ' (copy)"\n' + s.text;
      createSong(copyText);
      setLibVersion((v) => v + 1);
      toast('Duplicated “' + songMeta(s.text).title + '”');
    },
    remove: (s: Song) => {
      flushLibrary();
      const wasCurrent = s.id === songId.current;
      const gone = deleteSong(s.id);
      if (wasCurrent) bindSong(null);
      setLibVersion((v) => v + 1);
      if (gone)
        setLibUndo({
          message: 'Deleted “' + songMeta(gone.text).title + '”',
          run: () => {
            putSong(gone);
            if (wasCurrent && songId.current === null) bindSong(gone.id);
            setLibVersion((v) => v + 1);
            setLibUndo(null);
          },
        });
    },
    importFiles: async (files: File[]) => {
      let n = 0;
      for (const f of files) {
        if (f.size > 5 * 1024 * 1024) continue;
        const t = await f.text();
        if (t.trim()) {
          createSong(t);
          n++;
        }
      }
      setLibVersion((v) => v + 1);
      toast(n ? 'Imported ' + n + (n === 1 ? ' song' : ' songs') : 'No notation found in those files');
    },
    backup: () => {
      flushLibrary();
      download('carnatic-notation-library-' + new Date().toISOString().slice(0, 10) + '.json', backupJson(), 'application/json');
      toast('Backup downloaded');
      if (inFrame) toast('Downloads are blocked in this preview; use the hosted site to back up');
    },
    restore: async (f: File) => {
      try {
        const n = restoreBackup(await f.text());
        setLibVersion((v) => v + 1);
        toast(n ? 'Restored ' + n + (n === 1 ? ' song' : ' songs') : 'Everything in that backup is already here');
      } catch (e) {
        toast('Could not restore: ' + (e instanceof Error ? e.message : 'not a library backup'));
      }
    },
  };

  const commands = useMemo(() => {
    const c: Record<string, () => unknown> = {
      new: () => setDialog('new'),
      open: async () => {
        if (!(await confirmReplace())) return;
        if (desk) {
          const f = await desk.openFile();
          if (f) setAll(f.text, 'Opened ' + f.name, f);
        } else openFileInput.current?.click();
      },
      save: () => save(false),
      saveAs: () => save(true),
      assist: () => setAssist(assistModeFor(editor.current?.lineInfo().text ?? '')),
      update: () => {
        const changed = textRef.current !== drawnRef.current;
        update();
        say(changed ? 'Notation updated' : 'Notation is already up to date');
      },
      align: () => {
        const before = editor.current!.getValue();
        const after = alignText(before);
        if (after === before) return say('Nothing to align');
        const top = editor.current!.scrollTop;
        editor.current!.replaceRange(0, before.length, after);
        editor.current!.scrollTop = top;
        say('Lyrics lined up under their swaras');
      },
      photo: () => {
        setDroppedImages(undefined);
        setDialog('photo');
      },
      examples: () => setDialog('examples'),
      library: () => {
        flushLibrary();
        setLibVersion((v) => v + 1);
        setDialog('library');
      },
      about: () => setDialog('about'),
      letters: () => {
        const ed = editor.current;
        if (!ed) return;
        setLettersCtx(lettersContext(ed.getValue(), ed.lineInfo()));
        setDialog('letters');
      },
      share: () => setDialog('share'),
      exportPdf: async () => {
        update();
        if (!desk) return window.print();
        const base = file.current ? file.current.name.replace(/\.[^.]+$/, '') : parse(textRef.current).title || 'notation';
        const r = await desk.exportPdf({ suggestedName: base });
        if (r) say('Exported ' + r.name);
      },
      print: () => {
        update();
        if (desk) return desk.print();
        requestAnimationFrame(() => {
          try {
            window.print();
          } catch {
            /* blocked */
          }
          if (inFrame) say('If no print dialog opened, printing is blocked in this preview — use the hosted site');
        });
      },
      saveThenClose: async () => {
        if (await save(false)) desk?.closeWindow();
      },
      discardThenClose: () => {
        dirty.current = false;
        notifyState();
        desk?.closeWindow();
      },
    };
    return c;
  }, [confirmReplace, notifyState, save, say, setAll, update, flushLibrary]);

  const commandsRef = useRef(commands);
  commandsRef.current = commands;

  const openExample = useCallback(async (ex: Example) => {
    setDialog(null);
    if (await confirmReplace()) setAll(ex.text, 'Opened “' + ex.title + '”');
  }, [confirmReplace, setAll]);

  // ---- desktop app: menus and files opened from the system ---------------------
  useEffect(() => {
    if (!desk) return;
    desk.onMenu(async (cmd) => {
      if (cmd.startsWith('example:')) {
        const ex = examples.find((x) => x.id === cmd.slice(8));
        if (ex) openExample(ex);
        return;
      }
      commandsRef.current[cmd]?.();
    });
    desk.onOpenFile(async (f: DesktopFile) => {
      if (await confirmReplace()) setAll(f.text, 'Opened ' + f.name, f);
    });
    // registered once; the handlers read the latest state through refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- web: shared links opened while the page is open ----------------------------
  useEffect(() => {
    if (desk) return;
    const onHash = async () => {
      try {
        const t = await readShareHash();
        if (t !== null && (await confirmReplace())) {
          setAll(t, 'Opened shared notation');
          history.replaceState(null, '', location.pathname + location.search);
        }
      } catch {
        say('Could not read the shared link');
      }
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [confirmReplace, say, setAll]);

  // ---- drag & drop: notation files open, images go to the photo reader ----------
  useEffect(() => {
    const over = (e: DragEvent) => {
      if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files')) e.preventDefault();
    };
    const drop = async (e: DragEvent) => {
      const files = Array.from(e.dataTransfer?.files || []);
      if (!files.length) return;
      e.preventDefault();
      const images = files.filter((f) => f.type.startsWith('image/'));
      if (images.length) {
        setDroppedImages(images);
        setDialog('photo');
        return;
      }
      const f = files[0];
      if (!(await confirmReplace())) return;
      if (desk) {
        const r = await desk.openDropped(f);
        if ('error' in r) say(r.error);
        else setAll(r.text, 'Opened ' + r.name, r);
        return;
      }
      if (f.size > 5 * 1024 * 1024) return say('That file is too large to be notation');
      openAsSong(await f.text(), f.name);
    };
    window.addEventListener('dragover', over);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragover', over);
      window.removeEventListener('drop', drop);
    };
  }, [confirmReplace, say, setAll]);

  // ---- photo result ----------------------------------------------------------------
  const usePhotoResult = async (t: string, mode: 'insert' | 'replace') => {
    if (mode === 'replace') {
      if (!(await confirmReplace())) return;
      editor.current!.replaceRange(0, editor.current!.getValue().length, t);
      file.current = null;
      notifyState();
      say('Notation replaced with the photo reading');
    } else {
      const li = editor.current!.lineInfo();
      const at = li.text.trim() ? li.end : li.start;
      editor.current!.replaceRange(at, at, (li.text.trim() ? '\n' : '') + t.replace(/\n+$/, '') + '\n');
      say('Inserted the photo reading');
    }
    update();
  };

  // ---- Assist ------------------------------------------------------------------------
  const applyAssist = (t: string, insert: boolean) => {
    setAssist(null);
    const li = editor.current!.lineInfo();
    if (insert) editor.current!.replaceRange(li.end, li.end, '\n' + t);
    else editor.current!.replaceRange(li.start, li.end, t);
  };
  const chooseForm = (name: FormName) => {
    const li = editor.current!.lineInfo();
    if (li.text.trim()) editor.current!.replaceRange(li.end, li.end, '\n');
    setAssist({ kind: 'form', name, value: '' });
  };

  const lineBlank = !(editor.current?.lineInfo().text.trim());

  return (
    <>
      <header className="titlebar">
        <div className="tb-doc">
          <button type="button" className="tb-icon-btn" onClick={() => setDialog('about')} title="About this app and its original creator" aria-label="About">
            <img className="tb-icon" src={APP_ICON} alt="" />
          </button>
          <div className="tb-names">
            <div className="tb-title">
              {docState.name || 'Untitled'}
              {docState.dirty && desk && <span className="tb-edited"> — Edited</span>}
            </div>
            <div className="tb-sub">Carnatic Notation Typesetter</div>
          </div>
        </div>
        <div className="segmented view-switch" role="tablist" aria-label="Show">
          <button type="button" role="tab" aria-selected={view === 'notation'} onClick={() => setView('notation')}>Notation</button>
          <button type="button" role="tab" aria-selected={view === 'text'} onClick={() => setView('text')}>Text</button>
        </div>
        <Toolbar desktop={!!desk} onCommand={(c: Command) => {
          if (c === 'assist' || c === 'align' || c === 'letters') setView('text'); // phones: show the text being edited
          commands[c]?.();
        }} />
        {installPrompt.canInstall && !desk && (
          <button type="button" className="tb-btn install-btn" title="Install as an app: opens from your home screen or dock and works offline" onClick={() => installPrompt.install()}>
            <Icon name="install" />
            <span className="tb-label">Install</span>
          </button>
        )}
        <button
          type="button"
          className="tb-btn layout-toggle"
          title={layout === 'side' ? 'Show the text below the notation' : 'Show the text beside the notation'}
          aria-label="Change layout"
          onClick={() => {
            const next = layout === 'side' ? 'stack' : 'side';
            setLayout(next);
            store.set(KEYS.layout, next);
          }}
        >
          <Icon name={layout === 'side' ? 'stacked' : 'sidebyside'} />
          <span className="tb-label">Layout</span>
        </button>
      </header>

      <main
        className={'workspace layout-' + layout + ' view-' + view}
        ref={appRef}
        style={{ ['--split-x' as string]: splitX + '%', ['--split-y' as string]: splitY + '%' }}
      >
        <section className="preview-pane" aria-label="Notation preview">
          <Preview doc={doc} landscape={doc.page.orientation === 'landscape'} onJumpToLine={(n) => { setView('text'); setTimeout(() => editor.current?.goToLine(n), 0); }} />
        </section>

        <Splitter
          orientation={layout === 'side' ? 'vertical' : 'horizontal'}
          value={layout === 'side' ? splitX : splitY}
          container={appRef}
          onChange={(p) => {
            if (layout === 'side') {
              setSplitX(p);
              store.set(KEYS.splitX, String(p));
            } else {
              setSplitY(p);
              store.set(KEYS.split, String(p));
            }
          }}
        />

        <section className="editor-pane" aria-label="Notation input">
          <NotationEditor
            ref={editor}
            initialValue={initial.text}
            onInput={onInput}
            onShortcut={(cmd) => commands[cmd]()}
            onPasteConverted={({ start, original, converted, scriptName, languageWord }) => {
              const ed = editor.current!;
              const lang = lettersContext(ed.getValue(), ed.lineInfo()).lang;
              const wanted = languageWord.toLowerCase() === 'sanskrit' ? 'devanagari' : languageWord.toLowerCase();
              const tip = languageWord && lang !== wanted ? ' Add “Language: ' + languageWord + '” above it to print it in ' + scriptName + '.' : '';
              toast('Converted the pasted ' + (scriptName || 'text') + ' into the typing scheme.' + tip, {
                label: 'Keep original',
                run: () => {
                  const now = ed.getValue();
                  if (now.slice(start, start + converted.length) === converted) ed.replaceRange(start, start + converted.length, original);
                },
              });
            }}
          />
          <IssuesList list={doc.warnings} open={issuesOpen} onJump={(n) => editor.current?.goToLine(n)} />
          <footer className="pane-foot">
            <IssuesBadge list={doc.warnings} open={issuesOpen} onToggle={() => setIssuesOpen(!issuesOpen)} />
            <span className="status" aria-live="polite">{status}</span>
            <button type="button" className="credit-link" onClick={() => setDialog('about')} title="About this app and its original creator">
              Based on Arun K's typesetter
            </button>
            {!autoUpdate && (
              <button
                type="button"
                className={'pill' + (text === drawnText ? ' is-current' : '')}
                title={text === drawnText ? 'The notation matches the text' : 'Redraw the notation from the text (Ctrl+Enter)'}
                onClick={() => commands.update()}
              >
                {text === drawnText ? 'Up to date' : 'Update'}
              </button>
            )}
            <label className="switch" title="Redraw the notation as you type">
              <input
                type="checkbox"
                role="switch"
                checked={autoUpdate}
                onChange={(e) => {
                  setAutoUpdate(e.target.checked);
                  store.set(KEYS.auto, e.target.checked ? '1' : '0');
                  if (e.target.checked) update();
                }}
              />
              <span className="track" aria-hidden="true" />
              Live
            </label>
          </footer>
        </section>
      </main>

      <input
        ref={openFileInput}
        type="file"
        accept=".txt,.cmnt,.text,text/plain"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) openAsSong(await f.text(), f.name);
        }}
      />

      <NewSongDialog
        open={dialog === 'new'}
        onClose={() => setDialog(null)}
        onCreate={async (t, line) => {
          setDialog(null);
          if (!(await confirmReplace())) return;
          setAll(t, 'New song started', null, createSong(t).id);
          setTimeout(() => editor.current?.goToLine(line), 0);
        }}
      />
      <AboutDialog open={dialog === 'about'} onClose={() => setDialog(null)} />
      <LibraryDialog
        open={dialog === 'library'}
        currentId={currentSong}
        version={libVersion}
        onClose={() => {
          setDialog(null);
          setLibUndo(null);
        }}
        undo={libUndo}
        onOpen={(s) => {
          setLibUndo(null);
          library.open(s);
        }}
        onNew={() => setDialog('new')}
        onDuplicate={library.duplicate}
        onDelete={library.remove}
        onImportFiles={library.importFiles}
        onBackup={library.backup}
        onRestore={library.restore}
      />
      {dialog === 'letters' && (
        <LettersDialog
          ctx={lettersCtx}
          onClose={() => {
            afterClose.current = () => editor.current?.focus();
            setDialog(null);
          }}
          onInsert={(code) => {
            afterClose.current = () => {
              editor.current?.focus();
              editor.current?.insertAtCursor(code);
            };
            setDialog(null);
          }}
          onReplaceWord={(text) => {
            const w = lettersCtx?.word;
            afterClose.current = () => {
              editor.current?.focus();
              if (w) editor.current?.replaceRange(w.start, w.end, text);
            };
            setDialog(null);
          }}
        />
      )}
      <ExamplesDialog open={dialog === 'examples'} onClose={() => setDialog(null)} onPick={openExample} />
      <ShareDialog open={dialog === 'share'} onClose={() => setDialog(null)} text={text} />
      <CopyTextDialog
        open={dialog === 'copy'}
        onClose={() => setDialog(null)}
        text={text}
        message="If no file was downloaded (this preview may block downloads), copy the text below and keep it in a .txt file, or use the hosted site."
      />
      <PhotoImportDialog
        open={dialog === 'photo'}
        onClose={() => setDialog(null)}
        onOpenSettings={() => setDialog('settings')}
        settingsVersion={settingsVersion}
        initialFiles={droppedImages}
        onUse={usePhotoResult}
      />
      <SettingsDialog
        open={dialog === 'settings'}
        onClose={() => setDialog('photo')}
        onSaved={() => setSettingsVersion((v) => v + 1)}
      />
      <AssistDialog mode={assist} onClose={() => setAssist(null)} onApply={applyAssist} onChooseForm={chooseForm} currentLineBlank={lineBlank} />
      {confirmElement}
    </>
  );
}
