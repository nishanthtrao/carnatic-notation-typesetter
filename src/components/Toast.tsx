import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

export interface ToastAction {
  label: string;
  run: () => void;
}
type ToastFn = (msg: string, action?: ToastAction) => void;

const ToastContext = createContext<ToastFn>(() => {});

export function ToastProvider({ children, onMessage }: { children: ReactNode; onMessage?: (msg: string) => void }) {
  const [msg, setMsg] = useState('');
  const [action, setAction] = useState<ToastAction | null>(null);
  const [show, setShow] = useState(false);
  const timer = useRef(0);
  const toast = useCallback<ToastFn>(
    (m, a) => {
      setMsg(m);
      setAction(a || null);
      setShow(true);
      onMessage?.(m);
      clearTimeout(timer.current);
      // a toast with a button stays long enough to reach it
      timer.current = window.setTimeout(() => setShow(false), a ? 7000 : 2400);
    },
    [onMessage],
  );
  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className={'toast' + (show ? ' show' : '') + (action ? ' has-action' : '')} role="status" aria-live="polite">
        <span>{msg}</span>
        {action && (
          <button
            type="button"
            className="toast-action"
            onClick={() => {
              setShow(false);
              action.run();
            }}
          >
            {action.label}
          </button>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
