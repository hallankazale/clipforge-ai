import { dialog } from 'electron';
import { createServer, type Server } from 'node:http';
import { getOrCreateCompanionToken } from './secure-secrets';

const PAIRING_PORT = 43171;
let pairingServer: Server | null = null;
let pairingInProgress = false;

function sendJson(response: import('node:http').ServerResponse, status: number, payload: unknown): void {
  response.statusCode = status;
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.end(JSON.stringify(payload));
}

async function readDeviceName(request: import('node:http').IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const raw of request) {
    const chunk = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
    size += chunk.length;
    if (size > 2048) throw new Error('REQUEST_TOO_LARGE');
    chunks.push(chunk);
  }
  if (chunks.length === 0) return 'Android';
  const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')) as { deviceName?: unknown };
  return typeof parsed.deviceName === 'string'
    ? parsed.deviceName.replace(/[^a-zA-Z0-9 _.-]/g, '').slice(0, 60) || 'Android'
    : 'Android';
}

export async function startCompanionPairingServer(): Promise<void> {
  if (pairingServer?.listening) return;

  pairingServer = createServer(async (request, response) => {
    if (request.method === 'OPTIONS') {
      response.statusCode = 204;
      response.setHeader('Access-Control-Allow-Origin', '*');
      response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      response.end();
      return;
    }

    if (request.method !== 'POST' || request.url !== '/pair') {
      sendJson(response, 404, { ok: false, error: 'Rota não encontrada.' });
      return;
    }

    if (pairingInProgress) {
      sendJson(response, 409, { ok: false, error: 'Já existe um pareamento aguardando confirmação.' });
      return;
    }

    pairingInProgress = true;
    try {
      const deviceName = await readDeviceName(request);
      const result = await dialog.showMessageBox({
        type: 'question',
        title: 'ClipForge Android',
        message: `${deviceName} quer controlar o Piloto IA deste computador.`,
        detail: 'Permita somente se este pedido foi iniciado por você no seu celular e se ambos os aparelhos estão em uma rede confiável.',
        buttons: ['Permitir', 'Negar'],
        defaultId: 0,
        cancelId: 1,
        noLink: true,
      });

      if (result.response !== 0) {
        sendJson(response, 403, { ok: false, error: 'Pareamento negado no computador.' });
        return;
      }

      sendJson(response, 200, {
        ok: true,
        token: await getOrCreateCompanionToken(),
        apiPort: 43170,
      });
    } catch {
      sendJson(response, 400, { ok: false, error: 'Não foi possível concluir o pareamento.' });
    } finally {
      pairingInProgress = false;
    }
  });

  await new Promise<void>((resolve, reject) => {
    pairingServer?.once('error', reject);
    pairingServer?.listen(PAIRING_PORT, '0.0.0.0', () => resolve());
  });
}

export async function stopCompanionPairingServer(): Promise<void> {
  const server = pairingServer;
  pairingServer = null;
  if (!server?.listening) return;
  await new Promise<void>((resolve) => server.close(() => resolve()));
}
