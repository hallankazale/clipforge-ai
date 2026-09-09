import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import path from 'node:path';
import { probeVideo } from './services/video-engine';

const DEV_SERVER_URL = 'http://localhost:5173';

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

app.whenReady().then(() => {
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
