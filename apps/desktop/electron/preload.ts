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
  getPilotSecretStatus: () => ipcRenderer.invoke('pilot:secret-status'),
  savePilotOpenAiKey: (apiKey: string) => ipcRenderer.invoke('pilot:save-openai-key', apiKey),
  removePilotOpenAiKey: () => ipcRenderer.invoke('pilot:remove-openai-key'),
  listPilotQueue: () => ipcRenderer.invoke('pilot:queue-list'),
  schedulePilotWeek: (settings: unknown) => ipcRenderer.invoke('pilot:schedule-week', settings),
  generatePilotNow: (settings: unknown) => ipcRenderer.invoke('pilot:generate-now', settings),
  cancelPilot: (queueItemId: string) => ipcRenderer.invoke('pilot:cancel', queueItemId),
  onPilotProgress: (callback: (payload: unknown) => void) => subscribe('pilot:progress', callback),
  onPilotComplete: (callback: (payload: unknown) => void) => subscribe('pilot:complete', callback),
  onPilotError: (callback: (payload: unknown) => void) => subscribe('pilot:error', callback),
});
