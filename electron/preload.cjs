const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('classDesk', {
  saveFile: (payload) => ipcRenderer.invoke('save-file', payload),
});
