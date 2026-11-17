// Photo-reader tests with simulated AI services — run with: npm test
// SPDX-License-Identifier: GPL-2.0-only
import { describe, expect, test } from 'vitest';
import { parse } from '../src/engine/parser';
import { checkReply, extractReply, recognizeNotation, RecognitionError } from '../src/recognition/recognize';
import { estimateCost, explainError, listModels, PROVIDERS, readReply, type ApiProviderId } from '../src/recognition/providers';
import { chatAppPrompt, chatRepairPrompt, SYSTEM_PROMPT, userInstruction } from '../src/recognition/prompt';
import { decodeKeys, encodeKeys } from '../src/recognition/settings';
import type { PreparedImage } from '../src/recognition/image';

const API_URL = 'https://api.anthropic.com/v1/messages';
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
    const r = await recognizeNotation({ provider: 'anthropic', apiKey: 'sk-ant-test', model: 'claude-sonnet-5-5', images: [IMAGE], hints: HINTS, signal: new AbortController().signal, fetchFn: fn, onStage: (s: string) => stages.push(s) });
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
    const r = await recognizeNotation({ provider: 'anthropic', apiKey: 'k', model: 'claude-opus-5-5', images: [IMAGE, IMAGE], hints: HINTS, signal: new AbortController().signal, fetchFn: fn });
    expect(calls).toHaveLength(2);
    const second = calls[1].body.messages;
    expect(second).toHaveLength(3);
    expect(second[1]).toEqual({ role: 'assistant', content: [{ type: 'text', text: BAD }] });
    expect(second[2].content[0].text).toMatch(/line 3: Ignored "x"/);
    // two pages are labelled
    expect(calls[0].body.messages[0].content[0]).toEqual({ type: 'text', text: 'Page 1:' });
    expect(r.repaired).toBe(true);
    expect(r.warnings).toEqual([]);
    expect(r.usage).toEqual({ input: 10000, output: 1600 });
  });

  test('keeps the first reading if the correction is worse or fails', async () => {
    const { fn } = fakeFetch([{ text: BAD }, { status: 529 }]);
    const r = await recognizeNotation({ provider: 'anthropic', apiKey: 'k', model: 'claude-sonnet-5-5', images: [IMAGE], hints: HINTS, signal: new AbortController().signal, fetchFn: fn });
    expect(r.repaired).toBe(false);
    expect(r.notation).toMatch(/s r x g/);
    expect(r.warnings.length).toBe(1);
  });

  test('explains API errors in plain words', async () => {
    const { fn } = fakeFetch([{ status: 401, error: 'invalid x-api-key' }]);
    await expect(recognizeNotation({ provider: 'anthropic', apiKey: 'bad', model: 'claude-sonnet-5-5', images: [IMAGE], hints: HINTS, signal: new AbortController().signal, fetchFn: fn })).rejects.toThrow(/rejected the API key/);
    expect(explainError('anthropic', 429, '')).toMatch(/credit/);
    expect(explainError('anthropic', 529, '')).toMatch(/busy/);
    expect(explainError('gemini', 429, '')).toMatch(/free daily limit/);
    expect(explainError('gemini', 400, 'API key not valid. Please pass a valid API key.')).toMatch(/Google rejected the API key/);
    expect(explainError('openai', 404, '')).toMatch(/Find models/);
  });

  test('needs a key and an image', async () => {
    await expect(recognizeNotation({ provider: 'gemini', apiKey: '', model: 'm', images: [IMAGE], hints: HINTS, signal: new AbortController().signal })).rejects.toBeInstanceOf(RecognitionError);
    await expect(recognizeNotation({ provider: 'openai', apiKey: 'k', model: 'm', images: [], hints: HINTS, signal: new AbortController().signal })).rejects.toThrow(/at least one image/);
  });

  test('cost estimate', () => {
    expect(estimateCost(PROVIDERS.anthropic.models[0].price, { input: 1_000_000, output: 100_000 })).toBeCloseTo(3);
    expect(estimateCost(undefined, { input: 1, output: 1 })).toBeUndefined();
  });
});

/** Each service's reply format, holding the given text. */
function replyFor(provider: ApiProviderId, text: string) {
  switch (provider) {
    case 'openai':
      return { status: 'completed', output: [{ type: 'reasoning', summary: [] }, { type: 'message', content: [{ type: 'output_text', text }] }], usage: { input_tokens: 100, output_tokens: 20 } };
    case 'gemini':
      return { candidates: [{ content: { parts: [{ text: 'thinking…', thought: true }, { text }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 15, thoughtsTokenCount: 5 } };
    case 'openrouter':
      return { choices: [{ message: { content: text }, finish_reason: 'stop' }], usage: { prompt_tokens: 100, completion_tokens: 20 } };
    default:
      return { content: [{ type: 'text', text }], usage: { input_tokens: 100, output_tokens: 20 } };
  }
}

describe('other services', () => {
  const cases: [ApiProviderId, string, string][] = [
    ['openai', 'https://api.openai.com/v1/responses', 'authorization'],
    ['gemini', 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent', 'x-goog-api-key'],
    ['openrouter', 'https://openrouter.ai/api/v1/chat/completions', 'authorization'],
  ];
  for (const [provider, url, header] of cases) {
    test(provider + ': request format, reply and correction round', async () => {
      const calls: { url: string; init: RequestInit; body: any }[] = [];
      const replies = [BAD, GOOD];
      const fn = (async (u: string, init: RequestInit) => {
        calls.push({ url: u, init, body: JSON.parse(String(init.body)) });
        return new Response(JSON.stringify(replyFor(provider, replies.shift()!)), { status: 200 });
      }) as unknown as typeof fetch;
      const model = provider === 'gemini' ? 'gemini-3.5-flash' : 'some-model';
      const r = await recognizeNotation({ provider, apiKey: 'KEY', model, images: [IMAGE], hints: HINTS, signal: new AbortController().signal, fetchFn: fn });
      expect(calls).toHaveLength(2);
      expect(calls[0].url).toBe(url);
      const h = calls[0].init.headers as Record<string, string>;
      expect(h[header]).toBe(header === 'authorization' ? 'Bearer KEY' : 'KEY');
      const json = JSON.stringify(calls[0].body);
      expect(json).toContain('AAAA'); // the image
      expect(json).toContain('Tamil'); // the hints
      expect(json).toContain('Carnatic Music Notation Typesetter'); // the instructions
      // the second request carries the first reply and the problems
      const second = JSON.stringify(calls[1].body);
      expect(second).toContain('s r x g');
      expect(second).toContain('Ignored');
      expect(r.repaired).toBe(true);
      expect(r.warnings).toEqual([]);
      expect(r.usage).toEqual({ input: 200, output: 40 });
    });
  }

  test('thinking parts are left out, and refusals and cut-off replies are explained', () => {
    expect(readReply('gemini', replyFor('gemini', 'hello')).text).toBe('hello');
    expect(readReply('gemini', { promptFeedback: { blockReason: 'SAFETY' } }).stop).toBe('refusal');
    expect(readReply('openai', { status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' }, output: [] }).stop).toBe('length');
    expect(readReply('openrouter', { choices: [{ message: { content: [{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }] } }] }).text).toBe('ab');
  });

  test('model lists keep only models that read images', async () => {
    const fn = (async () =>
      new Response(
        JSON.stringify({
          models: [
            { name: 'models/gemini-3.5-flash', displayName: 'Gemini 3.5 Flash', supportedGenerationMethods: ['generateContent'] },
            { name: 'models/gemini-3.1-flash-tts-preview', displayName: 'TTS', supportedGenerationMethods: ['generateContent'] },
            { name: 'models/text-embedding-004', displayName: 'Embedding', supportedGenerationMethods: ['embedContent'] },
          ],
        }),
      )) as unknown as typeof fetch;
    const list = await listModels('gemini', 'k', fn);
    expect(list.map((m) => m.id)).toEqual(['gemini-3.5-flash']);
    expect(list[0].price).toEqual([1.5, 9]); // our known price is kept

    const or = (async () =>
      new Response(
        JSON.stringify({
          data: [
            { id: 'x/vision:free', name: 'Vision', architecture: { input_modalities: ['text', 'image'] }, pricing: { prompt: '0', completion: '0' } },
            { id: 'x/text', name: 'Text', architecture: { input_modalities: ['text'] }, pricing: { prompt: '0.000001', completion: '0.000002' } },
          ],
        }),
      )) as unknown as typeof fetch;
    const orList = await listModels('openrouter', 'k', or);
    expect(orList.map((m) => m.label)).toEqual(['Vision — free']);
  });
});

describe('chat app (no API key)', () => {
  test('the instructions ask for a code block and carry the hints', () => {
    const p = chatAppPrompt(HINTS, 2);
    expect(p.startsWith(SYSTEM_PROMPT)).toBe(true);
    expect(p).toMatch(/2 pages/);
    expect(p).toMatch(/fenced code block/);
    expect(chatRepairPrompt(['line 3: x'])).toMatch(/line 3: x[\s\S]*code block/);
  });

  test('a pasted markdown reply is understood, notes included', () => {
    const pasted = 'Here is the transcription:\n\n```\nTala: Adi\nSmartLyricMode\nS: s r g m | p d | n s\' ||\n```\n\nUncertain:\n- line 3: the last swara may be s\n';
    const r = checkReply(pasted);
    expect(r.notation).toBe("Tala: Adi\nSmartLyricMode\nS: s r g m | p d | n s' ||\n");
    expect(r.notes).toEqual(['line 3: the last swara may be s']);
    expect(r.warnings).toEqual([]);
  });
});

describe('saved keys', () => {
  test('older single Anthropic keys are still read, and keys round-trip', () => {
    expect(decodeKeys('sk-ant-old')).toEqual({ anthropic: 'sk-ant-old' });
    expect(decodeKeys(encodeKeys({ gemini: ' AIzaX ', openai: '' }))).toEqual({ gemini: 'AIzaX' });
    expect(encodeKeys({})).toBe('');
    expect(decodeKeys('{broken')).toEqual({});
  });
});
