import { Modal } from '../components/Modal';
import { examples, type Example } from '../engine';

export function ExamplesDialog({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (ex: Example) => void }) {
  return (
    <Modal title="Examples" open={open} onClose={onClose}>
      <div className="pick-list">
        {examples.map((ex) => (
          <button key={ex.id} type="button" onClick={() => onPick(ex)}>
            <b>{ex.title}</b>
          </button>
        ))}
      </div>
      <p className="hint">Opening an example replaces what is in the editor.</p>
    </Modal>
  );
}
