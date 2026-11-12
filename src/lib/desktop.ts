/*
 * The desktop app (Electron) exposes window.cmntDesktop from
 * desktop/preload.cjs. On the website it is undefined.
 */
export interface DesktopFile {
  path: string;
  name: string;
  text: string;
}

export interface DesktopStartup {
  file: DesktopFile | null;
  lastFile: DesktopFile | null;
  recovered: { text: string; path: string | null; name: string | null } | null;
  additional: boolean;
  platform: string;
}

export interface DesktopBridge {
  platform: string;
  startup(): Promise<DesktopStartup>;
  openFile(): Promise<DesktopFile | null>;
  openDropped(file: File): Promise<DesktopFile | { error: string }>;
  saveFile(opts: { text: string; path: string | null; saveAs: boolean; suggestedName: string }): Promise<{ path: string; name: string } | null>;
  exportPdf(opts: { suggestedName: string }): Promise<{ path: string; name: string } | null>;
  print(): Promise<boolean>;
  setState(s: { dirty: boolean; path: string | null; name: string }): void;
  saveDraft(text: string): void;
  closeWindow(): void;
  setExamples(list: { id: string; title: string }[]): void;
  getApiKey(): Promise<string>;
  setApiKey(key: string): Promise<boolean>;
  onMenu(cb: (cmd: string) => void): void;
  onOpenFile(cb: (f: DesktopFile) => void): void;
}

declare global {
  interface Window {
    cmntDesktop?: DesktopBridge;
  }
}

export const desk: DesktopBridge | null = typeof window !== 'undefined' ? window.cmntDesktop ?? null : null;

/** Running inside a sandboxed frame (downloads/printing may be blocked). */
export const inFrame = (() => {
  try {
    return typeof window !== 'undefined' && window.self !== window.top;
  } catch {
    return true;
  }
})();
