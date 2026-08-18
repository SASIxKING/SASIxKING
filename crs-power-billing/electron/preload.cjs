/**
 * Minimal, explicit bridge between the Electron main process and the React app.
 * Only these four capabilities are exposed — the renderer never gets Node.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  /** Ask the main process to write a backup file via a native save dialog. */
  saveBackup: (json) => ipcRenderer.invoke('save-backup', json),

  /** Version / platform / where data lives, for the About + Backup screens. */
  appInfo: () => ipcRenderer.invoke('app-info'),

  /** Menu-driven navigation (File ▸ New Invoice, Go ▸ ...). */
  onNavigate: (callback) => {
    const handler = (_event, route) => callback(route);
    ipcRenderer.on('navigate', handler);
    return () => ipcRenderer.removeListener('navigate', handler);
  },

  /** Menu-driven backup / restore. */
  onRequestBackup: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('request-backup', handler);
    return () => ipcRenderer.removeListener('request-backup', handler);
  },

  onRestoreBackup: (callback) => {
    const handler = (_event, contents) => callback(contents);
    ipcRenderer.on('restore-backup', handler);
    return () => ipcRenderer.removeListener('restore-backup', handler);
  },
});
