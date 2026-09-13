import type {
  CompanionConfig,
  CompanionHealth,
  PilotProductionSettingsPayload,
  PilotQueueItem,
} from './types';

const CONFIG_KEY = 'clipforge.mobile.companion.v1';
const REQUEST_TIMEOUT_MS = 10_000;

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/$/, '');
}

export function loadCompanionConfig(): CompanionConfig | null {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CompanionConfig>;
    if (typeof parsed.baseUrl !== 'string' || typeof parsed.token !== 'string') return null;
    if (!/^https?:\/\//i.test(parsed.baseUrl) || parsed.token.length < 16) return null;
    return { baseUrl: normalizeBaseUrl(parsed.baseUrl), token: parsed.token };
  } catch {
    return null;
  }
}

export function saveCompanionConfig(config: CompanionConfig): CompanionConfig {
  const normalized = { baseUrl: normalizeBaseUrl(config.baseUrl), token: config.token.trim() };
  localStorage.setItem(CONFIG_KEY, JSON.stringify(normalized));
  return normalized;
}

export function clearCompanionConfig(): void {
  localStorage.removeItem(CONFIG_KEY);
}

async function requestJson<T>(
  baseUrl: string,
  path: string,
  init: RequestInit = {},
  token?: string,
): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${normalizeBaseUrl(baseUrl)}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers ?? {}),
      },
    });
    const payload = await response.json() as T & { error?: string };
    if (!response.ok) throw new Error(payload.error ?? `Falha HTTP ${response.status}`);
    return payload;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('O computador não respondeu. Confira se o ClipForge está aberto e na mesma rede.');
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function discoverHealth(baseUrl: string): Promise<CompanionHealth> {
  return requestJson<CompanionHealth>(baseUrl, '/health');
}

export async function requestPairing(baseUrl: string, deviceName: string): Promise<CompanionConfig> {
  const url = new URL(normalizeBaseUrl(baseUrl));
  url.port = '43171';
  const payload = await requestJson<{ ok: boolean; token: string; apiPort: number }>(
    url.origin,
    '/pair',
    {
      method: 'POST',
      body: JSON.stringify({ deviceName }),
    },
  );
  url.port = String(payload.apiPort);
  return saveCompanionConfig({ baseUrl: url.origin, token: payload.token });
}

export async function testCompanion(config: CompanionConfig): Promise<CompanionHealth> {
  const health = await discoverHealth(config.baseUrl);
  await requestJson<{ ok: boolean; busy: boolean }>(config.baseUrl, '/api/status', {}, config.token);
  return health;
}

export async function listQueue(config: CompanionConfig): Promise<PilotQueueItem[]> {
  const payload = await requestJson<{ ok: true; items: PilotQueueItem[] }>(
    config.baseUrl,
    '/api/queue',
    {},
    config.token,
  );
  return payload.items;
}

export async function generateNow(
  config: CompanionConfig,
  settings: PilotProductionSettingsPayload,
): Promise<PilotQueueItem> {
  const payload = await requestJson<{ ok: boolean; item?: PilotQueueItem; error?: string }>(
    config.baseUrl,
    '/api/generate',
    { method: 'POST', body: JSON.stringify({ settings }) },
    config.token,
  );
  if (!payload.item) throw new Error(payload.error ?? 'O computador não criou o job.');
  return payload.item;
}

export async function scheduleWeek(
  config: CompanionConfig,
  settings: PilotProductionSettingsPayload,
): Promise<PilotQueueItem[]> {
  const payload = await requestJson<{ ok: boolean; items?: PilotQueueItem[]; error?: string }>(
    config.baseUrl,
    '/api/schedule',
    { method: 'POST', body: JSON.stringify({ settings }) },
    config.token,
  );
  return payload.items ?? [];
}

export async function cancelQueued(config: CompanionConfig, queueItemId: string): Promise<void> {
  await requestJson<{ ok: boolean }>(
    config.baseUrl,
    '/api/cancel',
    { method: 'POST', body: JSON.stringify({ queueItemId }) },
    config.token,
  );
}
