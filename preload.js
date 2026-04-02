const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('api', {
  hide:   ()       => ipcRenderer.send('hide'),
  quit:   ()       => ipcRenderer.send('quit'),
  onLoad: (cb)     => ipcRenderer.on('load',    (_, s) => cb(s)),
  onReload:(cb)    => ipcRenderer.on('reload',  ()     => cb()),
  onOpacity:(cb)    => ipcRenderer.on('opacity',    (_, v) => cb(v)),
  onFocusMode:(cb)       => ipcRenderer.on('focus-mode', (_, v) => cb(v)),
  toggleFocusMode:()     => ipcRenderer.send('toggle-focus-mode'),
});
