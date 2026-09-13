import { app, safeStorage } from 'electron';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

interface SecretStore {
  version: 1;
  openaiApiKey?: string;
}

function getStorePath(): string {
  return path.join(app.getPath('userData'), 'clipforge-secrets.json');
}

async function readStore(): Promise<SecretStore> {
  try {
    const raw = await readFile(getStorePath(), 'utf8');
    const parsed = JSON.parse(raw) as Partial<SecretStore>;
    return { version: 1, openaiApiKey: parsed.openaiApiKey };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { version: 1 };
    }
    throw error;
  }
}

async function writeStore(store: SecretStore): Promise<void> {
  const storePath = getStorePath();
  await mkdir(path.dirname(storePath), { recursive: true });
  const temporaryPath = `${storePath}.tmp`;
  await writeFile(temporaryPath, JSON.stringify(store), { encoding: 'utf8', mode: 0o600 });
  try {
    await rename(temporaryPath, storePath);
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
}

export function isSecretEncryptionAvailable(): boolean {
  return safeStorage.isEncryptionAvailable();
}

export async function saveOpenAiApiKey(apiKey: string): Promise<void> {
  const normalized = apiKey.trim();
  if (normalized.length < 20) {
    throw new Error('A chave da OpenAI parece inválida.');
  }
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('O Windows não disponibilizou criptografia segura para armazenar a chave.');
  }

  const encrypted = safeStorage.encryptString(normalized).toString('base64');
  const store = await readStore();
  await writeStore({ ...store, version: 1, openaiApiKey: encrypted });
}

export async function readOpenAiApiKey(): Promise<string | null> {
  const store = await readStore();
  if (!store.openaiApiKey) return null;
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('A criptografia segura do sistema não está disponível.');
  }

  try {
    return safeStorage.decryptString(Buffer.from(store.openaiApiKey, 'base64'));
  } catch {
    throw new Error('Não foi possível descriptografar a chave da OpenAI salva neste computador.');
  }
}

export async function removeOpenAiApiKey(): Promise<void> {
  const store = await readStore();
  if (!store.openaiApiKey) return;
  delete store.openaiApiKey;
  await writeStore(store);
}

export async function getSecretStatus(): Promise<{
  encryptionAvailable: boolean;
  openaiConfigured: boolean;
}> {
  const store = await readStore();
  return {
    encryptionAvailable: safeStorage.isEncryptionAvailable(),
    openaiConfigured: Boolean(store.openaiApiKey),
  };
}
