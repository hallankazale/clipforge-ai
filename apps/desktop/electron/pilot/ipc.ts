import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { JobStore } from './store';
import { Vault } from './vault';
import { Accounts } from './oauth';
import { PilotRuntime } from './runtime';
import type { Platform, StartPilotInput } from './contracts';

export function registerPilot(): PilotRuntime {
  const directory = path.join(app.getPath('userData'), 'pilot');
  const vault = new Vault(path.join(directory, 'credentials.bin'));
  const runtime = new PilotRuntime(new JobStore(path.join(directory, 'jobs.json')), vault, new Accounts(vault, url => shell.openExternal(url)), () => {
    for (const window of BrowserWindow.getAllWindows()) if (!window.isDestroyed()) window.webContents.send('pilot:change');
  });
  const ready = runtime.init();
  // Keep rejection handled while preserving it for all IPC callers.
  void ready.catch(() => {});
  function handle(channel: string, callback: (...args: any[]) => unknown): void {
    ipcMain.handle(channel, async (event, ...args) => {
      const expected = app.isPackaged ? pathToFileURL(path.join(__dirname, '../../dist/index.html')).href : 'http://localhost:5173/';
      if (!event.senderFrame || event.senderFrame !== event.sender.mainFrame || event.senderFrame.url.split('#')[0] !== expected) throw new Error('Origem não autorizada.');
      await ready; return callback(...args);
    });
  }
  handle('pilot:snapshot', () => runtime.snapshot());
  handle('pilot:import', async () => {
    const result = await dialog.showOpenDialog({ title: 'Importar credenciais locais do ClipForge', properties: ['openFile'], filters: [{ name: 'JSON', extensions: ['json'] }] });
    if (result.canceled) return { canceled: true };
    const file = result.filePaths[0]; if ((await stat(file)).size > 32_768) throw new Error('Arquivo de credenciais excessivo.');
    let value: unknown; try { value = JSON.parse(await readFile(file, 'utf8')); } catch { throw new Error('JSON de credenciais inválido.'); }
    await vault.import(value); return { canceled: false };
  });
  handle('pilot:connect', (platform: Platform) => runtime.accounts.connect(platform));
  handle('pilot:disconnect', (id: string) => {
    if (runtime.snapshot().busy) throw new Error('Aguarde a operação atual antes de desconectar.');
    return runtime.accounts.disconnect(id);
  });
  handle('pilot:start', (input: StartPilotInput) => runtime.start(input));
  handle('pilot:cancel', (id: string) => runtime.cancel(id));
  handle('pilot:preview', async (id: string) => {
    const job = runtime.store.get(id); if (!job.videoPath) throw new Error('O vídeo ainda não está pronto.');
    const error = await shell.openPath(job.videoPath); if (error) throw new Error('Não foi possível abrir o vídeo.');
  });
  handle('pilot:tiktok-draft', async (id: string) => {
    const job = runtime.store.get(id), accountId = job.publications.find(p => p.platform === 'tiktok')?.accountId;
    const account = vault.accounts().find(a => a.id === accountId);
    if (!account) throw new Error('Conecte o TikTok antes de criar o vídeo.');
    const result = await dialog.showMessageBox({ type: 'question', title: 'Enviar para o TikTok',
      message: `Enviar “${job.plan?.title || 'Vídeo'}” para ${account.name}?`,
      detail: 'Confirme depois de assistir à prévia. O vídeo será enviado à sua caixa de entrada do TikTok. Você poderá editar a legenda, marcar conteúdo gerado por IA e concluir a publicação no TikTok.',
      buttons: ['Cancelar', 'Enviar vídeo'], defaultId: 0, cancelId: 0 });
    if (result.response === 1) await runtime.sendTikTok(id);
  });
  return runtime;
}
