import { useCallback, useRef, useState } from 'react';
import { Modal } from '../components/Modal';

interface Ask {
  title: string;
  message: string;
  ok: string;
}

/** Promise-based confirm dialog (window.confirm is blocked in some frames). */
export function useConfirm() {
  const [ask, setAsk] = useState<Ask | null>(null);
  const resolver = useRef<(v: boolean) => void>(() => {});
  const confirm = useCallback((a: Ask) => {
    setAsk(a);
    return new Promise<boolean>((resolve) => (resolver.current = resolve));
  }, []);
  const done = (v: boolean) => {
    setAsk(null);
    resolver.current(v);
  };
  const element = (
    <Modal
      title={ask?.title || ''}
      open={!!ask}
      onClose={() => done(false)}
      footer={
        <>
          <button type="button" onClick={() => done(false)}>Cancel</button>
          <button type="button" className="primary" onClick={() => done(true)} autoFocus>{ask?.ok}</button>
        </>
      }
    >
      <p className="hint" style={{ marginTop: 0 }}>{ask?.message}</p>
    </Modal>
  );
  return { confirm, element };
}
