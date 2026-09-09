import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('clipforge', {
  platform: process.platform,
  selectOutputDirectory: (): Promise<string | null> =>
    ipcRenderer.invoke('storage:choose-output-directory'),
  selectVideoFile: () => ipcRenderer.invoke('video:select-and-probe'),
});
