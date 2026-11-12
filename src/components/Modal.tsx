import { useEffect, useRef, type ReactNode } from 'react';

interface ModalProps {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** footer buttons; a Close button is shown when omitted */
  footer?: ReactNode;
  wide?: boolean;
}

/** Accessible modal built on the native <dialog> element. */
export function Modal({ title, open, onClose, children, footer, wide }: ModalProps) {
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
            {footer ?? (
              <button type="button" onClick={onClose}>
                Close
              </button>
            )}
          </menu>
        </div>
      )}
    </dialog>
  );
}
