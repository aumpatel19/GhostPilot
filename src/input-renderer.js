'use strict';

// Every keydown in this 1×1 capture window gets forwarded to main process
// which injects it into the AI webview via executeJavaScript.
// Ctrl+Alt+F exits type mode.
document.addEventListener('keydown', (e) => {
  // Let Ctrl+Alt combos through to globalShortcut (for Ctrl+Alt+F to toggle off, etc.)
  if (e.ctrlKey && e.altKey) return;

  e.preventDefault();
  e.stopPropagation();

  window.inputApi.sendKey({
    key:     e.key,
    code:    e.code,
    keyCode: e.keyCode,
    shift:   e.shiftKey,
    ctrl:    e.ctrlKey,
    alt:     e.altKey,
  });
});

// When main tells us to exit, do nothing (main handles the state).
window.inputApi.onExit(() => {});
