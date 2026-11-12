import { useEffect, useRef, useState } from 'react';
import { Modal } from '../components/Modal';
import { FONT_STYLES, normaliseLang, parse, parseFontStyle, parseGati, parseHeading, render, styleFamilies, swaraSample, SWARA_RE, transliterate, type FontStyle, type Lang } from '../engine';
import { Icon } from '../components/Icons';
import { DIRECTIVES, LANG_OPTIONS, LAYOUT_OPTIONS, talaOptions } from '../lib/directives';
import { Check, Field, Select } from './common';

export type AssistMode =
  | { kind: 'pick' }
  | { kind: 'help'; which: 'S' | 'L' }
  | { kind: 'form'; name: FormName; value: string; range?: [number, number]; context?: string; line?: string };

const PREFS = ['SwaraPrefs', 'LyricPrefs', 'HeadingPrefs', 'GamakaPrefs'] as const;
type PrefsName = (typeof PREFS)[number];
export type FormName =
  | 'Tala' | 'Gati' | 'Layout' | 'DefaultSpeed' | 'Language' | 'LanguageFont' | 'Heading'
  | 'SpeedMarks' | 'PhraseEnds' | 'Title' | 'Orientation' | 'Scale' | PrefsName;
export const FORM_NAMES: FormName[] = [
  'Tala', 'Gati', 'Layout', 'DefaultSpeed', 'Language', 'LanguageFont', 'Heading',
  'SpeedMarks', 'PhraseEnds', 'Title', 'Orientation', 'Scale', ...PREFS,
];

/** Raga, Arohana and Avarohana lines are edited together in the Scale form. */
export const SCALE_LINE = /^\s*(raga|ragam|arohana|arohanam|avarohana|avarohanam)\s*:/i;

/** The form a directive opens, if any. */
export function formFor(name: string): FormName | null {
  if (SCALE_LINE.test(name + ':')) return 'Scale';
  return (FORM_NAMES as string[]).includes(name) ? (name as FormName) : null;
}

/** Work out what Assist should show for the current line. */
export function assistModeFor(line: string): AssistMode {
  if (SCALE_LINE.test(line)) return { kind: 'form', name: 'Scale', value: line };
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
                const form = formFor(d.name);
                if (form) onChooseForm(form);
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
  if (mode.name === 'Scale')
    return <ScaleForm key={mode.value} value={mode.value} line={mode.line ?? mode.value} context={mode.context || ''} onClose={onClose} onApply={(t) => onApply(t, false)} />;
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
  if (name === 'Gati') {
    const g = parseGati(value) || 'catusra';
    return (
      <SimpleForm
        title="Gati"
        label="Gati"
        prefix="Gati: "
        initial={GATI_OPTIONS.find(([o]) => o.toLowerCase() === g)?.[0] || 'Catusra'}
        options={GATI_OPTIONS}
        hint="Changes the gati (nadai) from the next swara. In third speed, tiśra, khaṇḍa, miśra and saṅkīrṇa show 3, 5, 7 or 9 swaras per akshara; choose catuśra to go back to the usual 4."
        onClose={onClose}
        onApply={onApply}
        footer={footer}
      />
    );
  }
  if (name === 'SpeedMarks')
    return (
      <SimpleForm title="Speed marks" label="Draw speed lines" prefix="SpeedMarks: " initial={/^below$/i.test(value.trim()) ? 'below' : 'above'}
        options={[['above', 'Above the swaras (default)'], ['below', 'Below the swaras']]}
        hint="Speed lines group the faster swaras written in ( ). Applies from the next swara line." onClose={onClose} onApply={onApply} footer={footer} />
    );
  if (name === 'Orientation')
    return (
      <SimpleForm title="Page orientation" label="Orientation" prefix="Orientation: " initial={/^land/i.test(value.trim()) ? 'Landscape' : 'Portrait'}
        options={[['Portrait', 'Portrait (default)'], ['Landscape', 'Landscape']]}
        hint="Used when printing or exporting a PDF." onClose={onClose} onApply={onApply} footer={footer} />
    );
  if (name === 'PhraseEnds') return <PhraseEndsForm value={value} onClose={onClose} onApply={onApply} footer={footer} />;
  if (name === 'Title') return <TitleForm value={value} onClose={onClose} onApply={onApply} footer={footer} />;
  if ((PREFS as readonly string[]).includes(name)) return <PrefsForm name={name as PrefsName} value={value} onClose={onClose} onApply={onApply} footer={footer} />;
  if (name === 'Layout') return <LayoutForm value={value} onClose={onClose} onApply={onApply} footer={footer} />;
  return <SimpleForm title="Default speed" label="Speed" prefix="DefaultSpeed: " initial={value.trim() || '1'} onClose={onClose} onApply={onApply} footer={footer}
      options={[['0', '0 — first speed (1 swara per akshara)'], ['1', '1 — second speed (2 per akshara)'], ['2', '2 — third speed (4 per akshara)']]} />;
}

const GATI_OPTIONS: [string, string][] = [
  ['Tisra', 'Tiśra (3)'],
  ['Catusra', 'Catuśra (4) — the usual'],
  ['Khanda', 'Khaṇḍa (5)'],
  ['Misra', 'Miśra (7)'],
  ['Sankirna', 'Saṅkīrṇa (9)'],
];

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

const PHRASE_STYLES: [string, string][] = [
  ['Hide', 'Hidden (default)'],
  ['Show', 'Shown as a hyphen'],
  ['Handle', 'Small corner mark'],
  ['HandleThick', 'Thick corner mark'],
];

function PhraseEndsForm({ value, onClose, onApply, footer }: FormProps) {
  const parts = value.split(',').map((x) => x.trim());
  const [style, setStyle] = useState(PHRASE_STYLES.find(([v]) => v.toLowerCase() === (parts[0] || '').toLowerCase())?.[0] || 'Hide');
  const sm = (parts[1] || '').match(/^(\d+(?:\.\d+)?)\s*(in|px)?$/i);
  const [space, setSpace] = useState(sm ? sm[1] : '');
  const [unit, setUnit] = useState(sm && sm[2] && sm[2].toLowerCase() === 'in' ? 'in' : 'px');
  const ok = !space.trim() || /^\d+(\.\d+)?$/.test(space.trim());
  const apply = () => ok && onApply('PhraseEnds: ' + style + (space.trim() ? ',' + space.trim() + (unit === 'in' ? 'in' : '') : ''));
  return (
    <Modal title="Phrase ends" open onClose={onClose} footer={footer(apply)}>
      <div className="form-grid">
        <Field id="a-pe-style" label="Mark">
          <Select id="a-pe-style" value={style} onChange={setStyle} options={PHRASE_STYLES} />
        </Field>
        <Field id="a-pe-space" label="Extra space">
          <div className="inline-fields">
            <input id="a-pe-space" type="number" min="0" step="any" inputMode="decimal" placeholder="none" value={space} onChange={(e) => setSpace(e.target.value)} aria-invalid={!ok} />
            <Select id="a-pe-unit" value={unit} onChange={setUnit} options={[['px', 'pixels'], ['in', 'inches']]} />
          </div>
        </Field>
      </div>
      <p className="hint">A phrase end is a hyphen after a swara (<code>p-</code>), e.g. where to breathe. Extra space separates phrases; 0.45 inches is a good start for manual-mode layouts.</p>
    </Modal>
  );
}

function TitleForm({ value, onClose, onApply, footer }: FormProps) {
  const [title, setTitle] = useState(value.trim().replace(/^"([\s\S]*)"$/, '$1'));
  return (
    <Modal title="Page title" open onClose={onClose} footer={footer(() => onApply('Title: "' + title.replace(/"/g, "'") + '"'))}>
      <div className="form-grid">
        <Field id="a-title" label="Title">
          <input id="a-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. brOva bhAramA" autoFocus />
        </Field>
      </div>
      <p className="hint">Names the document (window title, file name and the print header). It is not printed on the sheet; use a Heading for that.</p>
    </Modal>
  );
}

const PREFS_INFO: Record<PrefsName, { title: string; what: string }> = {
  SwaraPrefs: { title: 'Swara size and colour', what: 'swaras' },
  LyricPrefs: { title: 'Lyric size and colour', what: 'lyrics' },
  HeadingPrefs: { title: 'Heading size and colour', what: 'headings (unless a heading sets its own)' },
  GamakaPrefs: { title: 'Gamaka text size and colour', what: 'text gamakas such as n(w)' },
};

/** Any CSS colour -> #rrggbb for <input type="color"> (null if it isn't a colour). */
function toHex(c: string): string | null {
  if (/^#[0-9a-f]{6}$/i.test(c)) return c.toLowerCase();
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#010203';
  ctx.fillStyle = c;
  const v = String(ctx.fillStyle);
  return v === '#010203' && c.toLowerCase() !== '#010203' ? null : /^#[0-9a-f]{6}$/i.test(v) ? v : null;
}

function PrefsForm({ name, value, onClose, onApply, footer }: FormProps & { name: PrefsName }) {
  const parts = value.split(',').map((x) => x.trim()).filter(Boolean);
  // rgb(…) contains commas: rejoin it
  const joined = value.match(/rgba?\([^)]*\)/i)?.[0];
  const sizeIn = parts.find((p) => /^\d+(\.\d+)?$/.test(p)) || '';
  const colorIn = joined || parts.find((p) => !/^\d+(\.\d+)?$/.test(p) && !/^\d/.test(p)) || '';
  const [size, setSize] = useState(sizeIn);
  const [useColor, setUseColor] = useState(!!colorIn && !!toHex(colorIn));
  const [color, setColor] = useState(toHex(colorIn) || (name === 'LyricPrefs' ? '#1f3f99' : '#222222'));
  const [colorTouched, setColorTouched] = useState(false);
  const ok = !size.trim() || (/^\d+(\.\d+)?$/.test(size.trim()) && +size >= 6 && +size <= 48);
  const apply = () => {
    if (!ok) return;
    // keep the colour as written (e.g. green, rgb(…)) unless a new one was picked
    const out = [size.trim(), useColor ? (colorTouched || !colorIn ? color : colorIn) : ''].filter(Boolean);
    onApply(name + ': ' + (out.join(',') || '12'));
  };
  return (
    <Modal title={PREFS_INFO[name].title} open onClose={onClose} footer={footer(apply)}>
      <div className="form-grid">
        <Field id="a-pref-size" label="Size (pt)">
          <input id="a-pref-size" type="number" min="6" max="48" step="0.5" inputMode="decimal" placeholder="default" value={size} onChange={(e) => setSize(e.target.value)} aria-invalid={!ok} />
        </Field>
        <span />
        <div className="checks">
          <Check checked={useColor} onChange={setUseColor}>Custom colour</Check>
        </div>
        {useColor && (
          <Field id="a-pref-color" label="Colour">
            <div className="inline-fields">
              <input id="a-pref-color" type="color" value={color} onChange={(e) => { setColor(e.target.value); setColorTouched(true); }} />
              <code>{color}</code>
            </div>
          </Field>
        )}
      </div>
      <p className="hint">
        Applies to {PREFS_INFO[name].what} from this point on. {name === 'SwaraPrefs' ? 'The sheet scales to fit the page, so sizes are relative to each other.' : ''}
      </p>
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

// ---- Scale: raga name, ārōhaṇam and avarōhaṇam --------------------------------------

/** Well-known ragas to start from: [label, name as typed, ārōhaṇam, avarōhaṇam]. */
const RAGAS: [string, string, string, string][] = [
  ['Ābhōgi', 'AbhOgi', "s r2 g2 m1 d2 s'", "s' d2 m1 g2 r2 s"],
  ['Bilahari', 'bilahari', "s r2 g3 p d2 s'", "s' n3 d2 p m1 g3 r2 s"],
  ['Haṃsadhvani', 'haMsadhvani', "s r2 g3 p n3 s'", "s' n3 p g3 r2 s"],
  ['Harikāmbhōji', 'harikAmbhOji', "s r2 g3 m1 p d2 n2 s'", "s' n2 d2 p m1 g3 r2 s"],
  ['Hindōḷam', 'hindOLam', "s g2 m1 d1 n2 s'", "s' n2 d1 m1 g2 s"],
  ['Kalyāṇi', 'kalyANi', "s r2 g3 m2 p d2 n3 s'", "s' n3 d2 p m2 g3 r2 s"],
  ['Kānaḍa', 'kAnaDa', "s r2 g2 m1 d2 n2 s'", "s' n2 p m1 g2 m1 r2 s"],
  ['Kharaharapriya', 'kharaharapriya', "s r2 g2 m1 p d2 n2 s'", "s' n2 d2 p m1 g2 r2 s"],
  ['Madhyamāvati', 'madhyamAvati', "s r2 m1 p n2 s'", "s' n2 p m1 r2 s"],
  ['Māyāmāḷavagauḷa', 'mAyAmALavagauLa', "s r1 g3 m1 p d1 n3 s'", "s' n3 d1 p m1 g3 r1 s"],
  ['Mōhanam', 'mOhanam', "s r2 g3 p d2 s'", "s' d2 p g3 r2 s"],
  ['Śaṅkarābharaṇam', 'SaMkarAbharaNam', "s r2 g3 m1 p d2 n3 s'", "s' n3 d2 p m1 g3 r2 s"],
  ['Tōḍi', 'tODi', "s r1 g2 m1 p d1 n2 s'", "s' n2 d1 p m1 g2 r1 s"],
];

/** Keypad: each group is one swara and its variants. */
const KEYPAD: string[][] = [['s'], ['r1', 'r2', 'r3'], ['g1', 'g2', 'g3'], ['m1', 'm2'], ['p'], ['d1', 'd2', 'd3'], ['n1', 'n2', 'n3']];
type Octave = 'lower' | 'middle' | 'upper';
const OCTAVE_MARK: Record<Octave, string> = { lower: '`', middle: '', upper: "'" };

/** Tokens that are not swaras (so the field can be marked). */
function badSwaras(line: string): string[] {
  return line.split(/\s+/).filter((t) => t && !SWARA_RE.test(t));
}

function ScalePreview({ text }: { text: string }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (el.current) render(parse(text), el.current, { emptyText: 'The scale will show here.' });
  }, [text]);
  return <div ref={el} className="scale-preview" aria-label="Preview" />;
}

function ScaleForm({ value, line, context, onClose, onApply }: { value: string; line: string; context: string; onClose: () => void; onApply: (t: string) => void }) {
  const lines = value.split('\n');
  const find = (re: RegExp) => (lines.find((l) => re.test(l)) || '').replace(/^[^:]*:\s*/, '').trim();
  const [raga, setRaga] = useState(find(/^\s*raga(m)?\s*:/i));
  const [aro, setAro] = useState(find(/^\s*arohana(m)?\s*:/i));
  const [ava, setAva] = useState(find(/^\s*avarohana(m)?\s*:/i));
  const [target, setTarget] = useState<'aro' | 'ava'>(/^\s*avarohana/i.test(line) ? 'ava' : 'aro');
  const [octave, setOctave] = useState<Octave>('middle');
  const [preset, setPreset] = useState('');
  const aroRef = useRef<HTMLInputElement>(null);
  const avaRef = useRef<HTMLInputElement>(null);
  // start in the line the cursor was on (after the dialog has placed its own focus)
  useEffect(() => {
    const t = setTimeout(() => (target === 'aro' ? aroRef : avaRef).current?.focus(), 0);
    return () => clearTimeout(t);
  }, []);

  const output = [raga.trim() && 'Raga: ' + raga.trim(), aro.trim() && 'Arohana: ' + aro.trim(), ava.trim() && 'Avarohana: ' + ava.trim()].filter(Boolean).join('\n');
  const aroBad = badSwaras(aro);
  const avaBad = badSwaras(ava);
  const ok = !aroBad.length && !avaBad.length;

  const set = target === 'aro' ? setAro : setAva;
  const press = (key: string) => {
    set((v) => (v.trim() ? v.trimEnd() + ' ' : '') + key + OCTAVE_MARK[octave]);
    setOctave('middle');
    (target === 'aro' ? aroRef : avaRef).current?.focus();
  };
  const backspace = () => set((v) => v.trim().split(/\s+/).slice(0, -1).join(' '));
  const reverse = () => {
    setAva(aro.trim().split(/\s+/).filter(Boolean).reverse().join(' '));
    setTarget('ava');
  };
  const choosePreset = (label: string) => {
    setPreset(label);
    const r = RAGAS.find(([l]) => l === label);
    if (!r) return;
    setRaga(r[1]);
    setAro(r[2]);
    setAva(r[3]);
  };

  return (
    <Modal
      title="Scale"
      open
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="button" className="primary" disabled={!ok} onClick={() => ok && onApply(output)}>OK</button>
        </>
      }
    >
      <div className="form-grid">
        <Field id="a-sc-preset" label="Start from">
          <Select id="a-sc-preset" value={preset} onChange={choosePreset} options={[['', 'a raga…'] as [string, string]].concat(RAGAS.map(([l]): [string, string] => [l, l]))} />
        </Field>
        <Field id="a-sc-raga" label="Raga name">
          <input id="a-sc-raga" type="text" value={raga} placeholder="optional, e.g. kAnaDa" onChange={(e) => setRaga(e.target.value)} />
        </Field>
        <Field id="a-sc-aro" label="Ārōhaṇam">
          <input
            id="a-sc-aro"
            ref={aroRef}
            type="text"
            className={'scale-field' + (target === 'aro' ? ' active' : '')}
            value={aro}
            placeholder="s r2 g3 p d2 s'"
            spellCheck={false}
            autoCapitalize="off"
            onFocus={() => setTarget('aro')}
            onChange={(e) => setAro(e.target.value)}
            aria-invalid={aroBad.length > 0}
          />
        </Field>
        <Field id="a-sc-ava" label="Avarōhaṇam">
          <div className="inline-fields">
            <input
              id="a-sc-ava"
              ref={avaRef}
              type="text"
              className={'scale-field' + (target === 'ava' ? ' active' : '')}
              value={ava}
              placeholder="s' d2 p g3 r2 s"
              spellCheck={false}
              autoCapitalize="off"
              onFocus={() => setTarget('ava')}
              onChange={(e) => setAva(e.target.value)}
              aria-invalid={avaBad.length > 0}
            />
            <button type="button" onClick={reverse} disabled={!aro.trim()} title="Fill the avarōhaṇam with the ārōhaṇam reversed">
              Reverse ārōhaṇam
            </button>
          </div>
        </Field>
      </div>

      <div className="scale-pad" aria-label={'Add a swara to the ' + (target === 'aro' ? 'ārōhaṇam' : 'avarōhaṇam')}>
        <div className="seg" role="radiogroup" aria-label="Octave of the next swara">
          {(['lower', 'middle', 'upper'] as Octave[]).map((o) => (
            <button key={o} type="button" role="radio" aria-checked={octave === o} className={octave === o ? 'on' : ''} onMouseDown={(e) => e.preventDefault()} onClick={() => setOctave(o)}>
              {o === 'lower' ? 'Lower (dot below)' : o === 'upper' ? 'Upper (dot above)' : 'Middle'}
            </button>
          ))}
        </div>
        <div className="scale-keys">
          {KEYPAD.map((group) => (
            <span key={group[0]} className="scale-group">
              {group.map((k) => (
                <button key={k} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => press(k)} aria-label={k + (octave === 'middle' ? '' : ', ' + octave + ' octave')}>
                  {k[0]}
                  {k[1] && <sub>{k[1]}</sub>}
                </button>
              ))}
            </span>
          ))}
          <button type="button" className="scale-back" onMouseDown={(e) => e.preventDefault()} onClick={backspace} aria-label="Remove the last swara" title="Remove the last swara">
            ⌫
          </button>
        </div>
      </div>

      <ScalePreview text={context + '\n' + output} />
      {!ok && <p className="hint error">Not a swara: {[...aroBad, ...avaBad].map((t) => '“' + t + '”').join(', ')}</p>}
      <p className="hint">
        Tap a swara to add it to the highlighted line. Choose <i>Upper</i> or <i>Lower</i> first for a dot above or below; you can also type <code>s'</code> or <code>n2`</code>. The labels and the raga name follow the
        document's Language.
      </p>
    </Modal>
  );
}
