const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('api', {
  hide:            ()     => ipcRenderer.send('hide'),
  quit:            ()     => ipcRenderer.send('quit'),
  sendClipboard:   ()     => ipcRenderer.send('send-clipboard'),
  toggleFocusMode: ()     => ipcRenderer.send('toggle-focus-mode'),
  submitText:      (text) => ipcRenderer.send('submit-text', text),
  onLoad:          (cb)   => ipcRenderer.on('load',        (_, s) => cb(s)),
  onReload:        (cb)   => ipcRenderer.on('reload',      ()     => cb()),
  onOpacity:       (cb)   => ipcRenderer.on('opacity',     (_, v) => cb(v)),
  onSubmitting:    (cb)   => ipcRenderer.on('submitting',  (_, v) => cb(v)),
  onFocusMode:     (cb)   => ipcRenderer.on('focus-mode',  (_, v) => cb(v)),
  onHookStatus:    (cb)   => ipcRenderer.on('hook-status', (_, v) => cb(v)),
  onTypeChar:      (cb)   => ipcRenderer.on('type-char',   (_, c) => cb(c)),
});
