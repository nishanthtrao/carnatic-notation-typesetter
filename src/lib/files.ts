/*
 * Saving and opening notation files on the person's own device (web).
 * Chrome and Edge offer real file pickers (File System Access API): Save
 * asks where once and then saves over the same file. Other browsers use a
 * download for Save and a file input for Open.
 * SPDX-License-Identifier: GPL-2.0-only
 */
import { inFrame } from './desktop';

interface PickerType {
  description: string;
  accept: Record<string, string[]>;
}
interface Writable {
  write(data: string): Promise<void>;
  close(): Promise<void>;
}
export interface FileHandle {
  name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<Writable>;
}
interface PickerWindow {
  showOpenFilePicker?: (o: { types: PickerType[]; multiple?: boolean; excludeAcceptAllOption?: boolean }) => Promise<FileHandle[]>;
  showSaveFilePicker?: (o: { types: PickerType[]; suggestedName?: string }) => Promise<FileHandle>;
}

const TYPES: PickerType[] = [{ description: 'Notation (text)', accept: { 'text/plain': ['.txt', '.cmnt'] } }];

/** Real file pickers available (not inside a sandboxed preview frame)? */
export function canPickFiles(): boolean {
  const w = window as unknown as PickerWindow;
  return !inFrame && typeof w.showSaveFilePicker === 'function' && typeof w.showOpenFilePicker === 'function';
}

const cancelled = (e: unknown) => e instanceof DOMException && e.name === 'AbortError';

/** Ask for a file to open. null if the person cancels. */
export async function pickFileToOpen(): Promise<{ handle: FileHandle; name: string; text: string } | null> {
  try {
    const [handle] = await (window as unknown as PickerWindow).showOpenFilePicker!({ types: TYPES, multiple: false });
    const file = await handle.getFile();
    return { handle, name: file.name, text: await file.text() };
  } catch (e) {
    if (cancelled(e)) return null;
    throw e;
  }
}

/** Ask where to save. null if the person cancels. */
export async function pickFileToSave(suggestedName: string): Promise<FileHandle | null> {
  try {
    return await (window as unknown as PickerWindow).showSaveFilePicker!({ types: TYPES, suggestedName });
  } catch (e) {
    if (cancelled(e)) return null;
    throw e;
  }
}

/**
 * Write the text, then read the file back to make sure it really is on disk
 * with the same size. Returns the size in bytes.
 */
export async function writeFile(handle: FileHandle, text: string): Promise<number> {
  const w = await handle.createWritable(); // asks for permission the first time if needed
  await w.write(text);
  await w.close();
  const expected = new Blob([text]).size;
  let onDisk: File;
  try {
    onDisk = await handle.getFile();
  } catch {
    throw new Error('the browser said it saved, but the file could not be found afterwards');
  }
  if (onDisk.size !== expected) throw new Error('the file on disk has ' + onDisk.size + ' bytes, expected ' + expected);
  return expected;
}

/** Browsers without pickers: save by downloading. Returns the file name used. */
export function downloadText(name: string, text: string): string {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 1000);
  return name;
}
