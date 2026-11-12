import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

const ToastContext = createContext<(msg: string) => void>(() => {});

export function ToastProvider({ children, onMessage }: { children: ReactNode; onMessage?: (msg: string) => void }) {
  const [msg, setMsg] = useState('');
  const [show, setShow] = useState(false);
  const timer = useRef(0);
  const toast = useCallback(
    (m: string) => {
      setMsg(m);
      setShow(true);
      onMessage?.(m);
      clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setShow(false), 2400);
    },
    [onMessage],
  );
  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className={'toast' + (show ? ' show' : '')} role="status" aria-live="polite">
        {msg}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
