import { useEffect, useRef, type ReactNode } from 'react';

interface ModalProps {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** footer buttons; when omitted, a single Done (or Cancel) button */
  footer?: ReactNode;
  /** Done for something to look at or use; Cancel for a chooser that does nothing unless you pick */
  dismiss?: 'done' | 'cancel';
  wide?: boolean;
}

/** Accessible modal built on the native <dialog> element. */
export function Modal({ title, open, onClose, children, footer, dismiss = 'done', wide }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      if (typeof d.showModal === 'function') d.showModal();
      else d.setAttribute('open', '');
    } else if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={'dlg' + (wide ? ' wide' : '')}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose(); // click on the backdrop
      }}
    >
      {open && (
        <div className="dlg-inner">
          <h2>{title}</h2>
          <div className="dlg-body">{children}</div>
          <menu>
            {footer ??
              (dismiss === 'cancel' ? (
                <button type="button" onClick={onClose}>
                  Cancel
                </button>
              ) : (
                <button type="button" className="primary" onClick={onClose}>
                  Done
                </button>
              ))}
          </menu>
        </div>
      )}
    </dialog>
  );
}
