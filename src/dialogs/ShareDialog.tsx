import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../components/Modal';
import { Icon } from '../components/Icons';
import { useToast } from '../components/Toast';
import { parse } from '../engine';
import { inFrame } from '../lib/desktop';
import { fileBase, notationPdf, pageImages, shareOrDownload } from '../lib/exportPages';
import { shareUrl } from '../lib/share';

export function ShareDialog({ open, onClose, text }: { open: boolean; onClose: () => void; text: string }) {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState('');
  const toast = useToast();
  const doc = useMemo(() => (open ? parse(text) : null), [open, text]);
  const canShareFiles = typeof navigator.share === 'function' && typeof navigator.canShare === 'function';
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

  const send = async (kind: 'pdf' | 'images') => {
    if (!doc || busy) return;
    const base = fileBase(doc);
    const progress = (n: number, of: number) => setBusy(of > 1 ? 'Making page ' + n + ' of ' + of + '…' : 'Making the ' + (kind === 'pdf' ? 'PDF' : 'picture') + '…');
    setBusy('Getting the pages ready…');
    try {
      let files: File[];
      if (kind === 'pdf') {
        files = [new File([await notationPdf(doc, progress)], base + '.pdf', { type: 'application/pdf' })];
      } else {
        const p = await pageImages(doc, progress);
        files = p.images.map((b, i) => new File([b], base + (p.images.length > 1 ? '-' + (i + 1) : '') + '.jpg', { type: 'image/jpeg' }));
      }
      setBusy('');
      const how = await shareOrDownload(files, doc.title || 'Notation');
      if (how === 'downloaded') toast(files.length > 1 ? 'Saved ' + files.length + ' pictures' : 'Saved ' + files[0].name);
    } catch (e) {
      setBusy('');
      console.error(e);
      toast('This browser could not make the ' + (kind === 'pdf' ? 'PDF' : 'pictures') + '. Use Print and choose “Save as PDF” instead.');
    }
  };

  return (
    <Modal title="Share this notation" open={open} onClose={onClose}>
      <div className="share-files">
        <button type="button" className="primary" disabled={!!busy || !doc?.blocks.length} onClick={() => send('pdf')}>
          <Icon name="pdf" />
          {canShareFiles ? 'Send as PDF' : 'Save as PDF'}
        </button>
        <button type="button" disabled={!!busy || !doc?.blocks.length} onClick={() => send('images')}>
          <Icon name="photo" />
          {canShareFiles ? 'Send as pictures' : 'Save as pictures'}
        </button>
      </div>
      <p className="hint" role="status">
        {busy ||
          (canShareFiles
            ? 'Opens your phone’s share menu (WhatsApp, email…). A PDF keeps the pages together; pictures show right in the chat, one per page.'
            : 'Saves the sheet to your device, ready to attach in WhatsApp or email. A PDF keeps the pages together; pictures are one per page.')}
      </p>

      <h3 className="share-sub">Or send a link</h3>
      <p className="hint" style={{ marginTop: 0 }}>
        Anyone who opens this link sees your notation in the editor and can change their own copy. It is stored in the link itself, so nothing is uploaded.
      </p>
      <input className="share-url" id="shareUrl" readOnly value={url} />
      {inFrame && <p className="hint">You are using an embedded preview, so this link may not open the editor. Links work from the hosted site.</p>}
      {url.length > 8000 && <p className="hint">This link is very long; some apps may cut it off. A PDF is more reliable for long songs.</p>}
      <div className="checks" style={{ marginTop: 8 }}>
        <button type="button" onClick={copy}>Copy link</button>
        {typeof navigator.share === 'function' && (
          <button type="button" onClick={() => navigator.share({ title: document.title, url }).catch(() => {})}>Share link…</button>
        )}
      </div>
    </Modal>
  );
}
