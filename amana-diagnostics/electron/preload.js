const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isDesktop: () => true,
  getLocalIPs: () => ipcRenderer.invoke('get-local-ips'),
  getUpdateStatus: (callback) => {
    ipcRenderer.on('update-status', (event, status) => callback(status));
  },
  checkForUpdates: () => ipcRenderer.send('check-for-updates'),
  restartAndInstall: () => ipcRenderer.send('restart-and-install')
});
