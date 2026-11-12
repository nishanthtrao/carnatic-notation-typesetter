import { useState } from 'react';
import { Modal } from '../components/Modal';
import { FONT_STYLES, normaliseLang, parseFontStyle, parseHeading, styleFamilies, swaraSample, transliterate, type FontStyle, type Lang } from '../engine';
import { Icon } from '../components/Icons';
import { DIRECTIVES, LANG_OPTIONS, LAYOUT_OPTIONS, talaOptions } from '../lib/directives';
import { Check, Field, Select } from './common';

export type AssistMode =
  | { kind: 'pick' }
  | { kind: 'help'; which: 'S' | 'L' }
  | { kind: 'form'; name: FormName; value: string };

export type FormName = 'Tala' | 'Layout' | 'DefaultSpeed' | 'Language' | 'LanguageFont' | 'Heading';
export const FORM_NAMES: FormName[] = ['Tala', 'Layout', 'DefaultSpeed', 'Language', 'LanguageFont', 'Heading'];

/** Work out what Assist should show for the current line. */
export function assistModeFor(line: string): AssistMode {
  const m = line.match(/^\s*([A-Za-z]+)\s*(?::\s*(.*))?$/);
  const name = m ? DIRECTIVES.find((d) => d.name.toLowerCase() === m[1].toLowerCase())?.name : undefined;
  if (name && (FORM_NAMES as string[]).includes(name)) return { kind: 'form', name: name as FormName, value: m![2] ?? '' };
  if (name === 'S' || name === 'L') return { kind: 'help', which: name };
  return { kind: 'pick' };
}

function SyntaxHelp() {
  return (
    <>
      <p className="hint" style={{ marginTop: 0 }}>
        <b>Swaras</b> (space separated): <code>s r g m p d n</code> = one mātra, <code>sa ri ga ma pa da ni</code> = two (dhīrgha). Add <code>'</code> for tara stayi (<code>s'</code>) or <code>`</code> for mandra
        (<code>p`</code>). <code>,</code> = one mātra pause, <code>;</code> = two. <code>( … )</code> doubles the speed (nest for more). <code>_</code> / <code>__</code> = empty space, <code>=</code> = same as before
        (one akshara). Gamakas after the swara: <code>~ ~~ ^ / // \ \\</code> or text <code>n(w)</code>. Phrase end: <code>p-</code>. <code>|</code> and <code>||</code> are optional; the tala places markers itself. A label goes
        first in quotes: <code>S: "1)" s r g m</code>.
      </p>
      <p className="hint">
        <b>Lyrics</b>: one entry per swara <i>and</i> pause, <code>_</code> for an empty one — or add <code>SmartLyricMode</code> and give lyrics only for swaras. Type them in the Unified Transliteration Scheme (
        <code>A I U E O</code> long vowels, <code>T D N L</code> retroflex, <code>S</code> = śa, <code>Sh</code> = ṣa).
      </p>
    </>
  );
}

interface Props {
  mode: AssistMode | null;
  onClose: () => void;
  /** replace the current line with text (or insert on a new line when insert=true) */
  onApply: (text: string, insert: boolean) => void;
  /** open a form for a directive chosen from the picker */
  onChooseForm: (name: FormName) => void;
  currentLineBlank: boolean;
}

export function AssistDialog({ mode, onClose, onApply, onChooseForm, currentLineBlank }: Props) {
  if (!mode) return null;
  if (mode.kind === 'help') {
    return (
      <Modal title={mode.which === 'S' ? 'Swara line' : 'Lyric line'} open onClose={onClose}>
        <SyntaxHelp />
      </Modal>
    );
  }
  if (mode.kind === 'pick') {
    return (
      <Modal title="Add a directive" open onClose={onClose} wide>
        <div className="pick-list">
          {DIRECTIVES.map((d) => (
            <button
              key={d.name}
              type="button"
              onClick={() => {
                if ((FORM_NAMES as string[]).includes(d.name)) onChooseForm(d.name as FormName);
                else onApply(d.template, !currentLineBlank);
              }}
            >
              <b>{d.name}</b>
              <span>{d.help}</span>
            </button>
          ))}
        </div>
        <SyntaxHelp />
      </Modal>
    );
  }
  return <DirectiveForm key={mode.name + mode.value} name={mode.name} value={mode.value} onClose={onClose} onApply={(t) => onApply(t, false)} />;
}

function DirectiveForm({ name, value, onClose, onApply }: { name: FormName; value: string; onClose: () => void; onApply: (text: string) => void }) {
  const footer = (apply: () => void) => (
    <>
      <button type="button" onClick={onClose}>Cancel</button>
      <button type="button" className="primary" onClick={apply}>OK</button>
    </>
  );

  if (name === 'Tala') return <TalaForm value={value} onClose={onClose} onApply={onApply} footer={footer} />;
  if (name === 'Heading') return <HeadingForm value={value} onClose={onClose} onApply={onApply} footer={footer} />;
  if (name === 'LanguageFont') return <LanguageFontForm value={value} onClose={onClose} onApply={onApply} footer={footer} />;
  if (name === 'Language') return <LanguageForm value={value} onClose={onClose} onApply={onApply} footer={footer} />;
  if (name === 'Layout') return <LayoutForm value={value} onClose={onClose} onApply={onApply} footer={footer} />;
  return <SimpleForm title="Default speed" label="Speed" prefix="DefaultSpeed: " initial={value.trim() || '1'} onClose={onClose} onApply={onApply} footer={footer}
      options={[['0', '0 — first speed (1 swara per akshara)'], ['1', '1 — second speed (2 per akshara)'], ['2', '2 — third speed (4 per akshara)']]} />;
}

type FormProps = { value: string; onClose: () => void; onApply: (t: string) => void; footer: (apply: () => void) => React.ReactNode };

function SimpleForm(p: { title: string; label: string; prefix: string; options: [string, string][]; initial: string; hint?: string; onClose: () => void; onApply: (t: string) => void; footer: FormProps['footer'] }) {
  const [v, setV] = useState(p.options.some(([o]) => o === p.initial) ? p.initial : p.options[0][0]);
  return (
    <Modal title={p.title} open onClose={p.onClose} footer={p.footer(() => p.onApply(p.prefix + v))}>
      <div className="form-grid">
        <Field id="a-simple" label={p.label}>
          <Select id="a-simple" value={v} onChange={setV} options={p.options} />
        </Field>
      </div>
      {p.hint && <p className="hint">{p.hint}</p>}
    </Modal>
  );
}

function LayoutForm({ value, onClose, onApply, footer }: FormProps) {
  const parts = value.split(',').map((x) => x.trim().toLowerCase());
  const [layout, setLayout] = useState(LAYOUT_OPTIONS.some(([o]) => o === parts[0]) ? parts[0] : 'krithi');
  const [lineUp, setLineUp] = useState(!parts.includes('compact'));
  const [fullWidth, setFullWidth] = useState(parts.includes('fullwidth'));
  const apply = () => onApply('Layout: ' + layout + (lineUp ? '' : ',Compact') + (fullWidth ? ',FullWidth' : ''));
  return (
    <Modal title="Layout" open onClose={onClose} footer={footer(apply)}>
      <div className="form-grid">
        <Field id="a-layout" label="Layout">
          <Select id="a-layout" value={layout} onChange={setLayout} options={LAYOUT_OPTIONS} />
        </Field>
        <span />
        <div className="checks">
          <Check checked={lineUp} onChange={setLineUp}>Line up bars across rows</Check>
          <Check checked={fullWidth} onChange={setFullWidth}>Stretch rows to the full page width</Check>
        </div>
      </div>
      <p className="hint">
        Gitam: first speed, space after each akshara. Varnam: second speed, aligned at each akshara. Krithi: second speed, aligned at angas.
        Turn off <i>Line up bars</i> to set each row at its natural width, without extra space to match the rows around it.
      </p>
    </Modal>
  );
}

function TalaForm({ value, onClose, onApply, footer }: FormProps) {
  const parts = value.split(',').map((s) => s.trim());
  const opts = parts.slice(1).map((s) => s.toLowerCase());
  const options = talaOptions();
  const [tala, setTala] = useState(options.find(([v]) => v.toLowerCase() === (parts[0] || 'adi').toLowerCase())?.[0] || 'Adi');
  const [manual, setManual] = useState(opts.includes('manual'));
  const [inline, setInline] = useState(opts.includes('inlinetalamarkers'));
  const apply = () => {
    let out = 'Tala: ' + tala;
    if (tala !== 'Manual' && manual) out += ',Manual';
    if (inline && (manual || tala === 'Manual')) out += ',InlineTalaMarkers';
    onApply(out);
  };
  return (
    <Modal title="Tala" open onClose={onClose} footer={footer(apply)}>
      <div className="form-grid">
        <Field id="a-tala" label="Tala">
          <Select id="a-tala" value={tala} onChange={setTala} options={options} />
        </Field>
        <span />
        <div className="checks">
          <Check checked={manual} onChange={setManual}>Manual line breaks</Check>
          <Check checked={inline} onChange={setInline}>Inline tala markers</Check>
        </div>
      </div>
      <p className="hint">With manual line breaks, a new notation line starts only at <code>LineBreak</code> or <code>SongBreak</code>.</p>
    </Modal>
  );
}

function LanguageForm({ value, onClose, onApply, footer }: FormProps) {
  const parts = value.split(':').map((s) => s.trim().toLowerCase());
  const [lang, setLang] = useState(LANG_OPTIONS.find(([v]) => v.toLowerCase() === parts[0])?.[0] || 'English');
  const [granthasa, setGranthasa] = useState(parts.includes('granthasa'));
  const [noqual, setNoqual] = useState(parts.includes('noqual'));
  const [nochillu, setNochillu] = useState(parts.includes('nochillu'));
  const apply = () =>
    onApply(
      'Language: ' + lang +
        (lang === 'Tamil' ? (granthasa ? ':granthasa' : '') + (noqual ? ':noqual' : '') : '') +
        (lang === 'Malayalam' && nochillu ? ':nochillu' : ''),
    );
  return (
    <Modal title="Language" open onClose={onClose} footer={footer(apply)}>
      <div className="form-grid">
        <Field id="a-lang" label="Language">
          <Select id="a-lang" value={lang} onChange={setLang} options={LANG_OPTIONS} />
        </Field>
        {lang === 'Tamil' && (
          <>
            <span />
            <div className="checks">
              <Check checked={granthasa} onChange={setGranthasa}>Use ஶ for S</Check>
              <Check checked={noqual} onChange={setNoqual}>No qualifiers (க² க³ …)</Check>
            </div>
          </>
        )}
        {lang === 'Malayalam' && (
          <>
            <span />
            <div className="checks">
              <Check checked={nochillu} onChange={setNochillu}>Plain virama at word ends (ന് rather than ൻ)</Check>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

const ALL_SCRIPTS: Lang[] = ['english', 'devanagari', 'telugu', 'kannada', 'malayalam', 'tamil'];

function fontSample(lang: Lang, many: boolean): string {
  const words = transliterate('brOva bhAramA', lang);
  return many ? words : words + '   ' + swaraSample(lang);
}

function LanguageFontForm({ value, onClose, onApply, footer }: FormProps) {
  const parts = value.split(',').map((x) => x.trim());
  const langOpts: [string, string][] = [['All', 'All languages'], ...LANG_OPTIONS];
  const [lang, setLang] = useState(langOpts.find(([v]) => v.toLowerCase() === (parts[0] || '').toLowerCase())?.[0] || 'All');
  const rest = parts.slice(1).join(',');
  const initial: FontStyle | 'custom' = parseFontStyle(rest) || (rest ? 'custom' : 'serif');
  const [choice, setChoice] = useState<FontStyle | 'custom'>(initial);
  const [custom, setCustom] = useState(initial === 'custom' ? rest : '');
  const one = lang === 'All' ? null : normaliseLang(lang);
  const shown: Lang[] = one ? [one] : ALL_SCRIPTS;
  const apply = () =>
    onApply('LanguageFont: ' + lang + ',' + (choice === 'custom' ? custom.trim() || 'Serif' : FONT_STYLES.find((s) => s.id === choice)!.name));
  return (
    <Modal title="Font" open onClose={onClose} footer={footer(apply)} wide>
      <div className="form-grid">
        <Field id="a-flang" label="Language">
          <Select id="a-flang" value={lang} onChange={setLang} options={langOpts} />
        </Field>
      </div>
      <div className="font-choices" role="radiogroup" aria-label="Font style">
        {FONT_STYLES.map((s) => (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={choice === s.id}
            className={'font-choice' + (choice === s.id ? ' selected' : '')}
            onClick={() => setChoice(s.id)}
          >
            <span className="fc-head">
              <b>{s.label}</b>
              <span className="fc-about">{s.about}</span>
              {choice === s.id && <Icon name="check" />}
            </span>
            <span className={'fc-sample' + (shown.length > 1 ? ' many' : '')}>
              {shown.map((l) => (
                <span key={l} style={{ fontFamily: styleFamilies(s.id, l) + ', var(--font)' }}>
                  {fontSample(l, shown.length > 1)}
                </span>
              ))}
            </span>
          </button>
        ))}
        <div
          role="radio"
          aria-checked={choice === 'custom'}
          tabIndex={0}
          className={'font-choice' + (choice === 'custom' ? ' selected' : '')}
          onClick={() => setChoice('custom')}
          onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && setChoice('custom')}
        >
          <span className="fc-head">
            <b>Installed font</b>
            <span className="fc-about">a font on the reader's own device</span>
            {choice === 'custom' && <Icon name="check" />}
          </span>
          <input
            type="text"
            placeholder="e.g. Latha or Nirmala UI"
            value={custom}
            onFocus={() => setChoice('custom')}
            onChange={(e) => setCustom(e.target.value)}
            aria-label="Installed font name"
          />
        </div>
      </div>
      <p className="hint">The three styles are built in, so the sheet looks the same on every device. An installed font shows only where it is installed.</p>
    </Modal>
  );
}

function HeadingForm({ value, onClose, onApply, footer }: FormProps) {
  const h = parseHeading(value || '""');
  const langName = h.lang ? (h.lang.lang === 'iast' ? 'Diacritics' : h.lang.lang === 'devanagari' ? 'Sanskrit' : h.lang.lang.charAt(0).toUpperCase() + h.lang.lang.slice(1)) : '';
  const [v, setV] = useState({ text: h.text, size: h.size ? String(h.size) : '', align: h.align || '', lang: langName, bold: h.bold, italic: h.italic, underline: h.underline });
  const set = <K extends keyof typeof v>(k: K) => (x: (typeof v)[K]) => setV((o) => ({ ...o, [k]: x }));
  const apply = () => {
    const attrs: string[] = [];
    if (h.font) attrs.push(h.font);
    if (v.size) attrs.push(v.size);
    if (v.bold) attrs.push('bold');
    if (v.italic) attrs.push('italic');
    if (v.underline) attrs.push('underline');
    if (v.align) attrs.push(v.align);
    if (v.lang) attrs.push(v.lang.toLowerCase());
    onApply('Heading: "' + v.text.replace(/"/g, "'") + '"' + (attrs.length ? ',' + attrs.join(',') : ''));
  };
  return (
    <Modal title="Heading" open onClose={onClose} footer={footer(apply)}>
      <div className="form-grid">
        <Field id="a-ht" label="Text">
          <input id="a-ht" type="text" value={v.text} placeholder="leave empty for a blank line" onChange={(e) => set('text')(e.target.value)} autoFocus />
        </Field>
        <Field id="a-hs" label="Size (pt)">
          <input id="a-hs" type="number" min={6} max={40} value={v.size} placeholder="default" onChange={(e) => set('size')(e.target.value)} />
        </Field>
        <Field id="a-ha" label="Align">
          <Select id="a-ha" value={v.align} onChange={set('align')} options={[['', 'default (left)'], ['left', 'Left'], ['center', 'Center'], ['right', 'Right']]} />
        </Field>
        <Field id="a-hl" label="Language">
          <Select id="a-hl" value={v.lang} onChange={set('lang')} options={[['', 'same as Language:'] as [string, string]].concat(LANG_OPTIONS)} />
        </Field>
        <span />
        <div className="checks">
          <Check checked={v.bold} onChange={set('bold')}>Bold</Check>
          <Check checked={v.italic} onChange={set('italic')}>Italic</Check>
          <Check checked={v.underline} onChange={set('underline')}>Underline</Check>
        </div>
      </div>
      <p className="hint">Inside the text: <code>*bold*</code>, <code>_italic_</code>, <code>[br]</code> for a new line, <code>---</code> for a rule.</p>
    </Modal>
  );
}
