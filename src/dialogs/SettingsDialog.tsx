import { useEffect, useState } from 'react';
import { Modal } from '../components/Modal';
import { MODELS, RecognitionError, testApiKey } from '../recognition/claude';
import { loadApiKey, loadModel, saveApiKey, saveModel } from '../recognition/settings';
import { desk } from '../lib/desktop';
import { Field, Select } from './common';

export function SettingsDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [key, setKey] = useState('');
  const [show, setShow] = useState(false);
  const [model, setModel] = useState(loadModel());
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStatus(null);
    setModel(loadModel());
    loadApiKey().then(setKey);
  }, [open]);

  const save = async () => {
    await saveApiKey(key);
    saveModel(model);
    onSaved();
    onClose();
  };

  const test = async () => {
    setTesting(true);
    setStatus(null);
    try {
      await testApiKey(key.trim(), model);
      setStatus({ ok: true, text: 'The key works.' });
    } catch (e) {
      setStatus({ ok: false, text: e instanceof RecognitionError ? e.message : String(e) });
    } finally {
      setTesting(false);
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
      <p className="hint" style={{ marginTop: 0 }}>
        Reading photos uses Claude, Anthropic's AI model, with your own API key. Create one at{' '}
        <a href="https://platform.claude.com/" target="_blank" rel="noopener">platform.claude.com</a> (API keys), add a little credit, and paste it here.
      </p>
      <div className="form-grid">
        <Field id="s-key" label="API key">
          <div className="key-row">
            <input id="s-key" type={show ? 'text' : 'password'} value={key} placeholder="sk-ant-…" autoComplete="off" spellCheck={false} onChange={(e) => setKey(e.target.value)} />
            <button type="button" onClick={() => setShow(!show)}>{show ? 'Hide' : 'Show'}</button>
          </div>
        </Field>
        <Field id="s-model" label="Model">
          <Select id="s-model" value={model} onChange={setModel} options={MODELS.map((m) => [m.id, m.label])} />
        </Field>
        <span />
        <div className="checks">
          <button type="button" onClick={test} disabled={!key.trim() || testing}>{testing ? 'Testing…' : 'Test key'}</button>
          {status && <span className={status.ok ? 'ok-text' : 'err-text'}>{status.text}</span>}
        </div>
      </div>
      <p className="hint">
        {desk
          ? 'The key is stored on this computer only, encrypted by the operating system, and sent only to Anthropic.'
          : 'The key is stored in this browser only and sent only to Anthropic. Don’t use this on a shared computer, or remove the key afterwards.'}{' '}
        A page costs a few US cents with Sonnet; Opus costs about twice as much.
      </p>
    </Modal>
  );
}
