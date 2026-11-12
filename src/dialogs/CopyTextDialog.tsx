import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';

/** Fallback when downloads are blocked: show the text with a Copy button. */
export function CopyTextDialog({ open, onClose, text, message }: { open: boolean; onClose: () => void; text: string; message: string }) {
  const toast = useToast();
  return (
    <Modal title="Save" open={open} onClose={onClose}>
      <p className="hint" style={{ marginTop: 0 }}>{message}</p>
      <textarea id="copyText" rows={8} readOnly value={text} className="mono-box" />
      <div className="checks" style={{ marginTop: 8 }}>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              toast('Copied');
            } catch {
              (document.getElementById('copyText') as HTMLTextAreaElement | null)?.select();
              toast('Text selected — copy it');
            }
          }}
        >
          Copy text
        </button>
      </div>
    </Modal>
  );
}
