/*
 * Photo-reader settings. The API key is kept on this device only: encrypted
 * by the operating system in the desktop app, in browser storage on the web.
 * SPDX-License-Identifier: GPL-2.0-only
 */
import { desk } from '../lib/desktop';
import { KEYS, store } from '../lib/storage';
import { DEFAULT_MODEL, MODELS } from './claude';

export async function loadApiKey(): Promise<string> {
  if (desk) {
    try {
      return (await desk.getApiKey()) || '';
    } catch {
      return '';
    }
  }
  return store.get(KEYS.apiKey) || '';
}

export async function saveApiKey(key: string): Promise<void> {
  const k = key.trim();
  if (desk) {
    await desk.setApiKey(k);
    return;
  }
  if (k) store.set(KEYS.apiKey, k);
  else store.remove(KEYS.apiKey);
}

export function loadModel(): string {
  try {
    const m = JSON.parse(store.get(KEYS.recognition) || '{}').model;
    return MODELS.some((x) => x.id === m) ? m : DEFAULT_MODEL;
  } catch {
    return DEFAULT_MODEL;
  }
}

export function saveModel(model: string): void {
  store.set(KEYS.recognition, JSON.stringify({ model }));
}
