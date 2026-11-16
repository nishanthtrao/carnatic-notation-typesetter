import { beforeEach, describe, expect, it } from 'vitest';
import { addSnapshot, clearHistory, EVERY_MINUTES, loadHistory } from '../src/lib/history';

const mem = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
  setItem: (k: string, v: string) => void mem.set(k, String(v)),
  removeItem: (k: string) => void mem.delete(k),
};
const MIN = 60_000;
const song = (n: number) => `Title: "Song ${n}"\nS: s r g m |`;

describe('version history', () => {
  beforeEach(() => clearHistory());

  it('keeps one automatic version per stretch of work, even while typing continuously', () => {
    let t = 0;
    for (let i = 0; i < 20; i++) addSnapshot(song(i), { now: (t += 0.25 * MIN) }); // 5 minutes of typing
    const list = loadHistory();
    expect(list.length).toBe(Math.ceil(5 / EVERY_MINUTES));
    expect(list[0].text).toBe(song(19));
    expect(list[0].title).toBe('Song 19');
  });

  it('always keeps deliberate versions and does not repeat the same text', () => {
    addSnapshot(song(1), { now: 1 });
    addSnapshot(song(1), { reason: 'Saved', now: 2 });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].reason).toBe('Saved');
    addSnapshot(song(2), { reason: 'Before replacing', now: 3 });
    addSnapshot(song(3), { now: 4 });
    addSnapshot(song(2), { now: 5 }); // restored: already kept
    expect(loadHistory().map((s) => s.text)).toEqual([song(3), song(2), song(1)]);
  });

  it('skips empty text and the new-song template', () => {
    expect(addSnapshot('  \n')).toBe(false);
    expect(addSnapshot(song(0), { skip: song(0) })).toBe(false);
    expect(loadHistory()).toHaveLength(0);
  });

  it('survives damaged storage', () => {
    localStorage.setItem('cmnt.v3.history', '{not json');
    expect(loadHistory()).toEqual([]);
    expect(addSnapshot(song(1))).toBe(true);
  });
});
