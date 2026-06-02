const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  dbQuery: (sql, params) => ipcRenderer.invoke('db:query', sql, params),
  printRaw: (printerName, hexData) => ipcRenderer.invoke('print:raw', printerName, hexData),
  saveImage: (sourcePath, fileName) => ipcRenderer.invoke('file:saveProductImage', sourcePath, fileName),
  printSilent: () => ipcRenderer.invoke('print:silent')
});
