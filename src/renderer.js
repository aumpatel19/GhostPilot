'use strict';

const URLS = {
  chatgpt: 'https://chat.openai.com',
  claude:  'https://claude.ai',
  google:  'https://www.google.com',
  gemini:  'https://gemini.google.com',
};

const view    = document.getElementById('view');
const loader  = document.getElementById('loader');
const hint    = document.getElementById('hint-opacity');
let current   = 'chatgpt';

// ── Switch site ──────────────────────────────────────────────────────────────
function load(site) {
  if (!URLS[site]) return;
  current = site;
  document.querySelectorAll('.tab').forEach(t =>
    t.classList.toggle('on', t.dataset.site === site));
  loader.classList.remove('gone');
  view.src = URLS[site];
}

function reload() {
  loader.classList.remove('gone');
  view.reload();
}

// ── Tab clicks ───────────────────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(t =>
  t.addEventListener('click', () => load(t.dataset.site)));

// ── Window buttons ───────────────────────────────────────────────────────────
document.getElementById('btn-hide').addEventListener('click', () => window.api.hide());
document.getElementById('btn-quit').addEventListener('click', () => window.api.quit());

// ── Webview events ───────────────────────────────────────────────────────────
function fixSize() {
  const b = document.getElementById('browser');
  view.style.width  = b.offsetWidth  + 'px';
  view.style.height = b.offsetHeight + 'px';
}

view.addEventListener('did-start-loading', () => { fixSize(); loader.classList.remove('gone'); });
view.addEventListener('did-stop-loading',  () => { fixSize(); loader.classList.add('gone'); });
window.addEventListener('resize', fixSize);
setTimeout(fixSize, 500);
view.addEventListener('did-fail-load', e  => { if (e.errorCode !== -3) loader.classList.add('gone'); });
view.addEventListener('new-window',    e  => { view.src = e.url; });

// ── IPC from main ────────────────────────────────────────────────────────────
window.api.onLoad(site => load(site));
window.api.onReload(() => reload());
window.api.onOpacity(v => { hint.textContent = v + '%'; });

// ── Local shortcuts (when window focused) ────────────────────────────────────
document.addEventListener('keydown', e => {
  if (!e.ctrlKey || !e.altKey) return;
  const map = { G: () => window.api.hide(), H: () => window.api.hide(),
                1: () => load('chatgpt'), 2: () => load('claude'),
                3: () => load('google'),  4: () => load('gemini'),
                R: reload };
  if (map[e.key]) { map[e.key](); e.preventDefault(); }
});
