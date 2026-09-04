const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  dbQuery: (sql, params) => ipcRenderer.invoke('db:query', sql, params),
  printRaw: (printerName, hexData) => ipcRenderer.invoke('print:raw', printerName, hexData),
  saveImage: (sourcePath, fileName) => ipcRenderer.invoke('file:saveProductImage', sourcePath, fileName),
  readImage: (filePath) => ipcRenderer.invoke('file:readImage', filePath),
  getPrinters: () => ipcRenderer.invoke('print:get-printers'),
  printSilent: (printerName) => ipcRenderer.invoke('print:silent', printerName),
  printTicketRaw: (data, printerName) => ipcRenderer.invoke('print:ticket-raw', data, printerName),
  openWhatsApp: (phone, message) => ipcRenderer.invoke('system:open-whatsapp', phone, message),
  backupDatabase: () => ipcRenderer.invoke('system:backup-db'),
  
  // Auto-Updater API
  checkForUpdates: () => ipcRenderer.invoke('updater:check'),
  quitAndInstall: () => ipcRenderer.invoke('updater:install'),
  onUpdaterStatus: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('updater:status', handler);
    return () => ipcRenderer.removeListener('updater:status', handler);
  },
  getAppVersion: () => ipcRenderer.invoke('app:version'),

  // Remote License & Subscription API
  checkRemoteLicense: (licenseKey, remoteUrl) => ipcRenderer.invoke('license:check', licenseKey, remoteUrl)
});
