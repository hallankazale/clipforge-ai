import { contextBridge, ipcRenderer } from 'electron';

type Unsubscribe = () => void;

function subscribe<T>(channel: string, callback: (payload: T) => void): Unsubscribe {
  const handler = (_event: Electron.IpcRendererEvent, payload: T): void => callback(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

contextBridge.exposeInMainWorld('clipforge', {
  platform: process.platform,
  pilot: {
    snapshot: () => ipcRenderer.invoke('pilot:snapshot'),
    importCredentials: () => ipcRenderer.invoke('pilot:import'),
    connect: (platform: string) => ipcRenderer.invoke('pilot:connect', platform),
    disconnect: (id: string) => ipcRenderer.invoke('pilot:disconnect', id),
    start: (input: unknown) => ipcRenderer.invoke('pilot:start', input),
    cancel: (id: string) => ipcRenderer.invoke('pilot:cancel', id),
    preview: (id: string) => ipcRenderer.invoke('pilot:preview', id),
    sendTikTokDraft: (id: string) => ipcRenderer.invoke('pilot:tiktok-draft', id),
    onChange: (callback: () => void) => subscribe('pilot:change', callback),
  },
  selectOutputDirectory: (): Promise<string | null> =>
    ipcRenderer.invoke('storage:choose-output-directory'),
  openDirectory: (targetPath: string) =>
    ipcRenderer.invoke('storage:open-directory', targetPath),
  selectVideoFile: () => ipcRenderer.invoke('video:select-and-probe'),
  startAnalysis: (input: {
    filePath: string;
    outputPath: string;
    cutDurationMinutes: 1 | 5 | 10;
    platforms: Array<'Instagram' | 'TikTok' | 'Reels' | 'YouTube'>;
  }) => ipcRenderer.invoke('analysis:start', input),
  cancelAnalysis: (jobId: string) => ipcRenderer.invoke('analysis:cancel', jobId),
  onAnalysisProgress: (callback: (payload: unknown) => void) =>
    subscribe('analysis:progress', callback),
  onAnalysisComplete: (callback: (payload: unknown) => void) =>
    subscribe('analysis:complete', callback),
  onAnalysisError: (callback: (payload: unknown) => void) =>
    subscribe('analysis:error', callback),
});
