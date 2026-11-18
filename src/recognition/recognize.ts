/*
 * Reading notation from photos with an AI model (see providers.ts), using
 * the user's own API key, called directly from the browser / desktop app.
 * SPDX-License-Identifier: GPL-2.0-only
 */
import { parse } from '../engine';
import { repairInstruction, SYSTEM_PROMPT, userInstruction, type RecognitionHints } from './prompt';
import type { PreparedImage } from './image';
import { checkCycles } from './cycles';
import { chat, PROVIDERS, RecognitionError, type ApiProviderId, type Message, type Part } from './providers';

export { RecognitionError } from './providers';

export interface RecognitionResult {
  notation: string;
  notes: string[];
  warnings: { line: number; message: string }[];
  repaired: boolean;
  usage: { input: number; output: number };
}

/** What the typesetter reports, plus cycles whose matras don't add up to the tala. */
export function reviewWarnings(notation: string, warnings = parse(notation).warnings): { line: number; message: string }[] {
  return [...warnings, ...checkCycles(notation)].sort((a, b) => a.line - b.line);
}

/** Pull the <notation> and <notes> parts out of the reply. */
export function extractReply(text: string): { notation: string; notes: string[] } {
  const nm = text.match(/<notation>\s*([\s\S]*?)\s*<\/notation>/i);
  let notation = nm ? nm[1] : '';
  let rest = '';
  if (!nm) {
    // fall back to a fenced code block (chat apps), or the whole reply
    const fence = text.match(/```[a-z]*\n([\s\S]*?)```/i);
    notation = fence ? fence[1] : text;
    if (fence) rest = text.slice((fence.index || 0) + fence[0].length);
  }
  notation = notation.replace(/^```[a-z]*\n?|```\s*$/gi, '').trim();
  const notesMatch = text.match(/<notes>\s*([\s\S]*?)\s*<\/notes>/i);
  const notesText = notesMatch ? notesMatch[1] : rest.split('\n').filter((l) => /^\s*[-*•]\s+/.test(l)).join('\n');
  const notes = notesText
    .split('\n')
    .map((l) => l.replace(/^\s*[-*•]\s*/, '').trim())
    .filter((l) => l && !/^none\.?$/i.test(l));
  return { notation: notation + '\n', notes };
}

/** Check a transcription with the typesetter and package it for review. */
export function checkReply(text: string): RecognitionResult {
  const reply = extractReply(text);
  return { ...reply, warnings: reviewWarnings(reply.notation), repaired: false, usage: { input: 0, output: 0 } };
}

/**
 * Read notation from one or more prepared images. Runs one automatic
 * correction round if the typesetter finds problems in the first reply.
 */
export async function recognizeNotation(opts: {
  provider: ApiProviderId;
  apiKey: string;
  model: string;
  images: PreparedImage[];
  hints: RecognitionHints;
  signal: AbortSignal;
  onStage?: (stage: 'reading' | 'checking' | 'fixing') => void;
  fetchFn?: typeof fetch;
}): Promise<RecognitionResult> {
  if (!opts.apiKey) throw new RecognitionError('Add your ' + PROVIDERS[opts.provider].name + ' API key in Settings first.');
  if (!opts.images.length) throw new RecognitionError('Choose at least one image.');
  const send = (messages: Message[]) => chat({ provider: opts.provider, apiKey: opts.apiKey, model: opts.model, system: SYSTEM_PROMPT, messages, signal: opts.signal, fetchFn: opts.fetchFn });

  const parts: Part[] = [];
  opts.images.forEach((image, i) => {
    if (opts.images.length > 1) parts.push({ text: `Page ${i + 1}:` });
    parts.push({ image });
  });
  parts.push({ text: userInstruction(opts.hints, opts.images.length) });
  const messages: Message[] = [{ role: 'user', parts }];

  opts.onStage?.('reading');
  const first = await send(messages);
  let reply = extractReply(first.text);
  const usage = { ...first.usage };

  opts.onStage?.('checking');
  let warnings = reviewWarnings(reply.notation);
  let repaired = false;
  if (warnings.length) {
    opts.onStage?.('fixing');
    messages.push({ role: 'assistant', parts: [{ text: first.text }] });
    messages.push({ role: 'user', parts: [{ text: repairInstruction(warnings.slice(0, 30).map((w) => 'line ' + w.line + ': ' + w.message)) }] });
    try {
      const second = await send(messages);
      const fixed = extractReply(second.text);
      const fixedWarnings = reviewWarnings(fixed.notation);
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
