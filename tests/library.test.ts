import { beforeEach, expect, test } from 'vitest';

// a tiny localStorage for the node test environment
const mem = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
  setItem: (k: string, v: string) => void mem.set(k, String(v)),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
  key: () => null,
  length: 0,
} as Storage;

const lib = await import('../src/lib/library');

beforeEach(() => mem.clear());

test('songs are stored, listed newest first, updated and deleted', () => {
  const a = lib.createSong('Title: "A"\nS: s r g m ||');
  const b = lib.createSong('Heading: "brOva bhAramA - bahudAri - Adi - tyAgarAja",bold');
  lib.putSong({ ...a, text: a.text + '\n', updated: b.updated + 1000 });
  expect(lib.listSongs().map((s) => s.id)).toEqual([a.id, b.id]);
  expect(lib.songMeta(b.text)).toEqual({ title: 'brOva bhAramA', raga: 'bahudAri', tala: 'Adi', composer: 'tyAgarAja' });
  expect(lib.listSongs().filter((s) => lib.matches(s, 'bahud')).map((s) => s.id)).toEqual([b.id]);
  lib.deleteSong(a.id);
  expect(lib.listSongs()).toHaveLength(1);
});

test('backup and restore merge by id, newer copy wins', () => {
  const a = lib.createSong('Title: "A"');
  const json = lib.backupJson();
  lib.putSong({ ...a, text: 'Title: "A2"', updated: a.updated + 5000 });
  expect(lib.restoreBackup(json)).toBe(0); // the backup's copy is older
  mem.clear();
  expect(lib.restoreBackup(json)).toBe(1);
  expect(lib.getSong(a.id)!.text).toBe('Title: "A"');
  expect(() => lib.restoreBackup('not json')).toThrow();
});
