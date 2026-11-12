/** localStorage that never throws (private mode, sandboxed frames). */
export const store = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* ignore */
    }
  },
  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

export const KEYS = {
  draft: 'cmnt.v2.draft',
  draftMeta: 'cmnt.v2.draftmeta',
  /** unsaved work from an earlier visit, offered for restoring */
  recover: 'cmnt.v3.recover',
  split: 'cmnt.v2.split',
  splitX: 'cmnt.v3.splitx',
  layout: 'cmnt.v3.layout',
  auto: 'cmnt.v2.auto',
  recognition: 'cmnt.v3.recognition',
  apiKey: 'cmnt.v3.apikey',
};
