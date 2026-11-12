/*
 * Carnatic Music Notation Typesetter — entry point
 * SPDX-License-Identifier: GPL-2.0-or-later
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { ToastProvider } from './components/Toast';
import { desk } from './lib/desktop';
import './styles/fonts.css';
import './styles/notation.css';
import './styles/app.css';

if (desk) document.documentElement.classList.add('is-desktop', 'platform-' + desk.platform);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>,
);
