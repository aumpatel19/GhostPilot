const { app, BrowserWindow, globalShortcut, Tray, Menu, nativeImage, ipcMain, screen } = require('electron');
const path = require('path');

app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu-sandbox');

// Unique userData path avoids stale lock from previous crashed instances
app.setPath('userData', path.join(app.getPath('appData'), 'GhostPilot-v2'));

let win = null;
let tray = null;
let visible = true;
let opacity = 0.92;
let focusMode = false;

const SITES = {
  chatgpt: 'https://chat.openai.com',
  claude:  'https://claude.ai',
  google:  'https://www.google.com',
  gemini:  'https://gemini.google.com',
};

// ── Single instance ──────────────────────────────────────────────────────────

// ── Tray icon (purple ghost) ─────────────────────────────────────────────────
function makeTrayIcon() {
  const S = 32, buf = Buffer.alloc(S * S * 4, 0);
  const px = (x, y, r, g, b) => {
    if (x < 0 || x >= S || y < 0 || y >= S) return;
    const i = (y * S + x) * 4;
    buf[i] = r; buf[i+1] = g; buf[i+2] = b; buf[i+3] = 255;
  };
  const circle = (cx, cy, r) => {
    for (let y = cy-r; y <= cy+r; y++)
      for (let x = cx-r; x <= cx+r; x++)
        if ((x-cx)**2+(y-cy)**2 <= r*r) px(x, y, 200, 200, 200);
  };
  circle(16, 12, 9);
  for (let y = 12; y <= 24; y++) for (let x = 7; x <= 25; x++) px(x, y, 200, 200, 200);
  circle(10, 25, 3); circle(16, 25, 3); circle(22, 25, 3);
  return nativeImage.createFromBuffer(buf, { width: S, height: S });
}

// ── Window ───────────────────────────────────────────────────────────────────
function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  const W = 460, H = 700;
  win = new BrowserWindow({
    width: W,
    height: H,
    x: Math.max(0, width - W - 20),
    y: Math.max(0, Math.round((height - H) / 2)),
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    roundedCorners: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
    },
  });

  win.setContentProtection(true);          // invisible to screen share
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setOpacity(opacity);
  win.setFocusable(false);                 // non-activating: clicks won't steal focus
  win.loadFile(path.join(__dirname, 'src', 'index.html'));

  // Auto-revert to non-activating when window loses focus
  win.on('blur', () => {
    if (focusMode) {
      focusMode = false;
      win.setFocusable(false);
      send('focus-mode', false);
    }
  });

  // Handle Google OAuth popups — open in a real BrowserWindow so Google allows sign-in
  win.webContents.on('did-attach-webview', (_, wc) => {
    wc.setWindowOpenHandler(({ url }) => {
      if (url.includes('accounts.google.com') || url.includes('google.com/o/oauth2')) {
        openAuthPopup(url);
        return { action: 'deny' };
      }
      return { action: 'allow' };
    });

    wc.on('will-navigate', (e, url) => {
      if (url.includes('accounts.google.com') || url.includes('google.com/o/oauth2')) {
        e.preventDefault();
        openAuthPopup(url);
      }
    });
  });

  win.on('closed', () => { win = null; });
}

// ── Google OAuth popup ────────────────────────────────────────────────────────
function openAuthPopup(url) {
  const popup = new BrowserWindow({
    width: 500,
    height: 650,
    title: 'Sign in',
    alwaysOnTop: true,
    webPreferences: {
      partition: 'persist:ghost',   // same cookies as webview
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  popup.loadURL(url);
  popup.once('closed', () => {
    // Reload the main webview after login so it picks up the new session
    if (win && !win.isDestroyed()) send('reload', null);
  });
}

// ── Tray ─────────────────────────────────────────────────────────────────────
function createTray() {
  tray = new Tray(makeTrayIcon());
  tray.setToolTip('GhostPilot — Ctrl+Alt+G to toggle');
  tray.on('click', toggle);
  refreshTrayMenu();
}

function refreshTrayMenu() {
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '👻  GhostPilot', enabled: false },
    { label: '🔒  Screen capture: hidden', enabled: false },
    { type: 'separator' },
    { label: visible ? '🙈  Hide (Ctrl+Alt+G)' : '👁  Show (Ctrl+Alt+G)', click: toggle },
    { type: 'separator' },
    { label: '🤖  ChatGPT  ·  Ctrl+Alt+1', click: () => send('load', 'chatgpt') },
    { label: '🧠  Claude   ·  Ctrl+Alt+2', click: () => send('load', 'claude')  },
    { label: '🔍  Google   ·  Ctrl+Alt+3', click: () => send('load', 'google')  },
    { label: '✨  Gemini   ·  Ctrl+Alt+4', click: () => send('load', 'gemini')  },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]));
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function send(ch, data) { if (win && !win.isDestroyed()) win.webContents.send(ch, data); }

function toggle() {
  if (!win) return;
  if (visible) { win.hide(); visible = false; }
  else         { win.show(); visible = true;  }
  refreshTrayMenu();
}

function setOpacity(delta) {
  opacity = Math.min(1, Math.max(0.15, opacity + delta));
  if (win) win.setOpacity(opacity);
  send('opacity', Math.round(opacity * 100));
}

function toggleFocusMode() {
  if (!win) return;
  focusMode = !focusMode;
  win.setFocusable(focusMode);
  if (focusMode) win.focus();  // bring focus so keyboard works immediately
  send('focus-mode', focusMode);
}

// ── Hotkeys ───────────────────────────────────────────────────────────────────
function registerHotkeys() {
  const keys = [
    ['Ctrl+Alt+G',    toggle],
    ['Ctrl+Alt+H',    () => { if (win) { win.hide(); visible = false; refreshTrayMenu(); } }],
    ['Ctrl+Alt+1',    () => send('load', 'chatgpt')],
    ['Ctrl+Alt+2',    () => send('load', 'claude')],
    ['Ctrl+Alt+3',    () => send('load', 'google')],
    ['Ctrl+Alt+4',    () => send('load', 'gemini')],
    ['Ctrl+Alt+R',    () => send('reload', null)],
    ['Ctrl+Alt+Equal',  () => setOpacity(+0.05)],
    ['Ctrl+Alt+Minus',  () => setOpacity(-0.05)],
    ['Ctrl+Alt+F',      toggleFocusMode],
  ];
  const failed = [];
  for (const [k, fn] of keys) {
    if (!globalShortcut.register(k, fn)) failed.push(k);
  }
  if (failed.length) console.warn('Failed hotkeys:', failed.join(', '));
}

// ── IPC ───────────────────────────────────────────────────────────────────────
ipcMain.on('hide',              () => { if (win) { win.hide(); visible = false; refreshTrayMenu(); } });
ipcMain.on('quit',              () => app.quit());
ipcMain.on('load',              (_, site) => send('load', site));
ipcMain.on('toggle-focus-mode', toggleFocusMode);

// ── Boot ──────────────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();
  createTray();
  registerHotkeys();
});

app.on('window-all-closed', () => { /* keep alive in tray */ });
app.on('before-quit', () => { globalShortcut.unregisterAll(); tray?.destroy(); });
