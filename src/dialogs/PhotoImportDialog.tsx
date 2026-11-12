import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal } from '../components/Modal';
import { Icon } from '../components/Icons';
import { Preview } from '../components/Preview';
import { parse } from '../engine';
import { estimateCost, MODELS, recognizeNotation, RecognitionError, type RecognitionResult } from '../recognition/claude';
import { prepareImage } from '../recognition/image';
import type { RecognitionHints } from '../recognition/prompt';
import { loadApiKey, loadModel } from '../recognition/settings';
import { Field, Select } from './common';

const MAX_PAGES = 5;

interface Page {
  id: number;
  file: File;
  url: string;
  rotation: number;
}

type Step = { kind: 'pick' } | { kind: 'reading'; stage: string; started: number } | { kind: 'review'; result: RecognitionResult };

interface Props {
  open: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
  /** bumped when settings change, so the key is reloaded */
  settingsVersion: number;
  onUse: (text: string, mode: 'insert' | 'replace') => void;
  /** files dropped/pasted onto the main window while the dialog opens */
  initialFiles?: File[];
}

const STAGES: Record<string, string> = {
  preparing: 'Preparing the images…',
  reading: 'Reading the notation… (this can take up to a minute)',
  checking: 'Checking the result…',
  fixing: 'Correcting a few problems the typesetter found…',
};

let nextId = 1;

export function PhotoImportDialog({ open, onClose, onOpenSettings, settingsVersion, onUse, initialFiles }: Props) {
  const [pages, setPages] = useState<Page[]>([]);
  const [hints, setHints] = useState<RecognitionHints>({ script: 'auto', tala: '', raga: '', notes: '' });
  const [step, setStep] = useState<Step>({ kind: 'pick' });
  const [error, setError] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState(loadModel());
  const [text, setText] = useState('');
  const [now, setNow] = useState(Date.now());
  const abort = useRef<AbortController | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    loadApiKey().then(setApiKey);
    setModel(loadModel());
  }, [open, settingsVersion]);

  // images dropped on the main window: add each batch once
  const consumed = useRef<File[] | undefined>(undefined);
  useEffect(() => {
    if (open && initialFiles?.length && consumed.current !== initialFiles) {
      consumed.current = initialFiles;
      addFiles(initialFiles);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialFiles]);

  useEffect(() => {
    if (step.kind !== 'reading') return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [step.kind]);

  // paste an image while the dialog is open
  useEffect(() => {
    if (!open || step.kind !== 'pick') return;
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files || []).filter((f) => f.type.startsWith('image/'));
      if (files.length) {
        e.preventDefault();
        addFiles(files);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  });

  const addFiles = (files: File[]) => {
    setError('');
    const imgs = files.filter((f) => f.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|heic)$/i.test(f.name));
    if (imgs.length < files.length) setError('Only image files can be read (JPEG, PNG or WebP).');
    setPages((ps) => {
      const room = MAX_PAGES - ps.length;
      if (imgs.length > room) setError('Up to ' + MAX_PAGES + ' pages can be read at once.');
      return ps.concat(imgs.slice(0, Math.max(0, room)).map((file) => ({ id: nextId++, file, url: URL.createObjectURL(file), rotation: 0 })));
    });
  };

  const reset = () => {
    abort.current?.abort();
    pages.forEach((p) => URL.revokeObjectURL(p.url));
    setPages([]);
    setStep({ kind: 'pick' });
    setError('');
    setText('');
  };

  const close = () => {
    reset();
    onClose();
  };

  const read = async () => {
    setError('');
    if (!apiKey) {
      onOpenSettings();
      return;
    }
    const ctrl = new AbortController();
    abort.current = ctrl;
    setStep({ kind: 'reading', stage: 'preparing', started: Date.now() });
    try {
      const images = [];
      for (const p of pages) images.push(await prepareImage(p.file, p.rotation));
      const result = await recognizeNotation({
        apiKey,
        model,
        images,
        hints,
        signal: ctrl.signal,
        onStage: (stage) => setStep((s) => (s.kind === 'reading' ? { ...s, stage } : s)),
      });
      setText(result.notation);
      setStep({ kind: 'review', result });
    } catch (e) {
      if ((e as Error).name === 'AbortError') {
        setStep({ kind: 'pick' });
        return;
      }
      setError(e instanceof RecognitionError ? e.message : (e as Error).message || String(e));
      setStep({ kind: 'pick' });
    }
  };

  const doc = useMemo(() => parse(text), [text]);
  const modelLabel = MODELS.find((m) => m.id === model)?.label.split(' — ')[0] || model;

  // ---- review ------------------------------------------------------------------
  if (step.kind === 'review') {
    const r = step.result;
    return (
      <Modal
        title="Check the notation"
        open={open}
        onClose={close}
        wide
        footer={
          <>
            <button type="button" onClick={() => setStep({ kind: 'pick' })}>Back</button>
            <button type="button" onClick={() => { onUse(text, 'insert'); close(); }}>Insert at cursor</button>
            <button type="button" className="primary" onClick={() => { onUse(text, 'replace'); close(); }}>Replace all</button>
          </>
        }
      >
        <p className="hint" style={{ marginTop: 0 }}>
          Compare with your page and fix anything that's wrong. Dots above/below swaras and speed lines are the easiest to misread.
          {r.repaired && ' A few problems were corrected automatically.'}
        </p>
        <div className="review-grid">
          <div className="review-pages">
            {pages.map((p) => (
              <img key={p.id} src={p.url} alt="Your page" style={{ transform: `rotate(${p.rotation}deg)` }} />
            ))}
          </div>
          <div className="review-work">
            <textarea className="mono-box review-text" value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} wrap="off" aria-label="Recognised notation" />
            <div className="review-preview">
              <Preview doc={doc} />
            </div>
          </div>
        </div>
        {(r.notes.length > 0 || doc.warnings.length > 0) && (
          <div className="review-notes">
            {r.notes.length > 0 && (
              <>
                <b>Things the reader was unsure of</b>
                <ul>{r.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
              </>
            )}
            {doc.warnings.length > 0 && (
              <>
                <b>Problems the typesetter found</b>
                <ul>{doc.warnings.slice(0, 10).map((w, i) => <li key={i}>Line {w.line}: {w.message}</li>)}</ul>
              </>
            )}
          </div>
        )}
        <p className="hint">Read with {modelLabel} · about ${estimateCost(model, r.usage).toFixed(3)}</p>
      </Modal>
    );
  }

  // ---- reading -----------------------------------------------------------------
  if (step.kind === 'reading') {
    return (
      <Modal title="Reading your notation" open={open} onClose={() => abort.current?.abort()} footer={<button type="button" onClick={() => abort.current?.abort()}>Cancel</button>}>
        <div className="reading">
          <div className="spinner" aria-hidden="true" />
          <p>{STAGES[step.stage] || STAGES.reading}</p>
          <p className="hint">{Math.round((now - step.started) / 1000)} s</p>
        </div>
      </Modal>
    );
  }

  // ---- pick images -------------------------------------------------------------
  return (
    <Modal
      title="Read notation from a photo"
      open={open}
      onClose={close}
      wide
      footer={
        <>
          <button type="button" onClick={onOpenSettings}><Icon name="settings" />Settings</button>
          <span className="spacer" />
          <button type="button" onClick={close}>Cancel</button>
          <button type="button" className="primary" disabled={!!apiKey && !pages.length} onClick={read}>
            {apiKey ? 'Read notation' : 'Add API key…'}
          </button>
        </>
      }
    >
      <div
        className={'drop-zone' + (pages.length ? ' has-pages' : '')}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          addFiles(Array.from(e.dataTransfer.files));
        }}
      >
        {pages.map((p, i) => (
          <figure key={p.id} className="page-thumb">
            <img src={p.url} alt={'Page ' + (i + 1)} style={{ transform: `rotate(${p.rotation}deg)` }} />
            <figcaption>
              Page {i + 1}
              <button type="button" title="Rotate" aria-label={'Rotate page ' + (i + 1)} onClick={() => setPages((ps) => ps.map((x) => (x.id === p.id ? { ...x, rotation: (x.rotation + 90) % 360 } : x)))}>
                <Icon name="rotate" />
              </button>
              <button type="button" title="Remove" aria-label={'Remove page ' + (i + 1)} onClick={() => setPages((ps) => { URL.revokeObjectURL(p.url); return ps.filter((x) => x.id !== p.id); })}>
                <Icon name="trash" />
              </button>
            </figcaption>
          </figure>
        ))}
        {pages.length < MAX_PAGES && (
          <button type="button" className="add-page" onClick={() => fileInput.current?.click()}>
            <Icon name="photo" />
            <span>{pages.length ? 'Add a page' : 'Choose or take a photo'}</span>
            <small>or drop / paste an image here</small>
          </button>
        )}
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            addFiles(Array.from(e.target.files || []));
            e.target.value = '';
          }}
        />
      </div>

      <div className="form-grid" style={{ marginTop: 12 }}>
        <Field id="p-script" label="Lyrics written in">
          <Select
            id="p-script"
            value={hints.script}
            onChange={(v) => setHints({ ...hints, script: v as RecognitionHints['script'] })}
            options={[['auto', 'Work it out'], ['english', 'English letters'], ['tamil', 'Tamil'], ['telugu', 'Telugu'], ['kannada', 'Kannada'], ['malayalam', 'Malayalam'], ['sanskrit', 'Sanskrit (Devanagari)']]}
          />
        </Field>
        <Field id="p-tala" label="Tala (optional)">
          <input id="p-tala" type="text" placeholder="if not written on the page, e.g. Adi" value={hints.tala} onChange={(e) => setHints({ ...hints, tala: e.target.value })} />
        </Field>
        <Field id="p-raga" label="Raga (optional)">
          <input id="p-raga" type="text" placeholder="e.g. mOhanam" value={hints.raga} onChange={(e) => setHints({ ...hints, raga: e.target.value })} />
        </Field>
        <Field id="p-notes" label="Notes (optional)">
          <textarea id="p-notes" rows={2} placeholder="anything unusual, e.g. 'commas are written as dashes'" value={hints.notes} onChange={(e) => setHints({ ...hints, notes: e.target.value })} />
        </Field>
      </div>

      {error && <p className="err-text" role="alert">{error}</p>}
      <p className="hint">
        {apiKey ? <>Uses {modelLabel} with your API key. </> : <>Needs your own Anthropic API key — press <b>Settings</b>. </>}
        The photo is sent to Anthropic to be read. Clear, flat, well-lit photos of one page each work best.
      </p>
    </Modal>
  );
}
