/*
 * The AI chat apps Read Photo can hand a photo to: the user picks one, copies
 * the instructions, attaches the photo there and pastes the reply back.
 * SPDX-License-Identifier: GPL-2.0-only
 */
import { store } from '../lib/storage';

export interface ChatApp {
  id: string;
  name: string;
  /** where a new chat starts; empty for "another app" */
  url: string;
  /** who makes it */
  by: string;
}

export const CHAT_APPS: ChatApp[] = [
  { id: 'claude', name: 'Claude', url: 'https://claude.ai/new', by: 'Anthropic' },
  { id: 'chatgpt', name: 'ChatGPT', url: 'https://chatgpt.com/', by: 'OpenAI' },
  { id: 'gemini', name: 'Gemini', url: 'https://gemini.google.com/app', by: 'Google' },
  { id: 'copilot', name: 'Copilot', url: 'https://copilot.microsoft.com/', by: 'Microsoft' },
  { id: 'grok', name: 'Grok', url: 'https://grok.com/', by: 'xAI' },
  { id: 'qwen', name: 'Qwen', url: 'https://chat.qwen.ai/', by: 'Alibaba' },
  { id: 'other', name: 'Another app', url: '', by: '' },
];

const KEY = 'cmnt.v3.chatapp';

export function loadChatApp(): ChatApp {
  const id = store.get(KEY);
  return CHAT_APPS.find((a) => a.id === id) || CHAT_APPS[0];
}

export function saveChatApp(app: ChatApp): void {
  store.set(KEY, app.id);
}
