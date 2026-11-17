import { useEffect, useState } from 'react';
import { Modal } from '../components/Modal';
import { listModels, PROVIDER_ORDER, PROVIDERS, RecognitionError, testKey, type ApiProviderId, type ModelInfo, type ProviderId } from '../recognition/providers';
import { loadApiKeys, loadSettings, saveApiKeys, saveSettings, type ApiKeys, type RecognitionSettings } from '../recognition/settings';
import { desk } from '../lib/desktop';
import { Field } from './common';

const OTHER = '\u0000other';

export function SettingsDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [keys, setKeys] = useState<ApiKeys>({});
  const [settings, setSettings] = useState<RecognitionSettings>(() => loadSettings());
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<'' | 'test' | 'find'>('');
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStatus(null);
    setShow(false);
    loadApiKeys().then((k) => {
      setKeys(k);
      setSettings(loadSettings(k));
    });
  }, [open]);

  const provider = settings.provider;
  const api = provider === 'chat' ? null : (provider as ApiProviderId);
  const info = PROVIDERS[provider];
  const key = api ? keys[api] || '' : '';
  const model = api ? settings.models[api] || info.models[0]?.id || '' : '';
  const found = api ? settings.found?.[api] || [] : [];
  const choices: ModelInfo[] = api ? [...info.models, ...found.filter((f) => !info.models.some((m) => m.id === f.id))] : [];
  const listed = choices.some((m) => m.id === model);

  useEffect(() => {
    setStatus(null);
    setTyping(false);
  }, [provider]);

  const pick = (p: ProviderId) => setSettings({ ...settings, provider: p });
  const setModel = (m: string) => api && setSettings({ ...settings, models: { ...settings.models, [api]: m } });

  const save = async () => {
    await saveApiKeys(keys);
    saveSettings(settings);
    onSaved();
    onClose();
  };

  const test = async () => {
    if (!api) return;
    setBusy('test');
    setStatus(null);
    try {
      await testKey(api, key.trim(), model);
      setStatus({ ok: true, text: 'The key works with this model.' });
    } catch (e) {
      setStatus({ ok: false, text: e instanceof RecognitionError ? e.message : String(e) });
    } finally {
      setBusy('');
    }
  };

  const find = async () => {
    if (!api) return;
    setBusy('find');
    setStatus(null);
    try {
      const list = await listModels(api, key.trim());
      setSettings((s) => ({ ...s, found: { ...s.found, [api]: list } }));
      setStatus({ ok: true, text: list.length + ' models that read images are now in the list.' });
    } catch (e) {
      setStatus({ ok: false, text: e instanceof RecognitionError ? e.message : String(e) });
    } finally {
      setBusy('');
    }
  };

  return (
    <Modal
      title="Photo reader settings"
      open={open}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="button" className="primary" onClick={save}>Save</button>
        </>
      }
    >
      <p className="hint" style={{ marginTop: 0 }}>Choose how photos are read. Every option uses your own account; nothing goes through this website’s server.</p>
      <div className="provider-list" role="radiogroup" aria-label="Read photos with">
        {PROVIDER_ORDER.map((id) => (
          <label key={id} className={'provider' + (provider === id ? ' on' : '')}>
            <input type="radio" name="provider" value={id} checked={provider === id} onChange={() => pick(id)} />
            <span>
              <b>{id === 'chat' ? 'My AI chat app' : PROVIDERS[id].name}</b>
              <small>{PROVIDERS[id].blurb}</small>
            </span>
            {id !== 'chat' && keys[id as ApiProviderId] && <span className="provider-badge">has a key</span>}
          </label>
        ))}
      </div>

      {api ? (
        <>
          <div className="form-grid" style={{ marginTop: 14 }}>
            <Field id="s-key" label="API key">
              <div className="key-row">
                <input
                  id="s-key"
                  type={show ? 'text' : 'password'}
                  value={key}
                  placeholder={info.keyPlaceholder}
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(e) => setKeys({ ...keys, [api]: e.target.value })}
                />
                <button type="button" onClick={() => setShow(!show)}>{show ? 'Hide' : 'Show'}</button>
              </div>
            </Field>
            <Field id="s-model" label="Model">
              <div className="key-row">
                <select
                  id="s-model"
                  value={typing || !listed ? OTHER : model}
                  onChange={(e) => {
                    if (e.target.value === OTHER) setTyping(true);
                    else {
                      setTyping(false);
                      setModel(e.target.value);
                    }
                  }}
                >
                  {choices.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                  <option value={OTHER}>Another model (type its ID)…</option>
                </select>
                <button type="button" onClick={find} disabled={!key.trim() || !!busy} title="List the models your key can use that read images">
                  {busy === 'find' ? 'Finding…' : 'Find models'}
                </button>
              </div>
            </Field>
            {(typing || !listed) && (
              <Field id="s-model-id" label="Model ID">
                <input id="s-model-id" type="text" value={model} spellCheck={false} autoComplete="off" placeholder={info.models[0]?.id} onChange={(e) => setModel(e.target.value.trim())} />
              </Field>
            )}
            <span />
            <div className="checks">
              <button type="button" onClick={test} disabled={!key.trim() || !model || !!busy}>{busy === 'test' ? 'Testing…' : 'Test key'}</button>
              {status && <span className={status.ok ? 'ok-text' : 'err-text'}>{status.text}</span>}
            </div>
          </div>
          <p className="hint">
            {info.keyHelp}{' '}
            <a href={info.keyUrl} target="_blank" rel="noopener">Get a key</a>
          </p>
          <p className="hint">
            {desk
              ? 'Keys are stored on this computer only, encrypted by the operating system, and each is sent only to its own service.'
              : 'Keys are stored in this browser only, and each is sent only to its own service. Don’t save a key on a shared computer, or remove it afterwards.'}
          </p>
        </>
      ) : (
        <div className="hint chat-explain">
          <p>
            <b>For anyone with Claude, ChatGPT, Gemini or a similar app</b> — free or paid, no API key needed. Read Photo gives you the instructions to copy; you attach your photo in the app,
            paste them, and paste the reply back here to check it.
          </p>
          <p>It takes a few more taps than an API key, and the automatic correction round becomes a request you copy back into the same chat.</p>
        </div>
      )}
    </Modal>
  );
}
