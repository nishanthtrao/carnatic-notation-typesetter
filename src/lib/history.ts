/*
 * Version history: snapshots of the notation kept in this browser, so earlier
 * versions can be looked at and restored. Nothing leaves the device.
 * SPDX-License-Identifier: GPL-2.0-only
 */
import { store } from './storage';

export interface Snapshot {
  /** when it was taken (ms since 1970) */
  t: number;
  text: string;
  title: string;
  /** why a snapshot was taken on purpose ("Saved", "Before opening …"); none for automatic ones */
  reason?: string;
  /** automatic versions: when the stretch of work it stands for began */
  since?: number;
}

const KEY = 'cmnt.v3.history';
/** at most this many versions… */
export const MAX_VERSIONS = 60;
/** …and about this much text (localStorage holds about 5 MB in all) */
const MAX_CHARS = 1_500_000;
/** while typing, one automatic version per this many minutes */
export const EVERY_MINUTES = 2;

const titleOf = (t: string) => t.match(/^\s*Title\s*:\s*"?([^"\n]*)"?/im)?.[1].trim() || 'Untitled';

export function loadHistory(): Snapshot[] {
  try {
    const list = JSON.parse(store.get(KEY) || '[]');
    return Array.isArray(list) ? list.filter((s) => s && typeof s.text === 'string' && typeof s.t === 'number') : [];
  } catch {
    return [];
  }
}

function saveHistory(list: Snapshot[]): void {
  // newest first; drop the oldest past the limits
  let kept = list.slice(0, MAX_VERSIONS);
  while (kept.length > 1 && kept.reduce((n, s) => n + s.text.length, 0) > MAX_CHARS) kept = kept.slice(0, -1);
  store.set(KEY, JSON.stringify(kept));
}

/**
 * Keep a version of `text`. Automatic versions (no reason) taken within a few
 * minutes of the last automatic one replace it, so each stands for a stretch
 * of work; a version with a reason is always kept. Text that is the same as
 * the newest version, empty, or `skip` (the blank template) is not kept.
 */
export function addSnapshot(text: string, opts: { reason?: string; skip?: string; now?: number } = {}): boolean {
  if (!text.trim() || text === opts.skip) return false;
  const now = opts.now ?? Date.now();
  const list = loadHistory();
  const newest = list[0];
  if (newest && newest.text === text) {
    // the same text: just mark it, if this is a deliberate version
    if (opts.reason && !newest.reason) {
      newest.reason = opts.reason;
      newest.t = now;
      saveHistory(list);
    }
    return false;
  }
  // an automatic version of text kept moments ago (just restored, say) adds nothing
  if (!opts.reason && list.slice(0, 3).some((x) => x.text === text)) return false;
  const snap: Snapshot = { t: now, text, title: titleOf(text), ...(opts.reason ? { reason: opts.reason } : { since: now }) };
  const start = newest?.since ?? newest?.t ?? 0;
  if (!opts.reason && newest && !newest.reason && now - start < EVERY_MINUTES * 60_000) list[0] = { ...snap, since: start };
  else list.unshift(snap);
  saveHistory(list);
  return true;
}

export function clearHistory(): void {
  store.remove(KEY);
}
