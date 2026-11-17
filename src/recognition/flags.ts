/*
 * Switches for the photo reader.
 * SPDX-License-Identifier: GPL-2.0-only
 */

/**
 * Reading photos with the user's own API key (Claude, Gemini, OpenAI,
 * OpenRouter). Off: Read Photo only offers the AI chat apps, by link and
 * copied instructions, and the API settings are hidden. Turn it on by building
 * with VITE_PHOTO_API=on (for example in the Render environment).
 */
export const PHOTO_API: boolean = import.meta.env.VITE_PHOTO_API === 'on';
