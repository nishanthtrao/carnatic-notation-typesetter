/*
 * Offline support and "Install app".
 * SPDX-License-Identifier: GPL-2.0-only
 */
import { useEffect, useState } from 'react';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((f) => f());

/** Register the service worker on the website (not the desktop app or a sandboxed preview). */
export function setupOffline(isDesktop: boolean) {
  if (typeof window === 'undefined') return;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // show our own Install button instead of the mini-infobar
    deferred = e as InstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    notify();
  });
  let framed = true;
  try {
    framed = window.top !== window;
  } catch {
    /* cross-origin frame */
  }
  const secure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if (!import.meta.env.PROD || isDesktop || framed || !secure || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {
      /* offline support is optional */
    });
  });
}

/** Whether the browser offered to install the app (Chrome, Edge, Android). */
export function useInstallPrompt(): { canInstall: boolean; install: () => Promise<void> } {
  const [canInstall, setCanInstall] = useState(!!deferred);
  useEffect(() => {
    const f = () => setCanInstall(!!deferred);
    listeners.add(f);
    return () => {
      listeners.delete(f);
    };
  }, []);
  return {
    canInstall,
    install: async () => {
      if (!deferred) return;
      const e = deferred;
      deferred = null;
      notify();
      await e.prompt();
      await e.userChoice.catch(() => undefined);
    },
  };
}

/** Running as an installed app (home screen / dock)? */
export function isInstalled(): boolean {
  try {
    return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  } catch {
    return false;
  }
}
