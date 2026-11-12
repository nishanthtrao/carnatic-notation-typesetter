// Photo-reader tests with a simulated Anthropic API — run with: npm test
// SPDX-License-Identifier: GPL-2.0-or-later
import { describe, expect, test } from 'vitest';
import { parse } from '../src/engine/parser';
import { API_URL, estimateCost, explainError, extractReply, recognizeNotation, RecognitionError } from '../src/recognition/claude';
import { SYSTEM_PROMPT, userInstruction } from '../src/recognition/prompt';
import type { PreparedImage } from '../src/recognition/image';

const IMAGE: PreparedImage = { base64: 'AAAA', mediaType: 'image/jpeg', width: 10, height: 10, bytes: 3 };
const HINTS = { script: 'tamil' as const, tala: 'Adi', raga: '', notes: '' };

const GOOD = `<notation>
Title: "test"
Tala: Adi
DefaultSpeed: 1
Language: Tamil
SmartLyricMode
S: s r g m ( p d n s' ) s' n d p m g r s
L: sa ri ga ma pa da ni sa sa ni da pa ma ga ri sa
</notation>
<notes>
- line 7: the last swara might be r
</notes>`;

const BAD = `<notation>
Tala: Adi
SmartLyricMode
S: s r x g
</notation>
<notes>
- none
</notes>`;

/** A fake fetch that returns queued replies and records the requests. */
function fakeFetch(replies: { status?: number; text?: string; error?: string }[]) {
  const calls: { url: string; init: RequestInit; body: any }[] = [];
  const fn = (async (url: string, init: RequestInit) => {
    calls.push({ url, init, body: JSON.parse(String(init.body)) });
    const r = replies.shift()!;
    const status = r.status ?? 200;
    const json = status === 200
      ? { content: [{ type: 'thinking', thinking: '…' }, { type: 'text', text: r.text }], usage: { input_tokens: 5000, output_tokens: 800 }, stop_reason: 'end_turn' }
      : { type: 'error', error: { type: 'x', message: r.error || '' } };
    return new Response(JSON.stringify(json), { status, headers: { 'content-type': 'application/json' } });
  }) as unknown as typeof fetch;
  return { fn, calls };
}

describe('prompt', () => {
  test('the worked example in the system prompt is valid input', () => {
    const m = SYSTEM_PROMPT.match(/# Example[\s\S]*?<notation>\n([\s\S]*?)<\/notation>/);
    expect(m).toBeTruthy();
    expect(parse(m![1]).warnings).toEqual([]);
  });
  test('hints are passed on', () => {
    const t = userInstruction({ script: 'telugu', tala: 'Rupaka', raga: 'mOhanam', notes: 'dashes are commas' }, 2);
    expect(t).toMatch(/2 pages/);
    expect(t).toMatch(/Telugu/);
    expect(t).toMatch(/Rupaka/);
    expect(t).toMatch(/mOhanam/);
    expect(t).toMatch(/dashes are commas/);
  });
});

describe('extractReply', () => {
  test('splits notation and notes', () => {
    const r = extractReply(GOOD);
    expect(r.notation.startsWith('Title: "test"')).toBe(true);
    expect(r.notes).toEqual(['line 7: the last swara might be r']);
  });
  test('"none" means no notes; code fences are tolerated', () => {
    expect(extractReply(BAD).notes).toEqual([]);
    expect(extractReply('```\nTala: Adi\nS: s r\n```').notation).toBe('Tala: Adi\nS: s r\n');
  });
});

describe('recognizeNotation', () => {
  test('sends one well-formed request when the reply is valid', async () => {
    const { fn, calls } = fakeFetch([{ text: GOOD }]);
    const stages: string[] = [];
    const r = await recognizeNotation({ apiKey: 'sk-ant-test', model: 'claude-sonnet-5-5', images: [IMAGE], hints: HINTS, signal: new AbortController().signal, fetchFn: fn, onStage: (s) => stages.push(s) });
    expect(calls).toHaveLength(1);
    const { url, init, body } = calls[0];
    expect(url).toBe(API_URL);
    const h = init.headers as Record<string, string>;
    expect(h['x-api-key']).toBe('sk-ant-test');
    expect(h['anthropic-version']).toBe('2023-06-01');
    expect(h['anthropic-dangerous-direct-browser-access']).toBe('true');
    expect(body.model).toBe('claude-sonnet-5-5');
    expect(body.system).toBe(SYSTEM_PROMPT);
    // image first, then the instruction
    expect(body.messages[0].content[0].type).toBe('image');
    expect(body.messages[0].content[0].source).toEqual({ type: 'base64', media_type: 'image/jpeg', data: 'AAAA' });
    expect(body.messages[0].content.at(-1).text).toMatch(/Tamil/);
    expect(r.warnings).toEqual([]);
    expect(r.repaired).toBe(false);
    expect(r.notes).toHaveLength(1);
    expect(stages).toEqual(['reading', 'checking']);
  });

  test('asks once for a correction when the typesetter finds problems', async () => {
    const { fn, calls } = fakeFetch([{ text: BAD }, { text: GOOD }]);
    const r = await recognizeNotation({ apiKey: 'k', model: 'claude-opus-5-5', images: [IMAGE, IMAGE], hints: HINTS, signal: new AbortController().signal, fetchFn: fn });
    expect(calls).toHaveLength(2);
    const second = calls[1].body.messages;
    expect(second).toHaveLength(3);
    expect(second[1]).toEqual({ role: 'assistant', content: BAD });
    expect(second[2].content).toMatch(/line 3: Ignored "x"/);
    // two pages are labelled
    expect(calls[0].body.messages[0].content[0]).toEqual({ type: 'text', text: 'Page 1:' });
    expect(r.repaired).toBe(true);
    expect(r.warnings).toEqual([]);
    expect(r.usage).toEqual({ input: 10000, output: 1600 });
  });

  test('keeps the first reading if the correction is worse or fails', async () => {
    const { fn } = fakeFetch([{ text: BAD }, { status: 529 }]);
    const r = await recognizeNotation({ apiKey: 'k', model: 'claude-sonnet-5-5', images: [IMAGE], hints: HINTS, signal: new AbortController().signal, fetchFn: fn });
    expect(r.repaired).toBe(false);
    expect(r.notation).toMatch(/s r x g/);
    expect(r.warnings.length).toBe(1);
  });

  test('explains API errors in plain words', async () => {
    const { fn } = fakeFetch([{ status: 401, error: 'invalid x-api-key' }]);
    await expect(recognizeNotation({ apiKey: 'bad', model: 'claude-sonnet-5-5', images: [IMAGE], hints: HINTS, signal: new AbortController().signal, fetchFn: fn })).rejects.toThrow(/rejected the API key/);
    expect(explainError(429, '')).toMatch(/credit/);
    expect(explainError(529, '')).toMatch(/busy/);
  });

  test('needs a key and an image', async () => {
    await expect(recognizeNotation({ apiKey: '', model: 'm', images: [IMAGE], hints: HINTS, signal: new AbortController().signal })).rejects.toBeInstanceOf(RecognitionError);
    await expect(recognizeNotation({ apiKey: 'k', model: 'm', images: [], hints: HINTS, signal: new AbortController().signal })).rejects.toThrow(/at least one image/);
  });

  test('cost estimate', () => {
    expect(estimateCost('claude-sonnet-5-5', { input: 1_000_000, output: 100_000 })).toBeCloseTo(3);
  });
});
