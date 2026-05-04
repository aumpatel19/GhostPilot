const { app, BrowserWindow, globalShortcut, Tray, Menu, nativeImage,
        ipcMain, screen, clipboard } = require('electron');
const path    = require('path');
const { spawn } = require('child_process');
const readline  = require('readline');

app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.setPath('userData', path.join(app.getPath('appData'), 'GhostPilot-v2'));

let win       = null;
let tray      = null;
let visible   = true;
let opacity   = 0.92;
let typeMode  = false;
let hookReady = false;
let webviewWC = null;
let hookProc  = null;

const SITES = {
  chatgpt: 'https://chat.openai.com',
  claude:  'https://claude.ai',
  google:  'https://www.google.com',
  gemini:  'https://gemini.google.com',
};

// ── VK → character map ────────────────────────────────────────────────────────
const VK_CHAR = (() => {
  const m = {};
  for (let i = 0x41; i <= 0x5A; i++) {
    const u = String.fromCharCode(i);
    m[i] = { n: u.toLowerCase(), s: u };
  }
  const ds = ')!@#$%^&*(';
  for (let i = 0x30; i <= 0x39; i++) {
    m[i] = { n: String.fromCharCode(i), s: ds[i - 0x30] };
  }
  Object.assign(m, {
    0x20: { n: ' ',  s: ' '  },
    0x09: { n: '\t', s: '\t' },
    0xBC: { n: ',',  s: '<'  },
    0xBE: { n: '.',  s: '>'  },
    0xBF: { n: '/',  s: '?'  },
    0xBA: { n: ';',  s: ':'  },
    0xDE: { n: "'",  s: '"'  },
    0xDB: { n: '[',  s: '{'  },
    0xDD: { n: ']',  s: '}'  },
    0xDC: { n: '\\', s: '|'  },
    0xBD: { n: '-',  s: '_'  },
    0xBB: { n: '=',  s: '+'  },
    0xC0: { n: '`',  s: '~'  },
  });
  return m;
})();

// ── Submit text to the AI chat webview ────────────────────────────────────────
// Works by filling the AI input and clicking Send.
// Uses beforeinput + fallback approaches. Called from buffer flush (Enter key)
// or from direct clipboard submit.
function submitTextToAI(text) {
  if (!webviewWC || webviewWC.isDestroyed() || !text.trim()) return;
  send('submitting', true);
  webviewWC.executeJavaScript(`
    (function(){
      var text = ${JSON.stringify(text)};

      var el = document.querySelector('#prompt-textarea') ||
               document.querySelector('div[contenteditable="true"][class*="ProseMirror"]') ||
               document.querySelector('div[contenteditable="true"]') ||
               document.querySelector('textarea:not([aria-hidden="true"])');

      if (!el) return false;

      if (el.isContentEditable) {
        // Clear existing content
        el.innerHTML = '';
        // Method 1: beforeinput with full text (Lexical / ProseMirror)
        el.dispatchEvent(new InputEvent('beforeinput', {
          bubbles: true, cancelable: true, composed: true,
          inputType: 'insertText', data: text
        }));
        // Method 2: execCommand (works if focus was maintained)
        if (!el.textContent || el.textContent.trim() === '') {
          document.execCommand('insertText', false, text);
        }
        // Method 3: direct textContent (last resort)
        if (!el.textContent || el.textContent.trim() === '') {
          el.textContent = text;
          el.dispatchEvent(new InputEvent('input', {
            bubbles: true, inputType: 'insertText', data: text
          }));
        }
      } else {
        var ns = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
        ns.call(el, text);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }

      // Click Send button after a short delay
      setTimeout(function() {
        var btn = document.querySelector('button[data-testid="send-button"]') ||
                  document.querySelector('button[aria-label*="Send"]') ||
                  document.querySelector('button[aria-label*="send"]');
        if (btn && !btn.disabled) btn.click();
      }, 300);

      return true;
    })()
  `).then(() => { setTimeout(() => send('submitting', false), 1500); })
    .catch(() => send('submitting', false));
}

// ── Handle a key from the PS hook ─────────────────────────────────────────────
// executeJavaScript on win.webContents works without OS focus (proven by
// initTypeMode returning 'INPUT OK'). Directly manipulates DOM — no IPC needed.
function handleKey(vk, mods) {
  if (!win || win.isDestroyed()) return;
  const shifted = mods.includes('S');

  let js;
  if (vk === 0x08) {  // Backspace
    js = `window.__gb = (window.__gb||'').slice(0,-1); __gbUp();`;
  } else if (vk === 0x0D) {  // Enter → submit
    js = `__gbSubmit();`;
  } else if (vk === 0x1B) {  // Escape → clear
    js = `window.__gb = ''; __gbUp();`;
  } else {
    const charMap = VK_CHAR[vk];
    if (!charMap) return;
    const raw = shifted ? charMap.s : charMap.n;
    js = `window.__gb = (window.__gb||'') + ${JSON.stringify(raw)}; __gbUp();`;
  }

  win.webContents.executeJavaScript(js).catch(() => {});
}


// ── PowerShell keyboard hook ──────────────────────────────────────────────────
let keyCount = 0;
function startHook() {
  const script = path.join(__dirname, 'keyboard-hook.ps1');
  hookProc = spawn('powershell.exe', [
    '-ExecutionPolicy', 'Bypass',
    '-NonInteractive',
    '-WindowStyle', 'Hidden',
    '-File', script,
  ], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });

  readline.createInterface({ input: hookProc.stdout }).on('line', line => {
    line = line.trim();
    if (line === 'READY') {
      hookReady = true;
      send('hook-status', 'HOOK:READY ✓');
      console.log('[hook] READY');
      if (typeMode) sendToHook('CAPTURE:1');
    } else if (line.startsWith('KEY:')) {
      keyCount++;
      send('hook-status', 'K:' + keyCount);
      const parts = line.split(':');
      handleKey(parseInt(parts[1]), parts[2] || '');
    }
  });

  hookProc.stderr.on('data', d => {
    const msg = d.toString().trim().slice(0, 80);
    console.error('[hook err]', msg);
    send('hook-status', 'ERR:' + msg.slice(0, 40));
  });

  hookProc.on('exit', code => {
    console.log('[hook] exited', code);
    hookProc = null; hookReady = false;
    send('hook-status', 'HOOK:DEAD(' + code + ')');
  });
}

function sendToHook(cmd) {
  if (hookProc && hookReady) {
    try { hookProc.stdin.write(cmd + '\n'); } catch(_){}
  }
}

function stopHook() {
  if (hookProc) {
    try { hookProc.stdin.write('STOP\n'); } catch(_){}
    setTimeout(() => { if (hookProc) hookProc.kill(); }, 1000);
  }
}

// Debug: inject TEST directly via executeJavaScript (bypasses IPC completely)
function testTypeBuffer() {
  if (!typeMode) toggleTypeMode();
  win.webContents.executeJavaScript(`
    window.__gb = 'TEST';
    __gbUp();
  `).catch(e => console.error('test exec err:', e));
}

// ── Type mode ─────────────────────────────────────────────────────────────────
function toggleTypeMode() {
  typeMode = !typeMode;
  sendToHook(typeMode ? 'CAPTURE:1' : 'CAPTURE:0');
  send('focus-mode', typeMode);
  // Also show/hide overlay via executeJavaScript in case IPC is unreliable
  const overlayJs = typeMode
    ? `document.getElementById('type-overlay').classList.add('active');
       document.getElementById('brand').textContent = '⌨️ TYPE MODE';`
    : `document.getElementById('type-overlay').classList.remove('active');
       document.getElementById('brand').textContent = '👻 GhostPilot';
       window.__gb = ''; __gbUp();`;
  win.webContents.executeJavaScript(overlayJs).catch(() => {});
}


// ── Clipboard submit ──────────────────────────────────────────────────────────
function submitClipboard() {
  const img = clipboard.readImage();
  if (!img.isEmpty()) {
    submitImageToAI();
    return;
  }
  const text = clipboard.readText().trim();
  if (text) submitTextToAI(text);
}

function submitImageToAI() {
  if (!webviewWC || webviewWC.isDestroyed()) return;
  send('submitting', true);
  win.webContents.executeJavaScript(
    `document.getElementById('brand').textContent = '📸 Pasting screenshot...';`
  ).catch(() => {});

  // Focus the AI input field first
  webviewWC.executeJavaScript(`
    (function() {
      var el = document.querySelector('#prompt-textarea') ||
               document.querySelector('div[contenteditable="true"][class*="ProseMirror"]') ||
               document.querySelector('div[contenteditable="true"]') ||
               document.querySelector('textarea:not([aria-hidden="true"])');
      if (el) { el.focus(); el.click(); return true; }
      return false;
    })()
  `).then(() => {
    setTimeout(() => {
      // Send a real Ctrl+V into the webview — pastes the image from clipboard
      webviewWC.sendInputEvent({ type: 'keyDown', modifiers: ['ctrl'], keyCode: 'V' });
      setTimeout(() => {
        webviewWC.sendInputEvent({ type: 'keyUp', modifiers: ['ctrl'], keyCode: 'V' });
        setTimeout(() => send('submitting', false), 1500);
      }, 100);
    }, 300);
  }).catch(() => send('submitting', false));
}

// ── Tray icon ─────────────────────────────────────────────────────────────────
function makeTrayIcon() {
  const S = 32, buf = Buffer.alloc(S * S * 4, 0);
  const px = (x,y,r,g,b) => {
    if(x<0||x>=S||y<0||y>=S) return;
    const i=(y*S+x)*4; buf[i]=r;buf[i+1]=g;buf[i+2]=b;buf[i+3]=255;
  };
  const circle=(cx,cy,r)=>{
    for(let y=cy-r;y<=cy+r;y++) for(let x=cx-r;x<=cx+r;x++)
      if((x-cx)**2+(y-cy)**2<=r*r) px(x,y,200,200,200);
  };
  circle(16,12,9);
  for(let y=12;y<=24;y++) for(let x=7;x<=25;x++) px(x,y,200,200,200);
  circle(10,25,3); circle(16,25,3); circle(22,25,3);
  return nativeImage.createFromBuffer(buf,{width:S,height:S});
}

// ── Main window ───────────────────────────────────────────────────────────────
function createWindow() {
  const {width,height} = screen.getPrimaryDisplay().workAreaSize;
  const W=460, H=700;
  win = new BrowserWindow({
    width:W, height:H,
    x:Math.max(0,width-W-20), y:Math.max(0,Math.round((height-H)/2)),
    frame:false, transparent:true,
    alwaysOnTop:true, skipTaskbar:true,
    resizable:true, roundedCorners:true,
    backgroundColor:'#00000000',
    webPreferences:{
      preload:path.join(__dirname,'preload.js'),
      contextIsolation:true, nodeIntegration:false, webviewTag:true,
    },
  });
  win.setContentProtection(true);
  win.setAlwaysOnTop(true,'screen-saver');
  win.setOpacity(opacity);
  win.setFocusable(false);

  win.loadFile(path.join(__dirname,'src','index.html'));

  win.webContents.on('did-attach-webview',(_,wc)=>{
    webviewWC = wc;
    wc.setWindowOpenHandler(({url})=>{
      if(url.includes('accounts.google.com')||url.includes('google.com/o/oauth2')){
        openAuthPopup(url); return {action:'deny'};
      }
      return {action:'allow'};
    });
    wc.on('will-navigate',(e,url)=>{
      if(url.includes('accounts.google.com')||url.includes('google.com/o/oauth2')){
        e.preventDefault(); openAuthPopup(url);
      }
    });
  });

  win.on('closed',()=>{win=null;});
}

function openAuthPopup(url) {
  const popup = new BrowserWindow({
    width:500,height:650,title:'Sign in',alwaysOnTop:true,
    webPreferences:{partition:'persist:ghost',contextIsolation:true,nodeIntegration:false},
  });
  popup.loadURL(url);
  popup.once('closed',()=>{ if(win&&!win.isDestroyed()) send('reload',null); });
}

// ── Tray ──────────────────────────────────────────────────────────────────────
function createTray() {
  tray = new Tray(makeTrayIcon());
  tray.setToolTip('GhostPilot — Ctrl+Alt+G');
  tray.on('click',toggle);
  refreshTrayMenu();
}

function refreshTrayMenu() {
  tray.setContextMenu(Menu.buildFromTemplate([
    {label:'👻  GhostPilot',            enabled:false},
    {label:'🔒  Screen capture: hidden', enabled:false},
    {type:'separator'},
    {label:visible?'🙈  Hide (Ctrl+Alt+G)':'👁  Show (Ctrl+Alt+G)',click:toggle},
    {type:'separator'},
    {label:'🤖  ChatGPT  ·  Ctrl+Alt+1',click:()=>send('load','chatgpt')},
    {label:'🧠  Claude   ·  Ctrl+Alt+2',click:()=>send('load','claude')},
    {label:'🔍  Google   ·  Ctrl+Alt+3',click:()=>send('load','google')},
    {label:'✨  Gemini   ·  Ctrl+Alt+4',click:()=>send('load','gemini')},
    {type:'separator'},
    {label:'📋  Send clipboard  ·  Ctrl+Alt+V',click:submitClipboard},
    {label:'⌨️  Type mode  ·  Ctrl+Alt+F',      click:toggleTypeMode},
    {type:'separator'},
    {label:'Quit',click:()=>app.quit()},
  ]));
}

function send(ch,data){if(win&&!win.isDestroyed()) win.webContents.send(ch,data);}

function toggle(){
  if(!win) return;
  if(visible){win.hide();visible=false;}
  else{win.show();visible=true;}
  refreshTrayMenu();
}

function setOpacity(delta){
  opacity=Math.min(1,Math.max(0.15,opacity+delta));
  if(win) win.setOpacity(opacity);
  send('opacity',Math.round(opacity*100));
}

// ── Hotkeys ───────────────────────────────────────────────────────────────────
function registerHotkeys(){
  const keys=[
    ['Ctrl+Alt+G',     toggle],
    ['Ctrl+Alt+H',     ()=>{if(win){win.hide();visible=false;refreshTrayMenu();}}],
    ['Ctrl+Alt+V',     submitClipboard],
    ['Ctrl+Alt+F',     toggleTypeMode],
    ['Ctrl+Alt+T',     testTypeBuffer],
    ['Ctrl+Alt+1',     ()=>send('load','chatgpt')],
    ['Ctrl+Alt+2',     ()=>send('load','claude')],
    ['Ctrl+Alt+3',     ()=>send('load','google')],
    ['Ctrl+Alt+4',     ()=>send('load','gemini')],
    ['Ctrl+Alt+R',     ()=>send('reload',null)],
  ];
  for(const [k,fn] of keys){
    try { if(!globalShortcut.register(k,fn)) console.warn('Hotkey failed:', k); }
    catch(e){ console.warn('Hotkey error:', k, e.message); }
  }
}


// ── IPC ───────────────────────────────────────────────────────────────────────
ipcMain.on('hide',            ()=>{if(win){win.hide();visible=false;refreshTrayMenu();}});
ipcMain.on('quit',            ()=>app.quit());
ipcMain.on('load',            (_,site)=>send('load',site));
ipcMain.on('send-clipboard',  ()=>submitClipboard());
ipcMain.on('toggle-focus-mode',()=>toggleTypeMode());
// Called from renderer when user presses Enter in the type buffer
ipcMain.on('submit-text',     (_,text)=>submitTextToAI(text));

// ── Boot ──────────────────────────────────────────────────────────────────────
app.whenReady().then(()=>{
  Menu.setApplicationMenu(null);
  createWindow();
  createTray();
  registerHotkeys();
  startHook();
});

app.on('window-all-closed',()=>{});
app.on('before-quit',()=>{
  globalShortcut.unregisterAll();
  stopHook();
  tray?.destroy();
});
