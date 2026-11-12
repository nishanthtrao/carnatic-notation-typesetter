import { useEffect, useState } from 'react';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { inFrame } from '../lib/desktop';
import { shareUrl } from '../lib/share';

export function ShareDialog({ open, onClose, text }: { open: boolean; onClose: () => void; text: string }) {
  const [url, setUrl] = useState('');
  const toast = useToast();
  useEffect(() => {
    if (open) shareUrl(text).then(setUrl);
  }, [open, text]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast('Link copied');
    } catch {
      (document.getElementById('shareUrl') as HTMLInputElement | null)?.select();
      toast('Link selected — copy it');
    }
  };
  return (
    <Modal title="Share this notation" open={open} onClose={onClose}>
      <p className="hint" style={{ marginTop: 0 }}>
        Anyone who opens this link sees your notation in the editor. It is stored in the link itself, so nothing is uploaded.
      </p>
      <input className="share-url" id="shareUrl" readOnly value={url} />
      {inFrame && <p className="hint">You are using an embedded preview, so this link may not open the editor. Links work from the hosted site.</p>}
      {url.length > 8000 && <p className="hint">This link is very long; some apps may cut it off. Saving the file is more reliable for long songs.</p>}
      <div className="checks" style={{ marginTop: 8 }}>
        <button type="button" onClick={copy}>Copy link</button>
        {typeof navigator.share === 'function' && (
          <button type="button" onClick={() => navigator.share({ title: document.title, url }).catch(() => {})}>Share…</button>
        )}
      </div>
    </Modal>
  );
}
