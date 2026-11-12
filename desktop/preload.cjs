/*
 * Carnatic Music Notation Typesetter — desktop bridge (Electron preload)
 * SPDX-License-Identifier: GPL-2.0-only
 *
 * Exposes a small, fixed API to the page as window.cmntDesktop. The page
 * never gets direct access to Node.js or the file system.
 */
'use strict';
const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('cmntDesktop', {
  platform: process.platform,
  startup: () => ipcRenderer.invoke('startup'),
  openFile: () => ipcRenderer.invoke('file:open'),
  openDropped: (file) => {
    const p = webUtils && webUtils.getPathForFile ? webUtils.getPathForFile(file) : '';
    return p ? ipcRenderer.invoke('file:openPath', p) : Promise.resolve({ error: 'Could not read the dropped file.' });
  },
  saveFile: (opts) => ipcRenderer.invoke('file:save', opts),
  exportPdf: (opts) => ipcRenderer.invoke('pdf:export', opts),
  revealPdf: (p) => ipcRenderer.invoke('pdf:reveal', p),
  print: () => ipcRenderer.invoke('print'),
  setState: (s) => ipcRenderer.send('doc:state', s),
  saveDraft: (text) => ipcRenderer.send('doc:draft', text),
  setExamples: (list) => ipcRenderer.send('examples:set', list),
  getApiKey: () => ipcRenderer.invoke('apikey:get'),
  setApiKey: (key) => ipcRenderer.invoke('apikey:set', key),
  closeWindow: () => ipcRenderer.send('window:close'),
  newWindow: () => ipcRenderer.send('window:new'),
  onMenu: (cb) => ipcRenderer.on('menu', (_e, cmd) => cb(cmd)),
  onOpenFile: (cb) => ipcRenderer.on('open-file', (_e, f) => cb(f)),
});
