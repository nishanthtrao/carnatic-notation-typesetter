import { Modal } from '../components/Modal';
import { examples, type Example } from '../engine';
import { Chevron } from './common';

export function ExamplesDialog({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (ex: Example) => void }) {
  return (
    <Modal title="Examples" open={open} onClose={onClose} dismiss="cancel">
      <ul className="list-group" role="list">
        {examples.map((ex) => (
          <li key={ex.id}>
            <button type="button" className="list-row" onClick={() => onPick(ex)}>
              <span className="list-text">
                <b>{ex.title}</b>
              </span>
              <Chevron />
            </button>
          </li>
        ))}
      </ul>
      <p className="hint">Opening an example replaces what is in the editor.</p>
    </Modal>
  );
}
