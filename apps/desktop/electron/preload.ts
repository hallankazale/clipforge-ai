import { contextBridge, ipcRenderer } from 'electron';

type Unsubscribe = () => void;

function subscribe<T>(channel: string, callback: (payload: T) => void): Unsubscribe {
  const handler = (_event: Electron.IpcRendererEvent, payload: T): void => callback(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

contextBridge.exposeInMainWorld('clipforge', {
  platform: process.platform,
  selectOutputDirectory: (): Promise<string | null> =>
    ipcRenderer.invoke('storage:choose-output-directory'),
  selectVideoFile: () => ipcRenderer.invoke('video:select-and-probe'),
  startAnalysis: (input: { filePath: string; outputPath: string }) =>
    ipcRenderer.invoke('analysis:start', input),
  cancelAnalysis: (jobId: string) => ipcRenderer.invoke('analysis:cancel', jobId),
  onAnalysisProgress: (callback: (payload: unknown) => void) =>
    subscribe('analysis:progress', callback),
  onAnalysisComplete: (callback: (payload: unknown) => void) =>
    subscribe('analysis:complete', callback),
  onAnalysisError: (callback: (payload: unknown) => void) =>
    subscribe('analysis:error', callback),
});
