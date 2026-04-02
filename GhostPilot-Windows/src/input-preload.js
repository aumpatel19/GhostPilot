const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('inputApi', {
  sendKey: (data) => ipcRenderer.send('input-key', data),
  onExit:  (cb)   => ipcRenderer.on('exit-type-mode', cb),
});
