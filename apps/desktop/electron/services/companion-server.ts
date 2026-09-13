import { timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { networkInterfaces } from 'node:os';
import type { PilotProductionSettings, PilotQueueItem } from './pilot-queue-types';
import { getOrCreateCompanionToken } from './secure-secrets';

const DEFAULT_PORT = 43170;
const MAX_BODY_BYTES = 64 * 1024;

interface CompanionHandlers {
  listQueue: () => Promise<PilotQueueItem[]>;
  generateNow: (settings: PilotProductionSettings) => Promise<{ ok: boolean; item?: PilotQueueItem; error?: string }>;
  scheduleWeek: (settings: PilotProductionSettings) => Promise<{ ok: boolean; items?: PilotQueueItem[]; error?: string }>;
  cancel: (queueItemId: string) => Promise<{ ok: boolean }>;
  normalizeSettings: (value: unknown) => PilotProductionSettings | null;
  isBusy: () => boolean;
}

export interface CompanionAccessInfo {
  running: boolean;
  port: number;
  addresses: string[];
  token: string;
}

let companionServer: Server | null = null;
let activePort = DEFAULT_PORT;

function getLanAddresses(port: number): string[] {
  const addresses: string[] = [];
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === 'IPv4' && !entry.internal) {
        addresses.push(`http://${entry.address}:${port}`);
      }
    }
  }
  return [...new Set(addresses)];
}

function setCors(response: ServerResponse): void {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.setHeader('Cache-Control', 'no-store');
}

function sendJson(response: ServerResponse, status: number, payload: unknown): void {
  setCors(response);
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(payload));
}

function secureTokenMatch(received: string, expected: string): boolean {
  const receivedBytes = Buffer.from(received);
  const expectedBytes = Buffer.from(expected);
  if (receivedBytes.length !== expectedBytes.length) return false;
  return timingSafeEqual(receivedBytes, expectedBytes);
}

function readBearerToken(request: IncomingMessage): string | null {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) return null;
  return authorization.slice('Bearer '.length).trim();
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const rawChunk of request) {
    const chunk = Buffer.isBuffer(rawChunk) ? rawChunk : Buffer.from(rawChunk);
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error('REQUEST_TOO_LARGE');
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}

export async function getCompanionAccessInfo(): Promise<CompanionAccessInfo> {
  return {
    running: Boolean(companionServer?.listening),
    port: activePort,
    addresses: getLanAddresses(activePort),
    token: await getOrCreateCompanionToken(),
  };
}

export async function startCompanionServer(
  handlers: CompanionHandlers,
  port = DEFAULT_PORT,
): Promise<CompanionAccessInfo> {
  if (companionServer?.listening) return getCompanionAccessInfo();

  const expectedToken = await getOrCreateCompanionToken();
  activePort = port;

  companionServer = createServer(async (request, response) => {
    try {
      if (request.method === 'OPTIONS') {
        setCors(response);
        response.statusCode = 204;
        response.end();
        return;
      }

      const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
      if (request.method === 'GET' && url.pathname === '/health') {
        sendJson(response, 200, {
          ok: true,
          product: 'ClipForge AI',
          companionApi: 1,
          busy: handlers.isBusy(),
        });
        return;
      }

      const token = readBearerToken(request);
      if (!token || !secureTokenMatch(token, expectedToken)) {
        sendJson(response, 401, { ok: false, error: 'Pareamento inválido.' });
        return;
      }

      if (request.method === 'GET' && url.pathname === '/api/queue') {
        sendJson(response, 200, { ok: true, items: await handlers.listQueue() });
        return;
      }

      if (request.method === 'GET' && url.pathname === '/api/status') {
        sendJson(response, 200, { ok: true, busy: handlers.isBusy() });
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/generate') {
        const body = await readJsonBody(request);
        const rawSettings = (body as { settings?: unknown })?.settings;
        const settings = handlers.normalizeSettings(rawSettings);
        if (!settings) {
          sendJson(response, 400, { ok: false, error: 'Configuração inválida.' });
          return;
        }
        const result = await handlers.generateNow(settings);
        sendJson(response, result.ok ? 202 : 409, result);
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/schedule') {
        const body = await readJsonBody(request);
        const rawSettings = (body as { settings?: unknown })?.settings;
        const settings = handlers.normalizeSettings(rawSettings);
        if (!settings) {
          sendJson(response, 400, { ok: false, error: 'Configuração inválida.' });
          return;
        }
        const result = await handlers.scheduleWeek(settings);
        sendJson(response, result.ok ? 201 : 400, result);
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/cancel') {
        const body = await readJsonBody(request) as { queueItemId?: unknown };
        if (typeof body.queueItemId !== 'string' || body.queueItemId.length > 100) {
          sendJson(response, 400, { ok: false, error: 'Job inválido.' });
          return;
        }
        const result = await handlers.cancel(body.queueItemId);
        sendJson(response, result.ok ? 200 : 404, result);
        return;
      }

      sendJson(response, 404, { ok: false, error: 'Rota não encontrada.' });
    } catch (error) {
      const requestTooLarge = error instanceof Error && error.message === 'REQUEST_TOO_LARGE';
      sendJson(response, requestTooLarge ? 413 : 500, {
        ok: false,
        error: requestTooLarge ? 'Requisição grande demais.' : 'Falha no serviço Android Companion.',
      });
    }
  });

  await new Promise<void>((resolve, reject) => {
    companionServer?.once('error', reject);
    companionServer?.listen(port, '0.0.0.0', () => resolve());
  });

  return getCompanionAccessInfo();
}

export async function stopCompanionServer(): Promise<void> {
  const server = companionServer;
  companionServer = null;
  if (!server?.listening) return;
  await new Promise<void>((resolve) => server.close(() => resolve()));
}
