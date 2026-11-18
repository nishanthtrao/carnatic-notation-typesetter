import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal } from '../components/Modal';
import { Icon } from '../components/Icons';
import { Preview } from '../components/Preview';
import { parse } from '../engine';
import { checkReply, recognizeNotation, reviewWarnings, RecognitionError, type RecognitionResult } from '../recognition/recognize';
import { prepareImage } from '../recognition/image';
import { chatAppPrompt, chatRepairPrompt, type RecognitionHints } from '../recognition/prompt';
import { estimateCost, PROVIDER_ORDER, PROVIDERS, type ApiProviderId, type ProviderId } from '../recognition/providers';
import { loadApiKeys, loadSettings, modelInfo, saveSettings, type ApiKeys, type RecognitionSettings } from '../recognition/settings';
import { Field, Select } from './common';
import { PHOTO_API } from '../recognition/flags';
import { CHAT_APPS, loadChatApp, saveChatApp, type ChatApp } from '../recognition/apps';

const MAX_PAGES = 5;

interface Page {
  id: number;
  file: File;
  url: string;
  rotation: number;
}

type Step =
  | { kind: 'pick' }
  | { kind: 'reading'; stage: string; started: number }
  /** chat app: copy the instructions out, paste the reply in */
  | { kind: 'chat'; followUp?: boolean }
  | { kind: 'review'; result: RecognitionResult; viaChat?: boolean };


/** Copy text, also where the async clipboard is unavailable (older browsers, some frames). */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      /* not allowed */
    }
    ta.remove();
    return ok;
  }
}

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
  const [keys, setKeys] = useState<ApiKeys>({});
  const [settings, setSettings] = useState<RecognitionSettings>(() => loadSettings());
  const [text, setText] = useState('');
  const [reply, setReply] = useState('');
  const [copied, setCopied] = useState<'' | 'prompt' | 'fix' | 'failed'>('');
  const [now, setNow] = useState(Date.now());
  const abort = useRef<AbortController | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    loadApiKeys().then((k) => {
      setKeys(k);
      setSettings(loadSettings(k));
    });
  }, [open, settingsVersion]);

  // with API reading switched off, the chat apps are the only way
  const provider = PHOTO_API ? settings.provider : 'chat';
  const [app, setApp] = useState<ChatApp>(loadChatApp);
  const pickApp = (id: string) => {
    const a = CHAT_APPS.find((x) => x.id === id) || CHAT_APPS[0];
    setApp(a);
    saveChatApp(a);
  };
  const api = provider === 'chat' ? null : (provider as ApiProviderId);
  const apiKey = api ? keys[api] || '' : '';
  const model = api ? settings.models[api] || PROVIDERS[api].models[0].id : '';
  const choose = (p: ProviderId) => {
    const next = { ...settings, provider: p };
    setSettings(next);
    saveSettings(next);
  };

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
    setReply('');
    setCopied('');
  };

  const close = () => {
    reset();
    onClose();
  };

  const read = async () => {
    setError('');
    if (!api) {
      setCopied('');
      setStep({ kind: 'chat' });
      return;
    }
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
        provider: api,
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
  const warnings = useMemo(() => reviewWarnings(text, doc.warnings), [text, doc]);
  const info = api ? modelInfo(api, model, settings) : undefined;
  const modelLabel = info?.label.split(' — ')[0] || model;
  const prompt = chatAppPrompt(hints, pages.length);

  const copyPrompt = async () => setCopied((await copyText(prompt)) ? 'prompt' : 'failed');
  // phones: hand the photos (and the instructions) straight to the AI app
  const canShare = pages.length > 0 && typeof navigator !== 'undefined' && !!navigator.canShare && navigator.canShare({ files: pages.map((p) => p.file) });
  const share = async () => {
    const ok = await copyText(prompt);
    setCopied(ok ? 'prompt' : 'failed');
    try {
      await navigator.share({ files: pages.map((p) => p.file), text: prompt });
    } catch {
      /* cancelled; the instructions are still copied */
    }
  };
  const checkPasted = () => {
    const result = checkReply(reply);
    if (!result.notation.trim()) {
      setError('That doesn’t look like notation. Copy the whole reply from the app and paste it here.');
      return;
    }
    setError('');
    setText(result.notation);
    setStep({ kind: 'review', result, viaChat: true });
  };
  const askForFixes = async () => {
    const ok = await copyText(chatRepairPrompt(warnings.slice(0, 30).map((w) => 'line ' + w.line + ': ' + w.message)));
    setCopied(ok ? 'fix' : 'failed');
    setReply('');
    setStep({ kind: 'chat', followUp: true });
  };

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
            <button type="button" onClick={() => setStep(step.viaChat ? { kind: 'chat' } : { kind: 'pick' })}>Back</button>
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
        {(r.notes.length > 0 || warnings.length > 0) && (
          <div className="review-notes">
            {r.notes.length > 0 && (
              <>
                <b>Things the reader was unsure of</b>
                <ul>{r.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
              </>
            )}
            {warnings.length > 0 && (
              <>
                <b>Problems the typesetter found</b>
                <ul>{warnings.slice(0, 10).map((w, i) => <li key={i}>Line {w.line}: {w.message}</li>)}</ul>
                {step.viaChat && (
                  <p style={{ margin: '6px 0 0' }}>
                    <button type="button" className="inline-btn" onClick={askForFixes}>Ask the app to fix these…</button> copies a request to paste into the same chat.
                  </p>
                )}
              </>
            )}
          </div>
        )}
        <p className="hint">
          {step.viaChat
            ? 'Read in your AI chat app.'
            : (() => {
                const cost = estimateCost(info?.price, r.usage);
                return 'Read with ' + modelLabel + (cost !== undefined ? ' · about $' + cost.toFixed(3) : ' · ' + (r.usage.input + r.usage.output).toLocaleString() + ' tokens');
              })()}
        </p>
      </Modal>
    );
  }

  // ---- chat app ------------------------------------------------------------------
  if (step.kind === 'chat') {
    return (
      <Modal
        title={step.followUp ? 'Ask for corrections' : 'Read it in your AI app'}
        open={open}
        onClose={close}
        wide
        footer={
          <>
            <button type="button" onClick={() => setStep({ kind: 'pick' })}>Back</button>
            <span className="spacer" />
            <button type="button" onClick={close}>Cancel</button>
            <button type="button" className="primary" disabled={!reply.trim()} onClick={checkPasted}>Check the notation</button>
          </>
        }
      >
        <ol className="chat-steps">
          {step.followUp ? (
            <li>
              <b>{copied === 'fix' ? 'The correction request is copied.' : 'Copy the correction request.'}</b> Paste it into the same chat as before and send it.
              {copied === 'failed' && <span className="err-text"> Copying didn’t work here; go back and try again.</span>}
            </li>
          ) : (
            <>
              <li>
                <b>Copy the instructions.</b> They tell the AI exactly how to write the notation for this typesetter.
                <div className="chat-actions">
                  <button type="button" className={copied === 'prompt' ? 'done' : ''} onClick={copyPrompt}>
                    <Icon name={copied === 'prompt' ? 'check' : 'copy'} />
                    {copied === 'prompt' ? 'Copied' : 'Copy instructions'}
                  </button>
                  {canShare && (
                    <button type="button" onClick={share}>
                      <Icon name="share" />
                      Send photo{pages.length > 1 ? 's' : ''} to an app
                    </button>
                  )}
                </div>
                {copied === 'failed' && <p className="err-text">Copying didn’t work here. Select the instructions below and copy them yourself.</p>}
                <details className="chat-prompt" open={copied === 'failed'}>
                  <summary>Show the instructions</summary>
                  <textarea className="mono-box" readOnly rows={6} value={prompt} onFocus={(e) => e.currentTarget.select()} aria-label="Instructions for the AI" />
                </details>
              </li>
              <li>
                <b>{app.url ? 'Open ' + app.name : 'Open your AI app'}</b> in a new chat, attach {pages.length > 1 ? 'your ' + pages.length + ' photos (in order)' : 'your photo'} and paste the instructions.
                If the app lets you choose a model, pick its most capable one, or one that thinks or reasons before answering: it reads handwriting much better.
                <div className="chat-actions">
                  {app.url && (
                    <a className="chat-app primary-link" href={app.url} target="_blank" rel="noopener">
                      Open {app.name} ↗
                    </a>
                  )}
                  <label className="chat-switch">
                    {app.url ? 'or use' : 'Use'}{' '}
                    <select value={app.id} onChange={(e) => pickApp(e.target.value)} aria-label="AI app">
                      {CHAT_APPS.map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </li>
            </>
          )}
          <li>
            <b>Copy the whole reply</b> (most apps have a copy button under it) and paste it here.
            <textarea
              className="mono-box chat-reply"
              rows={8}
              value={reply}
              placeholder="Paste the reply here"
              spellCheck={false}
              wrap="off"
              aria-label="The reply from the AI app"
              onChange={(e) => setReply(e.target.value)}
            />
          </li>
        </ol>
        {error && <p className="err-text" role="alert">{error}</p>}
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
          {PHOTO_API && <button type="button" onClick={onOpenSettings}><Icon name="settings" />Settings</button>}
          <span className="spacer" />
          <button type="button" onClick={close}>Cancel</button>
          <button type="button" className="primary" disabled={!!api && !!apiKey && !pages.length} onClick={read}>
            {!api ? 'Next' : apiKey ? 'Read notation' : 'Add API key…'}
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
        {PHOTO_API && (
          <Field id="p-provider" label="Read with">
            <Select
              id="p-provider"
              value={provider}
              onChange={(v) => choose(v as ProviderId)}
              options={PROVIDER_ORDER.map((id) => [id, id === 'chat' ? 'My AI chat app (no API key)' : PROVIDERS[id].name + (keys[id as ApiProviderId] ? '' : ' — needs an API key')])}
            />
          </Field>
        )}
        {provider === 'chat' && (
          <Field id="p-app" label="AI app">
            <Select id="p-app" value={app.id} onChange={pickApp} options={CHAT_APPS.map((a) => [a.id, a.by ? a.name + ' (' + a.by + ')' : a.name])} />
          </Field>
        )}
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
        {!api ? (
          <>
            The photo is read by the AI app you choose, with your own account there, free or paid. You copy the instructions into it with your photo and paste its reply back here to
            check it. Adding the photo here is optional; it lets you compare it with the result.{' '}
          </>
        ) : apiKey ? (
          <>Uses {modelLabel} with your API key; the photo is sent to {PROVIDERS[api].company} to be read. </>
        ) : (
          <>Needs your own {PROVIDERS[api].name} API key — press <b>Settings</b>, or choose “My AI chat app” to use an app you already have. </>
        )}
        Clear, flat, well-lit photos of one page each work best.
      </p>
    </Modal>
  );
}
