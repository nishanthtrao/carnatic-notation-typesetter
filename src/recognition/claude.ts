/*
 * Reading notation from photos with Claude (Anthropic API), using the
 * user's own API key, called directly from the browser / desktop app.
 * SPDX-License-Identifier: GPL-2.0-only
 */
import { parse } from '../engine';
import { repairInstruction, SYSTEM_PROMPT, userInstruction, type RecognitionHints } from './prompt';
import type { PreparedImage } from './image';

export const API_URL = 'https://api.anthropic.com/v1/messages';

export const MODELS = [
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 — fast, good value (recommended)' },
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 — most accurate, about 2× the cost' },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 — cheapest, for neat printed pages' },
];
export const DEFAULT_MODEL = MODELS[0].id;

type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } };

interface Message {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
}

export class RecognitionError extends Error {}

export interface RecognitionResult {
  notation: string;
  notes: string[];
  warnings: { line: number; message: string }[];
  repaired: boolean;
  usage: { input: number; output: number };
}

/** Send one Messages API request and return the text of the reply. */
async function callClaude(
  apiKey: string,
  model: string,
  messages: Message[],
  signal: AbortSignal,
  fetchFn: typeof fetch,
): Promise<{ text: string; usage: { input: number; output: number } }> {
  let res: Response;
  try {
    res = await fetchFn(API_URL, {
      method: 'POST',
      signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        // the key is the user's own, entered on their own device
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({ model, max_tokens: 16000, system: SYSTEM_PROMPT, messages }),
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new RecognitionError('Could not reach Anthropic. Check your internet connection and try again.');
  }
  let body: {
    content?: { type: string; text?: string }[];
    usage?: { input_tokens?: number; output_tokens?: number };
    stop_reason?: string;
    error?: { type?: string; message?: string };
  } = {};
  try {
    body = await res.json();
  } catch {
    /* non-JSON error page */
  }
  if (!res.ok) throw new RecognitionError(explainError(res.status, body.error?.message || ''));
  const text = (body.content || []).filter((b) => b.type === 'text').map((b) => b.text || '').join('');
  if (!text.trim()) {
    throw new RecognitionError(body.stop_reason === 'refusal' ? 'The model declined to read this image.' : 'The model returned an empty reply. Please try again.');
  }
  return { text, usage: { input: body.usage?.input_tokens || 0, output: body.usage?.output_tokens || 0 } };
}

export function explainError(status: number, message: string): string {
  if (status === 401) return 'Anthropic rejected the API key. Check it in Settings (it should start with "sk-ant-").';
  if (status === 403) return 'This API key is not allowed to use this model. ' + message;
  if (status === 429) return 'Too many requests, or the account has run out of credit. Wait a minute or check your balance at platform.claude.com.';
  if (status === 529 || status === 503) return "Anthropic's servers are busy right now. Please try again in a moment.";
  if (status === 413) return 'The images are too large. Try fewer pages at once.';
  if (status === 400) return 'Anthropic could not process the request: ' + (message || 'bad request');
  return 'Anthropic returned an error (' + status + '): ' + (message || 'unknown error');
}

/** Pull the <notation> and <notes> parts out of the reply. */
export function extractReply(text: string): { notation: string; notes: string[] } {
  const nm = text.match(/<notation>\s*([\s\S]*?)\s*<\/notation>/i);
  let notation = nm ? nm[1] : '';
  if (!nm) {
    // fall back to a fenced code block, or the whole reply
    const fence = text.match(/```[a-z]*\n([\s\S]*?)```/i);
    notation = fence ? fence[1] : text;
  }
  notation = notation.replace(/^```[a-z]*\n?|```\s*$/gi, '').trim();
  const notesMatch = text.match(/<notes>\s*([\s\S]*?)\s*<\/notes>/i);
  const notes = (notesMatch ? notesMatch[1] : '')
    .split('\n')
    .map((l) => l.replace(/^\s*[-*•]\s*/, '').trim())
    .filter((l) => l && !/^none\.?$/i.test(l));
  return { notation: notation + '\n', notes };
}

/**
 * Read notation from one or more prepared images. Runs one automatic
 * correction round if the typesetter finds problems in the first reply.
 */
export async function recognizeNotation(opts: {
  apiKey: string;
  model: string;
  images: PreparedImage[];
  hints: RecognitionHints;
  signal: AbortSignal;
  onStage?: (stage: 'reading' | 'checking' | 'fixing') => void;
  fetchFn?: typeof fetch;
}): Promise<RecognitionResult> {
  const fetchFn = opts.fetchFn || fetch.bind(globalThis);
  if (!opts.apiKey) throw new RecognitionError('Add your Anthropic API key in Settings first.');
  if (!opts.images.length) throw new RecognitionError('Choose at least one image.');

  const content: ContentBlock[] = [];
  opts.images.forEach((img, i) => {
    if (opts.images.length > 1) content.push({ type: 'text', text: `Page ${i + 1}:` });
    content.push({ type: 'image', source: { type: 'base64', media_type: img.mediaType, data: img.base64 } });
  });
  content.push({ type: 'text', text: userInstruction(opts.hints, opts.images.length) });
  const messages: Message[] = [{ role: 'user', content }];

  opts.onStage?.('reading');
  const first = await callClaude(opts.apiKey, opts.model, messages, opts.signal, fetchFn);
  let reply = extractReply(first.text);
  const usage = { ...first.usage };

  opts.onStage?.('checking');
  let warnings = parse(reply.notation).warnings;
  let repaired = false;
  if (warnings.length) {
    opts.onStage?.('fixing');
    messages.push({ role: 'assistant', content: first.text });
    messages.push({ role: 'user', content: repairInstruction(warnings.slice(0, 30).map((w) => 'line ' + w.line + ': ' + w.message)) });
    try {
      const second = await callClaude(opts.apiKey, opts.model, messages, opts.signal, fetchFn);
      const fixed = extractReply(second.text);
      const fixedWarnings = parse(fixed.notation).warnings;
      usage.input += second.usage.input;
      usage.output += second.usage.output;
      if (fixedWarnings.length <= warnings.length) {
        reply = fixed;
        warnings = fixedWarnings;
        repaired = true;
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e;
      // keep the first reading if the correction round fails
    }
  }
  return { notation: reply.notation, notes: reply.notes, warnings, repaired, usage };
}

/** Rough cost in US dollars, for display only. */
export function estimateCost(model: string, usage: { input: number; output: number }): number {
  const price: Record<string, [number, number]> = {
    'claude-opus-5-5': [4, 20],
    'claude-sonnet-5-5': [2, 10],
    'claude-haiku-5-5': [0.1, 0.5],
  };
  const [i, o] = price[model] || price['claude-sonnet-5-5'];
  return (usage.input * i + usage.output * o) / 1e6;
}

/** Check that a key works with a tiny request. */
export async function testApiKey(apiKey: string, model: string, fetchFn: typeof fetch = fetch.bind(globalThis)): Promise<void> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30000);
  try {
    const res = await fetchFn(API_URL, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({ model, max_tokens: 64, messages: [{ role: 'user', content: 'Reply with the word OK.' }] }),
    });
    if (!res.ok) {
      let msg = '';
      try {
        msg = (await res.json()).error?.message || '';
      } catch {
        /* ignore */
      }
      throw new RecognitionError(explainError(res.status, msg));
    }
  } catch (e) {
    if (e instanceof RecognitionError) throw e;
    throw new RecognitionError((e as Error).name === 'AbortError' ? 'The test timed out.' : 'Could not reach Anthropic. Check your internet connection.');
  } finally {
    clearTimeout(timer);
  }
}
