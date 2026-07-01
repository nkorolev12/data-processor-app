const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  readData:    (filename)       => ipcRenderer.invoke('read-data', filename),
  writeData:   (filename, data) => ipcRenderer.invoke('write-data', filename, data),
  getDataPath: ()               => ipcRenderer.invoke('get-data-path'),
  getAppVersion: ()             => ipcRenderer.invoke('get-app-version')
});
