const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  dbQuery: (sql, params) => ipcRenderer.invoke('db:query', sql, params),
  printRaw: (printerName, hexData) => ipcRenderer.invoke('print:raw', printerName, hexData),
  saveImage: (sourcePath, fileName) => ipcRenderer.invoke('file:saveProductImage', sourcePath, fileName),
  readImage: (filePath) => ipcRenderer.invoke('file:readImage', filePath),
  getPrinters: () => ipcRenderer.invoke('print:get-printers'),
  printSilent: (printerName) => ipcRenderer.invoke('print:silent', printerName)
});
