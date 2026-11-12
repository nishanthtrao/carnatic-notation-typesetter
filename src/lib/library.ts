/*
 * Song library: many songs kept in this browser (or desktop app), each saved
 * automatically as it is edited.
 * SPDX-License-Identifier: GPL-2.0-only
 */
import { store } from './storage';

export interface Song {
  id: string;
  text: string;
  created: number;
  updated: number;
}

export interface SongMeta {
  title: string;
  raga: string;
  tala: string;
  composer: string;
}

const KEY = 'cmnt.v3.library';
const CURRENT = 'cmnt.v3.current';

export function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }
}

function read(): Song[] {
  try {
    const v = JSON.parse(store.get(KEY) || '[]');
    return Array.isArray(v) ? v.filter((s) => s && typeof s.id === 'string' && typeof s.text === 'string') : [];
  } catch {
    return [];
  }
}

function write(songs: Song[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(songs));
    return true;
  } catch {
    return false; // storage full or unavailable
  }
}

/** All songs, most recently edited first. */
export function listSongs(): Song[] {
  return read().sort((a, b) => b.updated - a.updated);
}

export function getSong(id: string | null | undefined): Song | null {
  if (!id) return null;
  return read().find((s) => s.id === id) || null;
}

/** Insert or update a song; returns false if it could not be stored. */
export function putSong(song: Song): boolean {
  const songs = read();
  const i = songs.findIndex((s) => s.id === song.id);
  if (i >= 0) songs[i] = song;
  else songs.push(song);
  return write(songs);
}

export function createSong(text: string): Song {
  const now = Date.now();
  const song = { id: newId(), text, created: now, updated: now };
  putSong(song);
  return song;
}

export function deleteSong(id: string): Song | null {
  const songs = read();
  const gone = songs.find((s) => s.id === id) || null;
  write(songs.filter((s) => s.id !== id));
  return gone;
}

export function currentSongId(): string | null {
  return store.get(CURRENT) || null;
}

export function setCurrentSongId(id: string | null) {
  if (id) store.set(CURRENT, id);
  else
    try {
      localStorage.removeItem(CURRENT);
    } catch {
      /* ignore */
    }
}

/**
 * Title, raga, tala and composer for the list. Uses Title: and Tala:, and the
 * common heading style "song - raga - tala - composer".
 */
export function songMeta(text: string): SongMeta {
  const title = text.match(/^\s*Title\s*:\s*"?([^"\n]*)"?/im)?.[1].trim() || '';
  const talaLine = text.match(/^\s*Tala\s*:\s*([^,\n]+)/im)?.[1].trim() || '';
  const heading = text.match(/^\s*Heading\s*:\s*"([^"\n]+)"/im)?.[1] || '';
  const parts = heading.split(/\s+[-–—]\s+/).map((p) => p.trim()).filter(Boolean);
  let raga = '';
  let composer = '';
  if (parts.length >= 3) {
    raga = parts[1];
    composer = parts.length >= 4 ? parts[parts.length - 1] : '';
  }
  return { title: title || parts[0] || firstWords(text), raga, tala: talaLine || (parts.length >= 3 ? parts[2] : ''), composer };
}

function firstWords(text: string): string {
  const line = text.split('\n').find((l) => l.trim() && !/^\s*(#|%|\/\/)/.test(l)) || '';
  return line.replace(/^\s*\w+\s*:\s*/, '').replace(/"/g, '').slice(0, 40) || 'Untitled';
}

/** Case-insensitive match against title, raga, tala, composer and the text. */
export function matches(song: Song, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  const m = songMeta(song.text);
  return [m.title, m.raga, m.tala, m.composer].some((x) => x.toLowerCase().includes(s)) || song.text.toLowerCase().includes(s);
}

// ---- backup ---------------------------------------------------------------------

export function backupJson(): string {
  return JSON.stringify({ app: 'carnatic-notation-typesetter', version: 1, exported: new Date().toISOString(), songs: listSongs() }, null, 1);
}

/** Merge songs from a backup; newer copies win. Returns how many were added or updated. */
export function restoreBackup(json: string): number {
  const data = JSON.parse(json);
  const incoming: Song[] = (Array.isArray(data) ? data : data?.songs) || [];
  const songs = read();
  let n = 0;
  for (const s of incoming) {
    if (!s || typeof s.text !== 'string') continue;
    const song: Song = {
      id: typeof s.id === 'string' ? s.id : newId(),
      text: s.text,
      created: Number(s.created) || Date.now(),
      updated: Number(s.updated) || Date.now(),
    };
    const i = songs.findIndex((x) => x.id === song.id);
    if (i < 0) {
      songs.push(song);
      n++;
    } else if (song.updated > songs[i].updated) {
      songs[i] = song;
      n++;
    }
  }
  if (!write(songs)) throw new Error('Not enough storage space in this browser');
  return n;
}

/** "2 min ago", "yesterday", "12 Nov" */
export function ago(t: number, now = Date.now()): string {
  const s = Math.max(0, (now - t) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + ' min ago';
  if (s < 86400) return Math.floor(s / 3600) + ' h ago';
  if (s < 172800) return 'yesterday';
  return new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: s > 300 * 86400 ? 'numeric' : undefined });
}
