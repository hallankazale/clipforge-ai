import { randomUUID } from 'node:crypto';
import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import path from 'node:path';
import {
  runAnalysisPipeline,
  type AnalysisProgress,
} from './services/analysis-pipeline';
import type { CutPlatform } from './services/smart-cut-engine';
import { probeVideo } from './services/video-engine';
import {
  createImmediatePilotQueueItem,
  createSevenDayPilotQueue,
  getNextDuePilotQueueItem,
  listPilotQueue,
} from './services/pilot-queue';
import type { PilotProductionSettings } from './services/pilot-queue-types';
import {
  runPilotProduction,
  type PilotProductionProgress,
} from './services/pilot-production-engine';
import {
  getSecretStatus,
  removeOpenAiApiKey,
  saveOpenAiApiKey,
} from './services/secure-secrets';

const DEV_SERVER_URL = 'http://localhost:5173';
const activeAnalyses = new Map<string, AbortController>();
const activePilotJobs = new Map<string, AbortController>();
const ALLOWED_PLATFORMS = new Set<CutPlatform>(['Instagram', 'TikTok', 'Reels', 'YouTube']);
const PILOT_PLATFORMS = new Set(['YouTube Shorts', 'TikTok']);
let pilotScheduler: NodeJS.Timeout | null = null;

function createMainWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1120,
    minHeight: 720,
    backgroundColor: '#07111f',
    title: 'ClipForge AI',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (!app.isPackaged) {
    void mainWindow.loadURL(DEV_SERVER_URL);
    return;
  }

  void mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
}

function sendSafely(
  sender: Electron.WebContents,
  channel: string,
  payload: unknown,
): void {
  if (!sender.isDestroyed()) sender.send(channel, payload);
}

function broadcast(channel: string, payload: unknown): void {
  for (const window of BrowserWindow.getAllWindows()) {
    sendSafely(window.webContents, channel, payload);
  }
}

function normalizePilotSettings(value: unknown): PilotProductionSettings | null {
  if (!value || typeof value !== 'object') return null;
  const input = value as Partial<PilotProductionSettings>;
  const niche = input.niche;
  if (!niche || typeof niche !== 'object') return null;
  if (
    typeof niche.id !== 'string' ||
    typeof niche.label !== 'string' ||
    typeof niche.audience !== 'string' ||
    typeof niche.tone !== 'string' ||
    typeof niche.visualStyle !== 'string' ||
    !Array.isArray(niche.contentPillars)
  ) return null;

  const platforms = Array.isArray(input.platforms)
    ? [...new Set(input.platforms)].filter((platform) => PILOT_PLATFORMS.has(platform))
    : [];
  if (platforms.length === 0) return null;
  if (![30, 45, 60].includes(input.durationSeconds as number)) return null;
  if (![1, 2, 3].includes(input.videosPerDay as number)) return null;
  if (![1, 2, 3].includes(input.maxRetries as number)) return null;
  if (typeof input.minimumQualityScore !== 'number' || input.minimumQualityScore < 75 || input.minimumQualityScore > 95) return null;
  if (typeof input.autoRetry !== 'boolean') return null;

  return {
    niche: {
      id: niche.id.slice(0, 80),
      label: niche.label.slice(0, 120),
      audience: niche.audience.slice(0, 300),
      tone: niche.tone.slice(0, 200),
      visualStyle: niche.visualStyle.slice(0, 500),
      contentPillars: niche.contentPillars
        .filter((item): item is string => typeof item === 'string')
        .slice(0, 12)
        .map((item) => item.slice(0, 120)),
    },
    platforms: platforms as PilotProductionSettings['platforms'],
    durationSeconds: input.durationSeconds as 30 | 45 | 60,
    videosPerDay: input.videosPerDay as 1 | 2 | 3,
    minimumQualityScore: input.minimumQualityScore,
    autoRetry: input.autoRetry,
    maxRetries: input.maxRetries as 1 | 2 | 3,
  };
}

function startPilotJob(queueItemId: string): boolean {
  if (activePilotJobs.size > 0) return false;
  const controller = new AbortController();
  activePilotJobs.set(queueItemId, controller);

  const onProgress = (progress: PilotProductionProgress): void => {
    broadcast('pilot:progress', progress);
  };

  void runPilotProduction({
    queueItemId,
    signal: controller.signal,
    onProgress,
  })
    .then((result) => broadcast('pilot:complete', result))
    .catch((error) => {
      const canceled = error instanceof Error && error.message === 'PILOT_CANCELED';
      broadcast('pilot:error', {
        queueItemId,
        canceled,
        error: canceled
          ? 'Produção cancelada pelo usuário.'
          : error instanceof Error
            ? error.message
            : 'Falha inesperada no Piloto IA.',
      });
    })
    .finally(() => activePilotJobs.delete(queueItemId));
  return true;
}

async function runDuePilotJob(): Promise<void> {
  if (activePilotJobs.size > 0) return;
  const next = await getNextDuePilotQueueItem();
  if (next) startPilotJob(next.id);
}

ipcMain.handle('storage:choose-output-directory', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Escolha a pasta onde os cortes serão salvos',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle('storage:open-directory', async (_event, targetPath: string) => {
  if (typeof targetPath !== 'string' || !path.isAbsolute(targetPath)) {
    return { ok: false, error: 'Caminho inválido.' };
  }
  const error = await shell.openPath(targetPath);
  return error ? { ok: false, error } : { ok: true };
});

ipcMain.handle('video:select-and-probe', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Selecione um vídeo para analisar',
    properties: ['openFile'],
    filters: [{
      name: 'Vídeos',
      extensions: ['mp4', 'mov', 'mkv', 'avi', 'webm', 'm4v', 'mpeg', 'mpg'],
    }],
  });
  if (result.canceled || result.filePaths.length === 0) {
    return { ok: false, canceled: true, error: null };
  }
  try {
    const metadata = await probeVideo(result.filePaths[0]);
    return { ok: true, canceled: false, metadata };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao analisar o vídeo.';
    return { ok: false, canceled: false, error: message };
  }
});

ipcMain.handle(
  'analysis:start',
  async (
    event,
    input: {
      filePath?: string;
      outputPath?: string;
      cutDurationMinutes?: number;
      platforms?: string[];
    },
  ) => {
    if (activeAnalyses.size > 0) {
      return { ok: false, error: 'Já existe uma análise em andamento. Cancele ou aguarde a conclusão.' };
    }
    const filePath = input?.filePath;
    const outputPath = input?.outputPath;
    const cutDurationMinutes = input?.cutDurationMinutes;
    const platforms = Array.isArray(input?.platforms)
      ? input.platforms.filter((platform): platform is CutPlatform => ALLOWED_PLATFORMS.has(platform as CutPlatform))
      : [];
    if (!filePath || !outputPath) return { ok: false, error: 'Vídeo e pasta de saída são obrigatórios.' };
    if (!path.isAbsolute(filePath) || !path.isAbsolute(outputPath)) return { ok: false, error: 'Os caminhos do vídeo e da saída precisam ser absolutos.' };
    if (cutDurationMinutes !== 1 && cutDurationMinutes !== 5 && cutDurationMinutes !== 10) return { ok: false, error: 'Escolha cortes de 1, 5 ou 10 minutos.' };
    if (platforms.length === 0) return { ok: false, error: 'Selecione pelo menos uma plataforma de saída.' };

    const jobId = randomUUID();
    const controller = new AbortController();
    activeAnalyses.set(jobId, controller);
    const onProgress = (progress: AnalysisProgress): void => sendSafely(event.sender, 'analysis:progress', progress);

    void runAnalysisPipeline({
      jobId,
      filePath,
      outputPath,
      cutDurationMinutes,
      platforms,
      signal: controller.signal,
      onProgress,
    })
      .then((result) => sendSafely(event.sender, 'analysis:complete', result))
      .catch((error) => {
        const canceled = error instanceof Error && error.message === 'ANALYSIS_CANCELED';
        sendSafely(event.sender, 'analysis:error', {
          jobId,
          canceled,
          error: canceled
            ? 'Análise cancelada pelo usuário.'
            : error instanceof Error
              ? error.message
              : 'Falha inesperada durante a análise.',
        });
      })
      .finally(() => activeAnalyses.delete(jobId));
    return { ok: true, jobId };
  },
);

ipcMain.handle('analysis:cancel', async (_event, jobId: string) => {
  const controller = activeAnalyses.get(jobId);
  if (!controller) return { ok: false };
  controller.abort();
  return { ok: true };
});

ipcMain.handle('pilot:secret-status', () => getSecretStatus());
ipcMain.handle('pilot:save-openai-key', async (_event, apiKey: unknown) => {
  if (typeof apiKey !== 'string') return { ok: false, error: 'Chave inválida.' };
  try {
    await saveOpenAiApiKey(apiKey);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Falha ao salvar a chave.' };
  }
});
ipcMain.handle('pilot:remove-openai-key', async () => {
  await removeOpenAiApiKey();
  return { ok: true };
});
ipcMain.handle('pilot:queue-list', () => listPilotQueue());
ipcMain.handle('pilot:schedule-week', async (_event, rawSettings: unknown) => {
  const settings = normalizePilotSettings(rawSettings);
  if (!settings) return { ok: false, error: 'Configuração do Piloto IA inválida.' };
  const items = await createSevenDayPilotQueue(settings);
  return { ok: true, items };
});
ipcMain.handle('pilot:generate-now', async (_event, rawSettings: unknown) => {
  if (activePilotJobs.size > 0) return { ok: false, error: 'Já existe um vídeo sendo produzido.' };
  const settings = normalizePilotSettings(rawSettings);
  if (!settings) return { ok: false, error: 'Configuração do Piloto IA inválida.' };
  const item = await createImmediatePilotQueueItem(settings);
  const started = startPilotJob(item.id);
  return started ? { ok: true, item } : { ok: false, error: 'Não foi possível iniciar a produção.' };
});
ipcMain.handle('pilot:cancel', async (_event, queueItemId: unknown) => {
  if (typeof queueItemId !== 'string') return { ok: false };
  const controller = activePilotJobs.get(queueItemId);
  if (!controller) return { ok: false };
  controller.abort();
  return { ok: true };
});

app.whenReady().then(() => {
  createMainWindow();
  void runDuePilotJob();
  pilotScheduler = setInterval(() => {
    void runDuePilotJob();
  }, 60_000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('before-quit', () => {
  if (pilotScheduler) clearInterval(pilotScheduler);
  for (const controller of activeAnalyses.values()) controller.abort();
  for (const controller of activePilotJobs.values()) controller.abort();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
