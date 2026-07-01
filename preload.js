const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  readData:      (filename)       => ipcRenderer.invoke('read-data', filename),
  writeData:     (filename, data) => ipcRenderer.invoke('write-data', filename, data),
  getDataPath:   ()               => ipcRenderer.invoke('get-data-path'),
  getAppVersion: ()               => ipcRenderer.invoke('get-app-version'),
  installUpdate: ()               => ipcRenderer.send('install-update'),
  onUpdateAvailable: (cb)         => ipcRenderer.on('update-available',  (_e, v) => cb(v)),
  onUpdateProgress:  (cb)         => ipcRenderer.on('update-progress',   (_e, p) => cb(p)),
  onUpdateDownloaded:(cb)         => ipcRenderer.on('update-downloaded', () => cb()),
});
