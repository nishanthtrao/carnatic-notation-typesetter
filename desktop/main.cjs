/*
 * Carnatic Music Notation Typesetter — desktop app (Electron main process)
 * SPDX-License-Identifier: GPL-2.0-only
 *
 * Wraps the web app (index.html) in a native window and adds what a browser
 * page cannot do: real file Open/Save/Save As, PDF export, native printing,
 * menus with keyboard shortcuts, recent files, opening .cmnt files by
 * double-click, a "save changes?" prompt when closing, crash recovery, and
 * encrypted storage of the photo reader's API key.
 */
'use strict';
const { app, BrowserWindow, Menu, dialog, ipcMain, safeStorage, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
// the web app, built by Vite (npm run build)
const INDEX = path.join(ROOT, 'dist', 'index.html');
const MANUAL = path.join(ROOT, 'dist', 'docs', 'manual.html');
const PRODUCT = 'Carnatic Notation Typesetter';
const NOTATION_EXT = ['cmnt', 'txt', 'text'];
const MAX_FILE = 5 * 1024 * 1024;

// The Examples menu is filled in by the page (setExamples)
let EXAMPLES = [];

// ---- small persistent settings (recent files, last file, window size) -------
const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');
let settings = { recent: [], lastFile: null, bounds: null };
function loadSettings() {
  try {
    settings = Object.assign(settings, JSON.parse(fs.readFileSync(settingsFile(), 'utf8')));
  } catch (e) { /* first run */ }
}
function saveSettings() {
  try {
    fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
    fs.writeFileSync(settingsFile(), JSON.stringify(settings, null, 2));
  } catch (e) { /* ignore */ }
}
function rememberFile(p) {
  settings.recent = [p].concat(settings.recent.filter((x) => x !== p)).slice(0, 10);
  settings.lastFile = p;
  saveSettings();
  app.addRecentDocument(p);
  buildMenu();
}

// ---- crash recovery: unsaved text is mirrored to a file per window ----------
const recoveryDir = () => path.join(app.getPath('userData'), 'recovery');
const SESSION = Date.now().toString(36);
const recoveryFile = (id) => path.join(recoveryDir(), 'window-' + SESSION + '-' + id + '.json');
function writeRecovery(id, data) {
  try {
    fs.mkdirSync(recoveryDir(), { recursive: true });
    fs.writeFileSync(recoveryFile(id), JSON.stringify(data));
  } catch (e) { /* ignore */ }
}
function clearRecovery(id) {
  try { fs.unlinkSync(recoveryFile(id)); } catch (e) { /* none */ }
}
/** Take the most recent recovery file left by a crash (and discard the rest). */
function takeRecovered() {
  let files = [];
  try {
    files = fs.readdirSync(recoveryDir()).filter((f) => f.endsWith('.json'))
      .map((f) => path.join(recoveryDir(), f))
      .filter((f) => !path.basename(f).startsWith('window-' + SESSION + '-')); // not this session's
  } catch (e) {
    return null;
  }
  let best = null;
  for (const f of files) {
    try {
      const d = JSON.parse(fs.readFileSync(f, 'utf8'));
      if (d && typeof d.text === 'string' && (!best || d.savedAt > best.savedAt)) best = d;
    } catch (e) { /* corrupt */ }
    try { fs.unlinkSync(f); } catch (e) { /* ignore */ }
  }
  return best;
}

// ---- windows -----------------------------------------------------------------
// Per-window state: { path, dirty, name, pendingFile, additional, forceClose, known:Set }
const state = new Map();

function isNotationFile(p) {
  return typeof p === 'string' && NOTATION_EXT.includes(path.extname(p).slice(1).toLowerCase());
}

function readNotation(p) {
  const st = fs.statSync(p);
  if (!st.isFile() || st.size > MAX_FILE) throw new Error('Not a notation file');
  return { path: p, name: path.basename(p), text: fs.readFileSync(p, 'utf8') };
}

function createWindow(opts) {
  opts = opts || {};
  const b = settings.bounds || {};
  const win = new BrowserWindow({
    width: b.width || 1200,
    height: b.height || 860,
    x: opts.additional ? undefined : b.x,
    y: opts.additional ? undefined : b.y,
    minWidth: 420,
    minHeight: 480,
    backgroundColor: '#f5f5f7',
    title: PRODUCT,
    show: false,
    // macOS: the page's toolbar is the title bar, with the traffic lights inset
    ...(process.platform === 'darwin' ? { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 16, y: 20 }, vibrancy: 'titlebar' } : {}),
    icon: path.join(ROOT, 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });
  state.set(win.id, {
    path: null,
    name: 'Untitled',
    dirty: false,
    pendingFile: opts.file || null,
    additional: !!opts.additional,
    forceClose: false,
    known: new Set(opts.file ? [opts.file] : []),
  });

  win.once('ready-to-show', () => win.show());
  win.loadFile(INDEX);

  // Links: the manual opens in its own window, web links in the browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('file:') && url.includes('/docs/manual.html')) openManual();
    else if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  // Keep our own window title (file name + unsaved marker)
  win.on('page-title-updated', (e) => e.preventDefault());
  guardNavigation(win.webContents, false);

  win.on('close', (e) => {
    const s = state.get(win.id);
    if (!s || !s.dirty || s.forceClose) return;
    e.preventDefault();
    const choice = dialog.showMessageBoxSync(win, {
      type: 'warning',
      buttons: ['Save', "Don't Save", 'Cancel'],
      defaultId: 0,
      cancelId: 2,
      message: 'Do you want to save the changes to “' + s.name + '”?',
      detail: 'Your changes will be lost if you don’t save them.',
    });
    if (choice === 0) win.webContents.send('menu', 'saveThenClose');
    else if (choice === 1) win.webContents.send('menu', 'discardThenClose');
  });
  const id = win.id;
  win.on('closed', () => {
    clearRecovery(id);
    state.delete(id);
  });
  const keepBounds = () => {
    if (!win.isMaximized() && !win.isMinimized() && !win.isFullScreen()) {
      settings.bounds = win.getBounds();
    }
  };
  win.on('resize', keepBounds);
  win.on('move', keepBounds);
  return win;
}

/** Stop the page from navigating away (e.g. a file dropped on the window). */
function guardNavigation(wc, isManual) {
  wc.on('will-navigate', (e, url) => {
    if (/^https?:\/\//i.test(url)) {
      e.preventDefault();
      shell.openExternal(url);
      return;
    }
    if (isManual && url.startsWith('file:') && /\/index\.html/.test(url)) {
      // "Back to the editor" from the manual: just close the manual window
      e.preventDefault();
      const w = BrowserWindow.fromWebContents(wc);
      if (w) w.close();
      return;
    }
    if (isManual && url.startsWith('file:') && url.includes('/docs/manual.html')) return; // in-page anchors
    e.preventDefault();
  });
}

let manualWin = null;
function openManual() {
  if (manualWin && !manualWin.isDestroyed()) {
    manualWin.focus();
    return;
  }
  const w = (manualWin = new BrowserWindow({
    width: 960,
    height: 900,
    title: 'Manual — ' + PRODUCT,
    autoHideMenuBar: true,
    backgroundColor: '#f5f5f7',
    icon: path.join(ROOT, 'build', 'icon.png'),
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  }));
  w.on('page-title-updated', (e) => e.preventDefault());
  guardNavigation(w.webContents, true);
  w.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  w.loadFile(MANUAL);
}

function updateTitle(win) {
  const s = state.get(win.id);
  if (!s) return;
  win.setTitle(s.name + (s.dirty && process.platform !== 'darwin' ? ' •' : '') + ' — ' + PRODUCT);
  if (process.platform === 'darwin') {
    win.setDocumentEdited(!!s.dirty);
    win.setRepresentedFilename(s.path || '');
  }
}

/** Open a file from the OS (double-click, "Open with", recent files). */
function openFromSystem(p) {
  if (!isNotationFile(p) || !fs.existsSync(p)) return;
  // reuse an empty, unchanged window if there is one
  for (const win of BrowserWindow.getAllWindows()) {
    const s = state.get(win.id);
    if (s && !s.dirty && !s.path && !s.touched) {
      s.known.add(p);
      try {
        win.webContents.send('open-file', readNotation(p));
        rememberFile(p);
      } catch (e) {
        dialog.showErrorBox('Could not open file', String(e.message || e));
      }
      win.focus();
      return;
    }
  }
  const win = createWindow({ file: p, additional: BrowserWindow.getAllWindows().length > 0 });
  win.focus();
}

function focusedOrFirst() {
  return BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0] || null;
}

function send(cmd) {
  const win = focusedOrFirst();
  if (win && state.has(win.id)) win.webContents.send('menu', cmd);
  else if (!win) createWindow();
}

// ---- IPC from the page ------------------------------------------------------
const FILTERS = [
  { name: 'Carnatic notation', extensions: ['cmnt', 'txt'] },
  { name: 'All files', extensions: ['*'] },
];

ipcMain.handle('startup', (e) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const s = win && state.get(win.id);
  if (!s) return {};
  let file = null;
  let lastFile = null;
  try {
    if (s.pendingFile) {
      file = readNotation(s.pendingFile);
      rememberFile(s.pendingFile);
    }
  } catch (err) {
    dialog.showErrorBox('Could not open file', String(err.message || err));
  }
  s.pendingFile = null;
  let recovered = null;
  if (!file && !s.additional) {
    recovered = takeRecovered();
    if (recovered && recovered.path && fs.existsSync(recovered.path)) s.known.add(recovered.path);
    else if (recovered) recovered.path = null;
  }
  if (!file && !recovered && !s.additional && settings.lastFile) {
    try {
      lastFile = readNotation(settings.lastFile);
      s.known.add(settings.lastFile);
    } catch (err) { /* moved or deleted */ }
  }
  if (recovered) {
    recovered.name = recovered.path ? path.basename(recovered.path) : null;
    writeRecovery(win.id, Object.assign({}, recovered, { savedAt: Date.now() }));
  }
  return { file, lastFile, recovered, additional: s.additional, platform: process.platform };
});

ipcMain.handle('file:open', async (e) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const r = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: FILTERS });
  if (r.canceled || !r.filePaths[0]) return null;
  const p = r.filePaths[0];
  try {
    const f = readNotation(p);
    state.get(win.id).known.add(p);
    rememberFile(p);
    return f;
  } catch (err) {
    dialog.showErrorBox('Could not open file', String(err.message || err));
    return null;
  }
});

// A file dropped onto the window (path comes from webUtils in the preload)
ipcMain.handle('file:openPath', (e, p) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  if (!isNotationFile(p)) return { error: 'Only .cmnt and .txt notation files can be opened.' };
  try {
    const f = readNotation(p);
    state.get(win.id).known.add(p);
    rememberFile(p);
    return f;
  } catch (err) {
    return { error: String(err.message || err) };
  }
});

ipcMain.handle('file:save', async (e, opts) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const s = state.get(win.id);
  let p = opts && opts.path;
  // Only write to paths the user chose in a dialog or opened themselves.
  if (!p || opts.saveAs || !s.known.has(p)) {
    const base = (opts && opts.suggestedName ? opts.suggestedName : 'Untitled').replace(/[\\/:*?"<>|]+/g, '').trim() || 'Untitled';
    const dir = s.path ? path.dirname(s.path) : app.getPath('documents');
    const r = await dialog.showSaveDialog(win, {
      defaultPath: path.join(dir, p && opts.saveAs ? path.basename(p) : base + '.cmnt'),
      filters: FILTERS,
    });
    if (r.canceled || !r.filePath) return null;
    p = r.filePath;
  }
  try {
    fs.writeFileSync(p, String(opts.text || ''), 'utf8');
  } catch (err) {
    dialog.showErrorBox('Could not save file', String(err.message || err));
    return null;
  }
  s.known.add(p);
  rememberFile(p);
  return { path: p, name: path.basename(p) };
});

ipcMain.handle('pdf:export', async (e, opts) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const s = state.get(win.id);
  const base = ((opts && opts.suggestedName) || 'notation').replace(/[\\/:*?"<>|]+/g, '').trim() || 'notation';
  const dir = s.path ? path.dirname(s.path) : app.getPath('documents');
  const r = await dialog.showSaveDialog(win, {
    defaultPath: path.join(dir, base + '.pdf'),
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });
  if (r.canceled || !r.filePath) return null;
  try {
    const data = await win.webContents.printToPDF({ printBackground: true, preferCSSPageSize: true });
    fs.writeFileSync(r.filePath, data);
    return { path: r.filePath, name: path.basename(r.filePath) };
  } catch (err) {
    dialog.showErrorBox('Could not export PDF', String(err.message || err));
    return null;
  }
});

ipcMain.handle('print', (e) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  return new Promise((resolve) => {
    win.webContents.print({ printBackground: true }, (ok) => resolve(ok));
  });
});

ipcMain.handle('pdf:reveal', (e, p) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  if (win && state.get(win.id) && fs.existsSync(p) && path.extname(p).toLowerCase() === '.pdf') shell.showItemInFolder(p);
});

ipcMain.on('doc:state', (e, st) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const s = win && state.get(win.id);
  if (!s || !st) return;
  s.dirty = !!st.dirty;
  s.touched = s.touched || !!st.dirty || !!st.path;
  if (typeof st.path === 'string' && s.known.has(st.path)) s.path = st.path;
  else if (st.path === null) s.path = null;
  s.name = st.name || (s.path ? path.basename(s.path) : 'Untitled');
  if (!s.dirty) clearRecovery(win.id);
  updateTitle(win);
});

ipcMain.on('doc:draft', (e, text) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const s = win && state.get(win.id);
  if (!s || typeof text !== 'string') return;
  if (s.dirty) writeRecovery(win.id, { text, path: s.path, savedAt: Date.now() });
});

ipcMain.on('window:close', (e) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  if (!win) return;
  const s = state.get(win.id);
  if (s) s.forceClose = true;
  win.close();
});

ipcMain.on('window:new', () => createWindow({ additional: true }));

ipcMain.on('examples:set', (_e, list) => {
  if (!Array.isArray(list)) return;
  EXAMPLES = list.filter((x) => x && typeof x.id === 'string' && typeof x.title === 'string').slice(0, 50);
  buildMenu();
});

// ---- photo reader API key: encrypted with the OS keychain where available ---
const keyFile = () => path.join(app.getPath('userData'), 'api-key.bin');
ipcMain.handle('apikey:get', () => {
  try {
    const data = fs.readFileSync(keyFile());
    if (safeStorage.isEncryptionAvailable()) return safeStorage.decryptString(data);
    return data.toString('utf8');
  } catch (e) {
    return '';
  }
});
ipcMain.handle('apikey:set', (_e, key) => {
  try {
    if (!key) {
      fs.rmSync(keyFile(), { force: true });
      return true;
    }
    const k = String(key).slice(0, 500);
    fs.mkdirSync(path.dirname(keyFile()), { recursive: true });
    fs.writeFileSync(keyFile(), safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(k) : Buffer.from(k, 'utf8'), { mode: 0o600 });
    return true;
  } catch (e) {
    return false;
  }
});

// ---- menu ----------------------------------------------------------------------
function buildMenu() {
  const isMac = process.platform === 'darwin';
  const recent = settings.recent.filter((p) => fs.existsSync(p));
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'New Song…', accelerator: 'CmdOrCtrl+N', click: () => send('new') },
        { label: 'New Window', accelerator: 'CmdOrCtrl+Shift+N', click: () => createWindow({ additional: true }) },
        { type: 'separator' },
        { label: 'Open…', accelerator: 'CmdOrCtrl+O', click: () => send('open') },
        { label: 'Library…', accelerator: 'CmdOrCtrl+Shift+O', click: () => send('library') },
        {
          label: 'Open Recent',
          submenu: recent.length
            ? recent.map((p) => ({ label: path.basename(p) + '  —  ' + path.dirname(p), click: () => openFromSystem(p) }))
              .concat([{ type: 'separator' }, { label: 'Clear Menu', click: () => { settings.recent = []; saveSettings(); app.clearRecentDocuments(); buildMenu(); } }])
            : [{ label: 'No recent files', enabled: false }],
        },
        { type: 'separator' },
        { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => send('save') },
        { label: 'Save As…', accelerator: 'CmdOrCtrl+Shift+S', click: () => send('saveAs') },
        { type: 'separator' },
        { label: 'Export PDF…', accelerator: 'CmdOrCtrl+E', click: () => send('exportPdf') },
        { label: 'Print…', accelerator: 'CmdOrCtrl+P', click: () => send('print') },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit', label: 'Exit' },
      ],
    },
    { role: 'editMenu' },
    {
      label: 'Notation',
      submenu: [
        { label: 'Update', accelerator: 'CmdOrCtrl+Enter', click: () => send('update') },
        { label: 'Assist…', accelerator: 'CmdOrCtrl+I', click: () => send('assist') },
        { label: 'Align Lyrics', accelerator: 'CmdOrCtrl+L', click: () => send('align') },
        { label: 'Letters…', click: () => send('letters') },
        { label: 'Read from Photo…', accelerator: 'CmdOrCtrl+Shift+I', click: () => send('photo') },
        { type: 'separator' },
        {
          label: 'Examples',
          submenu: EXAMPLES.length ? EXAMPLES.map((ex) => ({ label: ex.title, click: () => send('example:' + ex.id) })) : [{ label: 'Loading…', enabled: false }],
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        ...(app.isPackaged ? [] : [{ type: 'separator' }, { role: 'reload' }, { role: 'toggleDevTools' }]),
      ],
    },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [
        { label: 'Manual', accelerator: 'F1', click: openManual },
        { label: 'About and Credits…', click: () => send('about') },
        { label: "Arun K's Original Typesetter (SourceForge)", click: () => shell.openExternal('https://sourceforge.net/projects/cmnt/') },
        ...(isMac ? [] : [{ type: 'separator' }, { role: 'about' }]),
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---- app lifecycle ----------------------------------------------------------
const pendingOpen = [];
const filesFromArgv = (argv) => argv.slice(app.isPackaged ? 1 : 2).filter((a) => !a.startsWith('-') && isNotationFile(a) && fs.existsSync(a)).map((a) => path.resolve(a));

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', (_e, argv) => {
    const files = filesFromArgv(argv);
    if (files.length) files.forEach(openFromSystem);
    else {
      const w = focusedOrFirst();
      if (w) {
        if (w.isMinimized()) w.restore();
        w.focus();
      } else createWindow();
    }
  });

  // macOS: double-clicked files arrive through this event (also before ready)
  app.on('open-file', (e, p) => {
    e.preventDefault();
    if (app.isReady()) openFromSystem(p);
    else pendingOpen.push(p);
  });

  app.whenReady().then(() => {
    loadSettings();
    app.setAboutPanelOptions({
      applicationName: PRODUCT,
      applicationVersion: app.getVersion(),
      copyright: 'Based on the Carnatic Music Notation Typesetter created by Arun K. Unofficial rebuild, not affiliated with or endorsed by Arun K. Free software under the GNU GPL v2.',
    });
    buildMenu();
    const files = pendingOpen.concat(filesFromArgv(process.argv));
    if (files.length) {
      createWindow({ file: files[0] });
      files.slice(1).forEach((f) => createWindow({ file: f, additional: true }));
    } else {
      createWindow();
    }
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    saveSettings();
    if (process.platform !== 'darwin') app.quit();
  });
  app.on('before-quit', saveSettings);
}
