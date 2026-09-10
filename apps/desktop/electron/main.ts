import { randomUUID } from 'node:crypto';
import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import path from 'node:path';
import {
  runAnalysisPipeline,
  type AnalysisProgress,
} from './services/analysis-pipeline';
import type { CutPlatform } from './services/smart-cut-engine';
import { probeVideo } from './services/video-engine';

const DEV_SERVER_URL = 'http://localhost:5173';
const activeAnalyses = new Map<string, AbortController>();
const ALLOWED_PLATFORMS = new Set<CutPlatform>(['Instagram', 'TikTok', 'Reels', 'YouTube']);

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
  if (!sender.isDestroyed()) {
    sender.send(channel, payload);
  }
}

ipcMain.handle('storage:choose-output-directory', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Escolha a pasta onde os cortes serão salvos',
    properties: ['openDirectory', 'createDirectory'],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

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
    filters: [
      {
        name: 'Vídeos',
        extensions: ['mp4', 'mov', 'mkv', 'avi', 'webm', 'm4v', 'mpeg', 'mpg'],
      },
    ],
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
      return {
        ok: false,
        error: 'Já existe uma análise em andamento. Cancele ou aguarde a conclusão.',
      };
    }

    const filePath = input?.filePath;
    const outputPath = input?.outputPath;
    const cutDurationMinutes = input?.cutDurationMinutes;
    const platforms = Array.isArray(input?.platforms)
      ? input.platforms.filter((platform): platform is CutPlatform =>
          ALLOWED_PLATFORMS.has(platform as CutPlatform),
        )
      : [];

    if (!filePath || !outputPath) {
      return { ok: false, error: 'Vídeo e pasta de saída são obrigatórios.' };
    }

    if (!path.isAbsolute(filePath) || !path.isAbsolute(outputPath)) {
      return { ok: false, error: 'Os caminhos do vídeo e da saída precisam ser absolutos.' };
    }

    if (cutDurationMinutes !== 1 && cutDurationMinutes !== 5 && cutDurationMinutes !== 10) {
      return { ok: false, error: 'Escolha cortes de 1, 5 ou 10 minutos.' };
    }

    if (platforms.length === 0) {
      return { ok: false, error: 'Selecione pelo menos uma plataforma de saída.' };
    }

    const jobId = randomUUID();
    const controller = new AbortController();
    activeAnalyses.set(jobId, controller);

    const onProgress = (progress: AnalysisProgress): void => {
      sendSafely(event.sender, 'analysis:progress', progress);
    };

    void runAnalysisPipeline({
      jobId,
      filePath,
      outputPath,
      cutDurationMinutes,
      platforms,
      signal: controller.signal,
      onProgress,
    })
      .then((result) => {
        sendSafely(event.sender, 'analysis:complete', result);
      })
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
      .finally(() => {
        activeAnalyses.delete(jobId);
      });

    return { ok: true, jobId };
  },
);

ipcMain.handle('analysis:cancel', async (_event, jobId: string) => {
  const controller = activeAnalyses.get(jobId);
  if (!controller) return { ok: false };

  controller.abort();
  return { ok: true };
});

app.whenReady().then(() => {
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('before-quit', () => {
  for (const controller of activeAnalyses.values()) {
    controller.abort();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
