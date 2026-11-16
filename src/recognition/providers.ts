/*
 * The AI services the photo reader can use, each with the user's own API key,
 * called directly from the browser / desktop app. Nothing goes through a
 * server of ours. "Chat app" needs no key: the user copies the instructions
 * into the AI app they already use and pastes the reply back.
 * SPDX-License-Identifier: GPL-2.0-only
 */
import type { PreparedImage } from './image';

export type ProviderId = 'anthropic' | 'openai' | 'gemini' | 'openrouter' | 'chat';
export type ApiProviderId = Exclude<ProviderId, 'chat'>;

export interface ModelInfo {
  id: string;
  label: string;
  /** US dollars per million tokens, input and output, for the cost estimate */
  price?: [number, number];
}

export interface ProviderInfo {
  id: ProviderId;
  /** short name, e.g. in "Read with Gemini" */
  name: string;
  /** who runs it, e.g. in "The photo is sent to Google" */
  company: string;
  /** one line for the provider list */
  blurb: string;
  keyPlaceholder?: string;
  keyUrl?: string;
  keyHelp?: string;
  models: ModelInfo[];
}

export const PROVIDERS: Record<ProviderId, ProviderInfo> = {
  chat: {
    id: 'chat',
    name: 'your AI chat app',
    company: 'the AI app you use',
    blurb: 'No API key: use Claude, ChatGPT or Gemini as you normally do, and paste the reply back',
    models: [],
  },
  gemini: {
    id: 'gemini',
    name: 'Gemini',
    company: 'Google',
    blurb: 'Google — free API key, no card needed (free use is limited per day)',
    keyPlaceholder: 'AIza…',
    keyUrl: 'https://aistudio.google.com/app/apikey',
    keyHelp: 'Sign in to Google AI Studio and press “Create API key”. The free tier needs no card. On the free tier Google may use what you send to improve its products, so don’t send anything private.',
    models: [
      { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash — good, has a free tier (recommended)', price: [1.5, 9] },
      { id: 'gemini-flash-latest', label: 'Gemini Flash, latest — whichever Flash is newest' },
      { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash-Lite — cheapest, for neat printed pages', price: [0.25, 1.5] },
      { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro — most accurate, paid only', price: [2, 12] },
    ],
  },
  anthropic: {
    id: 'anthropic',
    name: 'Claude',
    company: 'Anthropic',
    blurb: 'Anthropic — API key with prepaid credit',
    keyPlaceholder: 'sk-ant-…',
    keyUrl: 'https://platform.claude.com/',
    keyHelp: 'Create a key at platform.claude.com (API keys) and add a little credit. A Claude.ai subscription is separate and does not include API use — choose “My AI chat app” to use your subscription instead.',
    models: [
      { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 — fast, good value (recommended)', price: [2, 10] },
      { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 — most accurate, about 2× the cost', price: [4, 20] },
      { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 — cheapest, for neat printed pages', price: [0.1, 0.5] },
    ],
  },
  openai: {
    id: 'openai',
    name: 'ChatGPT (OpenAI)',
    company: 'OpenAI',
    blurb: 'OpenAI — API key with prepaid credit',
    keyPlaceholder: 'sk-…',
    keyUrl: 'https://platform.openai.com/api-keys',
    keyHelp: 'Create a key at platform.openai.com (API keys) and add a little credit. A ChatGPT Plus subscription is separate and does not include API use — choose “My AI chat app” to use your subscription instead.',
    models: [
      { id: 'gpt-6.1-sol', label: 'GPT-6.1 Sol — balanced (recommended)', price: [2, 10] },
      { id: 'gpt-6.1-terra', label: 'GPT-6.1 Terra — faster, half the cost', price: [1, 5] },
      { id: 'gpt-6-luna', label: 'GPT-6 Luna — cheapest, for neat printed pages', price: [0.1, 0.5] },
      { id: 'gpt-6-astra', label: 'GPT-6 Astra — most capable, about 5× the cost', price: [10, 50] },
    ],
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    company: 'OpenRouter and the model’s maker',
    blurb: 'One key for many models (Claude, GPT, Gemini, Qwen, Llama…), some free',
    keyPlaceholder: 'sk-or-…',
    keyUrl: 'https://openrouter.ai/settings/keys',
    keyHelp: 'Create a key at openrouter.ai. Press “Find models” to choose any model that reads images; those marked free cost nothing but are slower and limited.',
    models: [{ id: 'openrouter/auto', label: 'Auto — OpenRouter picks a suitable model' }],
  },
};

/** The order they are offered in. */
export const PROVIDER_ORDER: ProviderId[] = ['chat', 'gemini', 'anthropic', 'openai', 'openrouter'];

export class RecognitionError extends Error {}

/** One part of a message: text or a picture. */
export type Part = { text: string } | { image: PreparedImage };
export interface Message {
  role: 'user' | 'assistant';
  parts: Part[];
}
export interface Reply {
  text: string;
  usage: { input: number; output: number };
}

const ANTHROPIC_URL = 'https://api.anthropic.com/v1';
const OPENAI_URL = 'https://api.openai.com/v1';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1';
/** every host the photo reader may contact (the site's Content-Security-Policy allows exactly these) */
export const API_HOSTS = [ANTHROPIC_URL, OPENAI_URL, GEMINI_URL, OPENROUTER_URL].map((u) => new URL(u).origin);

const isText = (p: Part): p is { text: string } => 'text' in p;
const dataUrl = (img: PreparedImage) => 'data:' + img.mediaType + ';base64,' + img.base64;
const appName = 'Carnatic Notation Typesetter';

function headersFor(provider: ApiProviderId, key: string): Record<string, string> {
  switch (provider) {
    case 'anthropic':
      // the key is the user's own, entered on their own device
      return { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' };
    case 'gemini':
      return { 'x-goog-api-key': key };
    case 'openrouter':
      return { authorization: 'Bearer ' + key, 'X-Title': appName, ...(typeof location !== 'undefined' && /^https?:/.test(location.protocol) ? { 'HTTP-Referer': location.origin } : {}) };
    default:
      return { authorization: 'Bearer ' + key };
  }
}

/** The request for one turn of the conversation, in each service's own format. */
export function buildRequest(provider: ApiProviderId, model: string, system: string, messages: Message[], maxTokens: number): { url: string; body: unknown } {
  switch (provider) {
    case 'anthropic':
      return {
        url: ANTHROPIC_URL + '/messages',
        body: {
          model,
          max_tokens: maxTokens,
          system,
          messages: messages.map((m) => ({
            role: m.role,
            content: m.parts.map((p) => (isText(p) ? { type: 'text', text: p.text } : { type: 'image', source: { type: 'base64', media_type: p.image.mediaType, data: p.image.base64 } })),
          })),
        },
      };
    case 'openai':
      // the Responses API, which every current OpenAI model supports
      return {
        url: OPENAI_URL + '/responses',
        body: {
          model,
          instructions: system,
          max_output_tokens: maxTokens,
          store: false,
          input: messages.map((m) =>
            m.role === 'assistant'
              ? { role: 'assistant', content: m.parts.filter(isText).map((p) => p.text).join('\n') }
              : { role: 'user', content: m.parts.map((p) => (isText(p) ? { type: 'input_text', text: p.text } : { type: 'input_image', image_url: dataUrl(p.image), detail: 'high' })) },
          ),
        },
      };
    case 'gemini':
      return {
        url: GEMINI_URL + '/models/' + encodeURIComponent(model.replace(/^models\//, '')) + ':generateContent',
        body: {
          systemInstruction: { parts: [{ text: system }] },
          contents: messages.map((m) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: m.parts.map((p) => (isText(p) ? { text: p.text } : { inline_data: { mime_type: p.image.mediaType, data: p.image.base64 } })),
          })),
          generationConfig: { maxOutputTokens: maxTokens * 2 }, // thinking counts towards this
        },
      };
    case 'openrouter':
      return {
        url: OPENROUTER_URL + '/chat/completions',
        body: {
          model,
          max_tokens: maxTokens,
          messages: [
            { role: 'system', content: system },
            ...messages.map((m) =>
              m.role === 'assistant'
                ? { role: 'assistant', content: m.parts.filter(isText).map((p) => p.text).join('\n') }
                : { role: 'user', content: m.parts.map((p) => (isText(p) ? { type: 'text', text: p.text } : { type: 'image_url', image_url: { url: dataUrl(p.image) } })) },
            ),
          ],
        },
      };
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/** The reply's text and token counts, from each service's own format. */
export function readReply(provider: ApiProviderId, body: any): Reply & { stop?: string } {
  switch (provider) {
    case 'anthropic':
      return {
        text: (body.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text || '').join(''),
        usage: { input: body.usage?.input_tokens || 0, output: body.usage?.output_tokens || 0 },
        stop: body.stop_reason === 'refusal' ? 'refusal' : body.stop_reason === 'max_tokens' ? 'length' : undefined,
      };
    case 'openai': {
      const text = (body.output || [])
        .filter((o: any) => o.type === 'message')
        .flatMap((o: any) => o.content || [])
        .map((c: any) => (c.type === 'output_text' ? c.text || '' : ''))
        .join('');
      const refused = (body.output || []).some((o: any) => (o.content || []).some((c: any) => c.type === 'refusal'));
      return {
        text,
        usage: { input: body.usage?.input_tokens || 0, output: body.usage?.output_tokens || 0 },
        stop: refused ? 'refusal' : body.status === 'incomplete' ? (body.incomplete_details?.reason === 'content_filter' ? 'refusal' : 'length') : undefined,
      };
    }
    case 'gemini': {
      const cand = body.candidates?.[0];
      const text = (cand?.content?.parts || [])
        .filter((p: any) => !p.thought)
        .map((p: any) => p.text || '')
        .join('');
      const reason = body.promptFeedback?.blockReason || cand?.finishReason;
      return {
        text,
        usage: { input: body.usageMetadata?.promptTokenCount || 0, output: (body.usageMetadata?.candidatesTokenCount || 0) + (body.usageMetadata?.thoughtsTokenCount || 0) },
        stop: /SAFETY|BLOCK|PROHIBITED|RECITATION/.test(reason || '') ? 'refusal' : reason === 'MAX_TOKENS' ? 'length' : undefined,
      };
    }
    case 'openrouter': {
      const choice = body.choices?.[0];
      const c = choice?.message?.content;
      const text = typeof c === 'string' ? c : Array.isArray(c) ? c.map((x: any) => x.text || '').join('') : '';
      return {
        text,
        usage: { input: body.usage?.prompt_tokens || 0, output: body.usage?.completion_tokens || 0 },
        stop: choice?.finish_reason === 'content_filter' ? 'refusal' : choice?.finish_reason === 'length' ? 'length' : undefined,
      };
    }
  }
}

function errorMessage(body: any): string {
  const e = Array.isArray(body) ? body[0]?.error : body?.error;
  if (!e) return '';
  return typeof e === 'string' ? e : e.message || e.status || '';
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** A plain-language explanation of an HTTP error from a service. */
export function explainError(provider: ApiProviderId, status: number, message: string): string {
  const { name, company, keyUrl } = PROVIDERS[provider];
  const site = keyUrl ? new URL(keyUrl).hostname : company;
  const keyIssue = status === 401 || (status === 400 && /api[ _-]?key/i.test(message)) || (status === 403 && provider === 'gemini' && /key/i.test(message));
  if (keyIssue) return company + ' rejected the API key. Check it in Settings.';
  if (status === 402) return 'The ' + name + ' account has run out of credit. Add some at ' + site + '.';
  if (status === 403) return 'This API key is not allowed to use this model. ' + message;
  if (status === 404) return company + ' does not know the model you chose. Pick another one in Settings (or press “Find models”).';
  if (status === 429)
    return provider === 'gemini'
      ? 'Too many requests, or the free daily limit is used up. Wait a minute and try again, or try tomorrow.'
      : 'Too many requests, or the account has run out of credit. Wait a minute, or check your balance at ' + site + '.';
  if (status === 529 || status === 503 || status === 502) return company + '’s servers are busy right now. Please try again in a moment.';
  if (status === 413) return 'The images are too large. Try fewer pages at once.';
  if (status === 400) return company + ' could not process the request: ' + (message || 'bad request');
  return company + ' returned an error (' + status + '): ' + (message || 'unknown error');
}

/** Send one turn of the conversation and return the reply. */
export async function chat(opts: {
  provider: ApiProviderId;
  apiKey: string;
  model: string;
  system: string;
  messages: Message[];
  signal: AbortSignal;
  maxTokens?: number;
  fetchFn?: typeof fetch;
}): Promise<Reply> {
  const fetchFn = opts.fetchFn || fetch.bind(globalThis);
  const { url, body } = buildRequest(opts.provider, opts.model, opts.system, opts.messages, opts.maxTokens ?? 16000);
  let res: Response;
  try {
    res = await fetchFn(url, {
      method: 'POST',
      signal: opts.signal,
      headers: { 'content-type': 'application/json', ...headersFor(opts.provider, opts.apiKey) },
      body: JSON.stringify(body),
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new RecognitionError('Could not reach ' + PROVIDERS[opts.provider].company + '. Check your internet connection and try again.');
  }
  let json: unknown = {};
  try {
    json = await res.json();
  } catch {
    /* a non-JSON error page */
  }
  if (!res.ok) throw new RecognitionError(explainError(opts.provider, res.status, errorMessage(json)));
  const reply = readReply(opts.provider, json);
  if (!reply.text.trim()) {
    throw new RecognitionError(
      reply.stop === 'refusal'
        ? 'The model declined to read this image.'
        : reply.stop === 'length'
          ? 'The model ran out of room before answering. Try one page at a time, or another model.'
          : 'The model returned an empty reply. Please try again.',
    );
  }
  return reply;
}

/** Check that a key works with a tiny request. */
export async function testKey(provider: ApiProviderId, apiKey: string, model: string, fetchFn?: typeof fetch): Promise<void> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 45000);
  try {
    await chat({ provider, apiKey, model, system: 'Reply with the single word OK.', messages: [{ role: 'user', parts: [{ text: 'Say OK.' }] }], signal: ctrl.signal, maxTokens: 400, fetchFn });
  } catch (e) {
    if (e instanceof RecognitionError) {
      // a reply cut short still proves the key works
      if (/ran out of room|empty reply/.test(e.message)) return;
      throw e;
    }
    throw new RecognitionError((e as Error).name === 'AbortError' ? 'The test timed out.' : 'Could not reach ' + PROVIDERS[provider].company + '.');
  } finally {
    clearTimeout(timer);
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * The models this key can use that read images, newest names first, so the
 * list keeps up with new releases. Free OpenRouter models are marked.
 */
export async function listModels(provider: ApiProviderId, apiKey: string, fetchFn: typeof fetch = fetch.bind(globalThis)): Promise<ModelInfo[]> {
  const url = { anthropic: ANTHROPIC_URL + '/models?limit=100', openai: OPENAI_URL + '/models', gemini: GEMINI_URL + '/models?pageSize=1000', openrouter: OPENROUTER_URL + '/models' }[provider];
  let res: Response;
  try {
    res = await fetchFn(url, { headers: headersFor(provider, apiKey) });
  } catch {
    throw new RecognitionError('Could not reach ' + PROVIDERS[provider].company + '.');
  }
  let json: any = {};
  try {
    json = await res.json();
  } catch {
    /* ignore */
  }
  if (!res.ok) throw new RecognitionError(explainError(provider, res.status, errorMessage(json)));
  const known = new Map(PROVIDERS[provider].models.map((m) => [m.id, m]));
  let out: ModelInfo[] = [];
  if (provider === 'anthropic') {
    out = (json.data || []).map((m: any) => ({ id: m.id, label: m.display_name || m.id }));
  } else if (provider === 'openai') {
    out = (json.data || [])
      .map((m: any) => String(m.id))
      .filter((id: string) => /^(gpt|o\d|chatgpt|chat-latest)/.test(id) && !/audio|realtime|transcribe|tts|image|search|embedding|moderation|codex|cyber|instruct|-\d{4}-\d\d-\d\d$/.test(id))
      .map((id: string) => ({ id, label: id }));
  } else if (provider === 'gemini') {
    out = (json.models || [])
      .filter((m: any) => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map((m: any) => ({ id: String(m.name).replace(/^models\//, ''), label: m.displayName || m.name }))
      .filter((m: ModelInfo) => /^gemini/.test(m.id) && !/tts|image|live|audio|embedding|transcribe|robotics|computer-use/.test(m.id))
      .map((m: ModelInfo) => ({ ...m, label: m.label + ' (' + m.id + ')' }));
  } else {
    out = (json.data || [])
      .filter((m: any) => (m.architecture?.input_modalities || []).includes('image'))
      .map((m: any) => {
        const free = m.pricing && Number(m.pricing.prompt) === 0 && Number(m.pricing.completion) === 0;
        const price: [number, number] | undefined = m.pricing ? [Number(m.pricing.prompt) * 1e6, Number(m.pricing.completion) * 1e6] : undefined;
        return { id: m.id, label: (m.name || m.id) + (free ? ' — free' : ''), price };
      });
  }
  // keep our descriptions for models we know
  out = out.map((m) => (known.has(m.id) ? { ...known.get(m.id)!, price: known.get(m.id)!.price ?? m.price } : m));
  return out.sort((a, b) => b.id.localeCompare(a.id, undefined, { numeric: true }));
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Rough cost in US dollars, for display only; undefined when the price is not known. */
export function estimateCost(price: [number, number] | undefined, usage: { input: number; output: number }): number | undefined {
  if (!price || !Number.isFinite(price[0]) || !Number.isFinite(price[1])) return undefined;
  return (usage.input * price[0] + usage.output * price[1]) / 1e6;
}
