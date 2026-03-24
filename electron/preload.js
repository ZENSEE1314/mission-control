/**
 * Electron Preload — exposes a safe bridge between renderer and main process
 */
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getVersion:   ()      => ipcRenderer.invoke('get-version'),
  openExternal: (url)   => ipcRenderer.invoke('open-external', url),
  platform:     process.platform,
});
