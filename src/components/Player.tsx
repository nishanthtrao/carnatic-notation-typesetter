/*
 * Player bar: play the notation with a tanpura and tala clicks, highlighting
 * each swara as it sounds.
 * SPDX-License-Identifier: GPL-2.0-only
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { NotationDoc } from '../engine';
import { NotationPlayer } from '../audio/engine';
import { DEFAULT_RAGA, findRaga, RAGAS, scaleFromText, type Scale } from '../audio/ragas';
import { buildTimeline, SHRUTIS } from '../audio/schedule';
import { songMeta } from '../lib/library';
import { store } from '../lib/storage';
import { Icon } from './Icons';

const KEY = 'cmnt.v3.play';
interface Settings {
  shruti: number;
  tempo: number;
  tanpura: boolean;
  clicks: boolean;
}
const DEFAULTS: Settings = { shruti: 1, tempo: 60, tanpura: true, clicks: true };

function loadSettings(): Settings {
  try {
    return { ...DEFAULTS, ...JSON.parse(store.get(KEY) || '{}') };
  } catch {
    return DEFAULTS;
  }
}

const SOURCE_LABEL: Record<string, string> = {
  arohana: 'from the Arohana line',
  'raga-line': 'from the Raga line',
  heading: 'from the heading',
  default: 'no raga found: choose one',
};

export function Player({ doc, text, sheet, onClose }: { doc: NotationDoc; text: string; sheet: () => HTMLElement | null; onClose: () => void }) {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [ragaPick, setRagaPick] = useState(''); // '' = automatic
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const player = useRef<NotationPlayer | null>(null);
  const lit = useRef<Element | null>(null);
  const raf = useRef(0);

  const detected = useMemo(() => scaleFromText(text, songMeta(text).raga), [text]);
  const raga = (ragaPick && findRaga(ragaPick)) || detected.raga || findRaga(DEFAULT_RAGA)!;
  const { up, down } = useMemo(() => {
    const lines = ragaPick ? {} : detected.fromLines || {};
    const upS: Scale = { ...raga.up, ...lines };
    const downS: Scale | undefined = raga.down ? { ...raga.down, ...lines } : undefined;
    return { up: upS, down: downS };
  }, [raga, ragaPick, detected]);
  const timeline = useMemo(() => buildTimeline(doc, up, down), [doc, up, down]);

  const set = (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    store.set(KEY, JSON.stringify(next));
  };

  const unlight = () => {
    lit.current?.classList.remove('cm-playing');
    lit.current = null;
  };

  const stop = () => {
    player.current?.stop();
    cancelAnimationFrame(raf.current);
    unlight();
    setPlaying(false);
    setProgress(0);
  };

  const follow = () => {
    const p = player.current;
    if (!p || !p.playing) return;
    const pos = p.position();
    setProgress(timeline.length ? Math.min(1, pos / timeline.length) : 0);
    // the note sounding now (notes are in time order)
    let lo = 0;
    let hi = timeline.notes.length - 1;
    let cur = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (timeline.notes[mid].start <= pos + 1e-6) {
        cur = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    const note = cur >= 0 && pos < timeline.notes[cur].start + timeline.notes[cur].dur ? timeline.notes[cur] : null;
    const root = sheet();
    const el = note && root ? root.querySelector('[data-ev="' + note.key + '"]') : null;
    if (el !== lit.current) {
      unlight();
      if (el) {
        el.classList.add('cm-playing');
        lit.current = el;
        const rowEl = el.closest('.cm-row');
        if (rowEl) rowEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
    raf.current = requestAnimationFrame(follow);
  };

  const play = async () => {
    if (!timeline.notes.length) return;
    if (!player.current) player.current = new NotationPlayer();
    await player.current.play(timeline, { saHz: SHRUTIS[settings.shruti].hz, tempo: settings.tempo, tanpura: settings.tanpura, clicks: settings.clicks }, () => {
      cancelAnimationFrame(raf.current);
      unlight();
      setPlaying(false);
      setProgress(0);
    });
    setPlaying(true);
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(follow);
  };

  // restart with new settings if they change while playing
  const restartKey = settings.shruti + ':' + settings.tempo + ':' + settings.tanpura + ':' + settings.clicks + ':' + raga.name;
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (player.current?.playing) play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restartKey]);

  useEffect(
    () => () => {
      cancelAnimationFrame(raf.current);
      player.current?.close();
      lit.current?.classList.remove('cm-playing');
    },
    [],
  );

  const noNotes = !timeline.notes.length;
  return (
    <div className="player" role="region" aria-label="Playback">
      <div className="pl-main">
        <button type="button" className="pl-play" onClick={() => (playing ? stop() : play())} disabled={noNotes} aria-label={playing ? 'Stop' : 'Play'} title={playing ? 'Stop' : 'Play'}>
          <Icon name={playing ? 'stop' : 'play'} />
        </button>
        <div className="pl-info">
          <div className="pl-raga">
            <select value={ragaPick} onChange={(e) => setRagaPick(e.target.value)} aria-label="Raga">
              <option value="">{detected.raga ? detected.raga.name : DEFAULT_RAGA} (automatic)</option>
              {RAGAS.map((r) => (
                <option key={r.name} value={r.name}>
                  {r.name}
                  {r.mela ? ' (' + r.mela + ')' : ''}
                </option>
              ))}
            </select>
            <span className="pl-src">{ragaPick ? 'chosen' : SOURCE_LABEL[detected.source]}</span>
          </div>
          <div className="pl-progress" aria-hidden="true">
            <span style={{ width: progress * 100 + '%' }} />
          </div>
        </div>
        <button type="button" className="pl-close" onClick={onClose} aria-label="Close player" title="Close">
          ×
        </button>
      </div>
      <div className="pl-controls">
        <label>
          Shruti
          <select value={settings.shruti} onChange={(e) => set({ shruti: Number(e.target.value) })}>
            {SHRUTIS.map((s, i) => (
              <option key={s.label} value={i}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="pl-tempo">
          Speed
          <input type="range" min={30} max={160} step={2} value={settings.tempo} onChange={(e) => set({ tempo: Number(e.target.value) })} aria-label="Beats per minute" />
          <span>{settings.tempo}</span>
        </label>
        <label className="pl-check">
          <input type="checkbox" checked={settings.tanpura} onChange={(e) => set({ tanpura: e.target.checked })} />
          Tanpura
        </label>
        <label className="pl-check">
          <input type="checkbox" checked={settings.clicks} onChange={(e) => set({ clicks: e.target.checked })} />
          Tala
        </label>
      </div>
      {noNotes && <p className="pl-note">Nothing to play yet: add some swaras.</p>}
    </div>
  );
}
