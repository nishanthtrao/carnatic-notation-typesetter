import { useState } from 'react';
import { Modal } from '../components/Modal';
import { parseTala, isTalaError } from '../engine';
import { LANG_OPTIONS, LAYOUT_OPTIONS, talaOptions } from '../lib/directives';
import { Check, Field, Select } from './common';

/** Asks for the song details and returns the starting directives. */
export function NewSongDialog({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: (text: string, cursorLine: number) => void }) {
  const [v, setV] = useState({ name: '', raga: '', tala: 'Adi', comp: '', layout: 'krithi', lang: 'English', smart: true });
  const set = (k: keyof typeof v) => (x: string | boolean) => setV((o) => ({ ...o, [k]: x }));
  const create = () => {
    const name = v.name.trim() || 'Untitled';
    const t = parseTala(v.tala);
    const talaName = isTalaError(t) ? v.tala : t.name;
    const parts = [name, v.raga.trim(), talaName, v.comp.trim()].filter(Boolean);
    const q = (s: string) => s.replace(/"/g, "'");
    const lines = ['Title: "' + q(name) + '"'];
    if (v.layout !== 'krithi') lines.push('Layout: ' + v.layout);
    lines.push('Tala: ' + v.tala);
    if (v.lang !== 'English') lines.push('Language: ' + v.lang);
    if (v.smart) lines.push('SmartLyricMode');
    lines.push('Heading: "' + q(parts.join(' - ')) + '",bold,center,14', 'Heading: ""', 'Heading: "pallavi:",bold,left,12', 'S: ', 'L: ');
    onCreate(lines.join('\n') + '\n', lines.length - 1);
  };
  return (
    <Modal
      title="New song"
      open={open}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="button" className="primary" onClick={create}>Create</button>
        </>
      }
    >
      <div className="form-grid">
        <Field id="f-name" label="Song">
          <input id="f-name" type="text" placeholder="e.g. brOva bhAramA" value={v.name} onChange={(e) => set('name')(e.target.value)} autoFocus />
        </Field>
        <Field id="f-raga" label="Raga">
          <input id="f-raga" type="text" placeholder="e.g. bahudAri" value={v.raga} onChange={(e) => set('raga')(e.target.value)} />
        </Field>
        <Field id="f-tala" label="Tala">
          <Select id="f-tala" value={v.tala} onChange={set('tala')} options={talaOptions()} />
        </Field>
        <Field id="f-comp" label="Composer">
          <input id="f-comp" type="text" placeholder="e.g. tyAgarAja" value={v.comp} onChange={(e) => set('comp')(e.target.value)} />
        </Field>
        <Field id="f-layout" label="Layout">
          <Select id="f-layout" value={v.layout} onChange={set('layout')} options={LAYOUT_OPTIONS} />
        </Field>
        <Field id="f-lang" label="Language">
          <Select id="f-lang" value={v.lang} onChange={set('lang')} options={LANG_OPTIONS} />
        </Field>
        <span />
        <div className="checks">
          <Check checked={v.smart} onChange={set('smart')}>
            Smart lyric mode (no <code>_</code> needed for pauses)
          </Check>
        </div>
      </div>
      <p className="hint">Type names the way you would in lyrics, e.g. <code>tyAgarAja</code>. They are shown in the chosen language.</p>
    </Modal>
  );
}
