const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('desk', {
  hide: () => ipcRenderer.send('hide'),
  show: () => ipcRenderer.send('show'),
  resize: (h) => ipcRenderer.send('resize', h),
  status: (s) => ipcRenderer.send('status', s),
  hotkey: () => ipcRenderer.invoke('hotkey'),
  onAsk: (fn) => ipcRenderer.on('ask', fn),
  onWelcome: (fn) => ipcRenderer.on('welcome', fn),
})
