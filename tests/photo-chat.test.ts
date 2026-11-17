// Read Photo with AI chat apps — run with: npm test
import { expect, test } from 'vitest';
import { PHOTO_API } from '../src/recognition/flags';
import { CHAT_APPS } from '../src/recognition/apps';
import { chatAppPrompt } from '../src/recognition/prompt';

test('reading with API keys stays off unless the build turns it on', () => {
  expect(PHOTO_API).toBe(false);
});

test('every app opens a new chat on its own https site, apart from "Another app"', () => {
  for (const a of CHAT_APPS) {
    if (a.id === 'other') expect(a.url).toBe('');
    else expect(new URL(a.url).protocol).toBe('https:');
  }
  expect(new Set(CHAT_APPS.map((a) => a.id)).size).toBe(CHAT_APPS.length);
});

test('the instructions teach the reader to count each cycle and keep the dots', () => {
  const p = chatAppPrompt({ script: 'kannada', tala: 'Rupaka', raga: '', notes: '' } as never, 1);
  expect(p).toMatch(/Count the matras in every cycle/);
  expect(p).toMatch(/Octave dots/);
  expect(p).toMatch(/Ditto marks/);
  expect(p).toMatch(/fenced code block/);
});
