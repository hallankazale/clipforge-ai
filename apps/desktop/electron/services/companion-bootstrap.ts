import { app } from 'electron';
import { normalizePilotSettings } from '../core/pilot-settings';
import {
  createImmediatePilotQueueItem,
  createSevenDayPilotQueue,
  getPilotQueueItem,
  listPilotQueue,
  updatePilotQueueItem,
} from './pilot-queue';
import { startCompanionServer, stopCompanionServer } from './companion-server';

app.whenReady().then(() => {
  void startCompanionServer({
    listQueue: () => listPilotQueue(),
    generateNow: async (settings) => {
      const item = await createImmediatePilotQueueItem(settings);
      return { ok: true, item };
    },
    scheduleWeek: async (settings) => ({
      ok: true,
      items: await createSevenDayPilotQueue(settings),
    }),
    cancel: async (queueItemId) => {
      const item = await getPilotQueueItem(queueItemId);
      if (!item || item.status !== 'queued') return { ok: false };
      await updatePilotQueueItem(queueItemId, {
        status: 'canceled',
        error: 'Cancelado pelo Android antes do processamento.',
      });
      return { ok: true };
    },
    normalizeSettings: normalizePilotSettings,
    isBusy: () => false,
  }).catch((error) => {
    console.error('Falha ao iniciar Android Companion:', error);
  });
});

app.on('before-quit', () => {
  void stopCompanionServer();
});
