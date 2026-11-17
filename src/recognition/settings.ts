/*
 * Photo-reader settings: which service to use, a model for each, and an API
 * key for each. Keys are kept on this device only: encrypted by the operating
 * system in the desktop app, in browser storage on the web.
 * SPDX-License-Identifier: GPL-2.0-only
 */
import { desk } from '../lib/desktop';
import { KEYS, store } from '../lib/storage';
import { PROVIDER_ORDER, PROVIDERS, type ApiProviderId, type ModelInfo, type ProviderId } from './providers';

export type ApiKeys = Partial<Record<ApiProviderId, string>>;

export interface RecognitionSettings {
  provider: ProviderId;
  models: Partial<Record<ApiProviderId, string>>;
  /** models found with "Find models", so they stay in the list */
  found?: Partial<Record<ApiProviderId, ModelInfo[]>>;
}

/**
 * Keys are stored together as JSON. Older versions stored one Anthropic key
 * as plain text, which is read as such.
 */
export function decodeKeys(raw: string | null | undefined): ApiKeys {
  const s = (raw || '').trim();
  if (!s) return {};
  if (s.startsWith('{')) {
    try {
      const o = JSON.parse(s);
      const out: ApiKeys = {};
      for (const id of PROVIDER_ORDER) if (id !== 'chat' && typeof o[id] === 'string' && o[id]) out[id] = o[id];
      return out;
    } catch {
      return {};
    }
  }
  return { anthropic: s };
}

export function encodeKeys(keys: ApiKeys): string {
  const clean = Object.fromEntries(Object.entries(keys).filter(([, v]) => v && v.trim()).map(([k, v]) => [k, v!.trim()]));
  return Object.keys(clean).length ? JSON.stringify(clean) : '';
}

export async function loadApiKeys(): Promise<ApiKeys> {
  if (desk) {
    try {
      return decodeKeys(await desk.getApiKey());
    } catch {
      return {};
    }
  }
  return decodeKeys(store.get(KEYS.apiKey));
}

export async function saveApiKeys(keys: ApiKeys): Promise<void> {
  const v = encodeKeys(keys);
  if (desk) {
    await desk.setApiKey(v);
    return;
  }
  if (v) store.set(KEYS.apiKey, v);
  else store.remove(KEYS.apiKey);
}

/** The settings, with sensible choices filled in. A saved Anthropic key keeps older setups on Claude. */
export function loadSettings(keys: ApiKeys = {}): RecognitionSettings {
  let o: { provider?: string; model?: string; models?: Record<string, string>; found?: RecognitionSettings['found'] } = {};
  try {
    o = JSON.parse(store.get(KEYS.recognition) || '{}') || {};
  } catch {
    /* use the defaults */
  }
  const models: RecognitionSettings['models'] = {};
  for (const id of PROVIDER_ORDER) {
    if (id === 'chat') continue;
    const m = o.models?.[id] ?? (id === 'anthropic' ? o.model : undefined);
    models[id] = typeof m === 'string' && m.trim() ? m.trim() : PROVIDERS[id].models[0].id;
  }
  const saved = PROVIDER_ORDER.includes(o.provider as ProviderId) ? (o.provider as ProviderId) : undefined;
  // before there was a choice, a saved key meant Claude; with nothing set up, start with the chat app
  const provider = saved ?? (keys.anthropic ? 'anthropic' : 'chat');
  const found = o.found && typeof o.found === 'object' ? o.found : {};
  return { provider, models, found };
}

export function saveSettings(s: RecognitionSettings): void {
  store.set(KEYS.recognition, JSON.stringify(s));
}

/** The model's description and price, when it is one we know. */
export function modelInfo(provider: ApiProviderId, model: string, s?: RecognitionSettings): ModelInfo | undefined {
  return PROVIDERS[provider].models.find((m) => m.id === model) || s?.found?.[provider]?.find((m) => m.id === model);
}
