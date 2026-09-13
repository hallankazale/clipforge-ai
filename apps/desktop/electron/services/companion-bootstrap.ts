import { app, Notification } from 'electron';
import { normalizePilotSettings } from '../core/pilot-settings';
import {
  createImmediatePilotQueueItem,
  createSevenDayPilotQueue,
  getPilotQueueItem,
  listPilotQueue,
  updatePilotQueueItem,
} from './pilot-queue';
import { getCompanionAccessInfo, startCompanionServer, stopCompanionServer } from './companion-server';
import { startCompanionPairingServer, stopCompanionPairingServer } from './companion-pairing-server';

app.whenReady().then(() => {
  void Promise.all([
    startCompanionServer({
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
    }),
    startCompanionPairingServer(),
  ])
    .then(async () => {
      if (!Notification.isSupported()) return;
      const info = await getCompanionAccessInfo();
      const address = info.addresses[0];
      if (!address) return;
      new Notification({
        title: 'ClipForge Android pronto',
        body: `No celular, use ${address} para parear.`,
      }).show();
    })
    .catch((error) => {
      console.error('Falha ao iniciar Android Companion:', error);
    });
});

app.on('before-quit', () => {
  void stopCompanionServer();
  void stopCompanionPairingServer();
});
