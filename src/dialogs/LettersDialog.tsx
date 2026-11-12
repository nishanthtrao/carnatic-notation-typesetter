/*
 * Letters kit (Ctrl+K): similar-sounding letters in the song's script, how to
 * type them, and spelling variants of the word at the cursor.
 * SPDX-License-Identifier: GPL-2.0-only
 */
import { useMemo, useState } from 'react';
import { LANGS, type Lang } from '../engine';
import { Modal } from '../components/Modal';
import { renderUnit, searchGroups, wordVariants } from '../lib/soundalikes';

export interface LettersContext {
  lang: Lang;
  /** the word at the cursor in lyric/heading text, with its position */
  word: { text: string; start: number; end: number } | null;
}

const LANG_CHOICES = Object.entries(LANGS) as [Lang, string][];

export function LettersDialog({
  ctx,
  onClose,
  onInsert,
  onReplaceWord,
}: {
  ctx: LettersContext | null;
  onClose: () => void;
  onInsert: (code: string) => void;
  onReplaceWord: (text: string) => void;
}) {
  const [lang, setLang] = useState<Lang>(ctx?.lang || 'english');
  const [query, setQuery] = useState('');
  const latin = lang === 'english' || lang === 'iast';
  const shownLang: Lang = latin ? 'iast' : lang;
  const variants = useMemo(() => (ctx?.word ? wordVariants(ctx.word.text, shownLang) : []), [ctx, shownLang]);
  const groups = useMemo(() => searchGroups(query), [query]);
  if (!ctx) return null;
  return (
    <Modal title="Letters" open onClose={onClose} wide>
      <div className="letters-top">
        <label htmlFor="lt-lang">Script</label>
        <select id="lt-lang" value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
          {LANG_CHOICES.map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
        <input
          type="search"
          placeholder="Find a sound: r, n, zh, sh, ḷa…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Find a sound"
          autoFocus={!ctx.word}
        />
      </div>

      {ctx.word && variants.length > 1 && !query && (
        <section className="letters-variants">
          <h4>
            Other spellings of <code>{ctx.word.text}</code>
          </h4>
          <div className="variant-chips" role="list">
            {variants.map((vr) => (
              <button
                key={vr.text}
                type="button"
                role="listitem"
                className={'variant' + (vr.current ? ' current' : '')}
                onClick={() => (vr.current ? onClose() : onReplaceWord(vr.text))}
                title={vr.current ? 'What you typed' : 'Use ' + vr.text + ' (' + vr.change + ')'}
              >
                <span className={'vr-glyph cm-lang-' + shownLang}>{vr.shown}</span>
                <code>{vr.text}</code>
              </button>
            ))}
          </div>
          <p className="hint">Each spelling differs from yours in one similar-sounding letter. Tap one to put it in place of your word.</p>
        </section>
      )}

      <div className="letter-groups">
        {groups.map((g) => (
          <section key={g.id} className="letter-group">
            <h4>{g.title}</h4>
            {g.units.map((u) => {
              const rare = !latin && u.native && !u.native.includes(lang);
              return (
                <button key={g.id + u.key + u.kind} type="button" className="letter" onClick={() => onInsert(u.code)} title={'Insert ' + u.code}>
                  <span className={'lt-glyph cm-lang-' + shownLang}>{renderUnit(u, shownLang)}</span>
                  <span className="lt-text">
                    <span className="lt-head">
                      <kbd>{u.code}</kbd>
                      {u.alt && <span className="lt-alt">or {u.alt.join(', ')}</span>}
                      <span className="lt-name">{u.name}</span>
                      {rare && <span className="lt-rare">rare in {LANGS[lang]}</span>}
                    </span>
                    <span className="lt-desc">{u.desc}</span>
                  </span>
                </button>
              );
            })}
          </section>
        ))}
        {!groups.length && <p className="hint">No sound matches “{query}”.</p>}
      </div>
      <p className="hint">Tap a letter to type its code at the cursor. Open this kit any time with Ctrl+K (⌘K on a Mac) or the Letters button.</p>
    </Modal>
  );
}
