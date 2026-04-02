'use strict';

const URLS = {
  chatgpt: 'https://chat.openai.com',
  claude:  'https://claude.ai',
  google:  'https://www.google.com',
  gemini:  'https://gemini.google.com',
};

const view  = document.getElementById('view');
const loader= document.getElementById('loader');
const brand = document.getElementById('brand');
const hint  = document.getElementById('hint-opacity');

// ── Typing buffer — managed via executeJavaScript from main ──────────────────
// main.js calls win.webContents.executeJavaScript('window.__gb += char; __gbUp()')
// This bypasses the broken main→renderer IPC and directly manipulates the DOM.
window.__gb = '';

window.__gbUp = function() {
  const txt   = document.getElementById('type-buf-text');
  const count = document.getElementById('type-char-count');
  if (txt)   txt.textContent   = window.__gb;
  if (count) count.textContent = window.__gb.length;
};

window.__gbSubmit = function() {
  const text = (window.__gb || '').trim();
  window.__gb = '';
  window.__gbUp();
  if (!text) return;
  document.getElementById('brand').textContent = '⏳ Sending...';
  window.api.submitText(text);
};

// ── Site nav ──────────────────────────────────────────────────────────────────
function load(site) {
  if (!URLS[site]) return;
  document.querySelectorAll('.tab').forEach(t =>
    t.classList.toggle('on', t.dataset.site === site));
  loader.classList.remove('gone');
  view.src = URLS[site];
}
function reload() { loader.classList.remove('gone'); view.reload(); }

document.querySelectorAll('.tab').forEach(t =>
  t.addEventListener('click', () => load(t.dataset.site)));

document.getElementById('btn-type').addEventListener('click', () => window.api.toggleFocusMode());
document.getElementById('btn-clip').addEventListener('click', () => window.api.sendClipboard());
document.getElementById('btn-hide').addEventListener('click', () => window.api.hide());
document.getElementById('btn-quit').addEventListener('click', () => window.api.quit());

function fixSize() {
  const b = document.getElementById('browser');
  view.style.width  = b.offsetWidth  + 'px';
  view.style.height = b.offsetHeight + 'px';
}
view.addEventListener('did-start-loading', () => { fixSize(); loader.classList.remove('gone'); });
view.addEventListener('did-stop-loading',  () => { fixSize(); loader.classList.add('gone'); });
window.addEventListener('resize', fixSize);
setTimeout(fixSize, 500);
view.addEventListener('did-fail-load', e => { if (e.errorCode !== -3) loader.classList.add('gone'); });

// ── IPC from main ─────────────────────────────────────────────────────────────
window.api.onLoad(site => load(site));
window.api.onReload(() => reload());
window.api.onOpacity(v => { hint.textContent = v + '%'; });
window.api.onHookStatus(msg => {
  const el = document.getElementById('hint-status');
  if (el) el.textContent = msg;
});
window.api.onFocusMode(active => {
  const overlay = document.getElementById('type-overlay');
  document.getElementById('drag-bar').classList.toggle('type-mode', active);
  brand.textContent = active ? '⌨️ TYPE MODE' : '👻 GhostPilot';
  document.getElementById('btn-type').style.color = active ? '#86efac' : '';
  if (overlay) overlay.classList.toggle('active', active);
  if (!active) { window.__gb = ''; window.__gbUp(); }
});
window.api.onSubmitting(active => {
  if (!active) {
    const inType = document.getElementById('drag-bar').classList.contains('type-mode');
    brand.textContent = inType ? '⌨️ TYPE MODE' : '👻 GhostPilot';
  }
});
window.api.onTypeChar(ch => {
  // fallback if IPC ever works
  if (ch === '\b')    { window.__gb = window.__gb.slice(0,-1); }
  else if (ch === '\r'){ window.__gbSubmit(); return; }
  else if (ch === '\x1b'){ window.__gb = ''; }
  else { window.__gb += ch; }
  window.__gbUp();
});

document.addEventListener('keydown', e => {
  if (!e.ctrlKey || !e.altKey) return;
  const map = {
    G: ()=>window.api.hide(), H: ()=>window.api.hide(),
    V: ()=>window.api.sendClipboard(), F: ()=>window.api.toggleFocusMode(),
    1: ()=>load('chatgpt'), 2: ()=>load('claude'),
    3: ()=>load('google'),  4: ()=>load('gemini'),
    R: reload,
  };
  if (map[e.key]) { map[e.key](); e.preventDefault(); }
});
