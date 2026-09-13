import { randomBytes } from 'node:crypto';
import { app, safeStorage } from 'electron';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

interface SecretStore {
  version: 1;
  openaiApiKey?: string;
  companionToken?: string;
}

function getStorePath(): string {
  return path.join(app.getPath('userData'), 'clipforge-secrets.json');
}

async function readStore(): Promise<SecretStore> {
  try {
    const raw = await readFile(getStorePath(), 'utf8');
    const parsed = JSON.parse(raw) as Partial<SecretStore>;
    return {
      version: 1,
      openaiApiKey: parsed.openaiApiKey,
      companionToken: parsed.companionToken,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { version: 1 };
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

function encryptSecret(value: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('O Windows não disponibilizou criptografia segura para armazenar credenciais.');
  }
  return safeStorage.encryptString(value).toString('base64');
}

function decryptSecret(value: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('A criptografia segura do sistema não está disponível.');
  }
  return safeStorage.decryptString(Buffer.from(value, 'base64'));
}

export function isSecretEncryptionAvailable(): boolean {
  return safeStorage.isEncryptionAvailable();
}

export async function saveOpenAiApiKey(apiKey: string): Promise<void> {
  const normalized = apiKey.trim();
  if (normalized.length < 20) throw new Error('A chave da OpenAI parece inválida.');
  const store = await readStore();
  await writeStore({ ...store, version: 1, openaiApiKey: encryptSecret(normalized) });
}

export async function readOpenAiApiKey(): Promise<string | null> {
  const store = await readStore();
  if (!store.openaiApiKey) return null;
  try {
    return decryptSecret(store.openaiApiKey);
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

export async function getOrCreateCompanionToken(): Promise<string> {
  const store = await readStore();
  if (store.companionToken) return decryptSecret(store.companionToken);
  const token = randomBytes(24).toString('base64url');
  await writeStore({ ...store, version: 1, companionToken: encryptSecret(token) });
  return token;
}

export async function rotateCompanionToken(): Promise<string> {
  const store = await readStore();
  const token = randomBytes(24).toString('base64url');
  await writeStore({ ...store, version: 1, companionToken: encryptSecret(token) });
  return token;
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
