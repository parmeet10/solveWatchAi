// Preload script for Electron
// This runs in the renderer process before the page loads

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  sendKeydown: (key) => ipcRenderer.send('keydown', key),
});
