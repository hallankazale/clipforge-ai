import { safeStorage } from 'electron';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Account } from './contracts';

export interface Credentials {
  openaiApiKey?: string;
  textModel?: string; imageModel?: string;
  youtubeClientId?: string; youtubeClientSecret?: string;
  tiktokClientKey?: string; tiktokClientSecret?: string;
}
export interface TokenAccount extends Account { accessToken: string; refreshToken: string; expiresAt: number }
export class Vault {
  private state: { credentials: Credentials; accounts: TokenAccount[] } = { credentials: {}, accounts: [] };
  private tail: Promise<unknown> = Promise.resolve();
  constructor(private readonly file: string) {}
  private requireEncryption(): void {
    if (!safeStorage.isEncryptionAvailable() || (process.platform === 'linux' && safeStorage.getSelectedStorageBackend() === 'basic_text')) {
      throw new Error('O cofre seguro do sistema não está disponível.');
    }
  }
  async load(): Promise<void> {
    try {
      const content = await readFile(this.file);
      this.requireEncryption();
      this.state = JSON.parse(safeStorage.decryptString(content));
    } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error('Não foi possível abrir o cofre de credenciais.'); }
  }
  credentials(): Credentials { return { ...this.state.credentials }; }
  accounts(): TokenAccount[] { return structuredClone(this.state.accounts); }
  async change(mutate: (state: typeof this.state) => void): Promise<void> {
    const op = this.tail.then(async () => {
      this.requireEncryption();
      const next = structuredClone(this.state); mutate(next);
      await mkdir(path.dirname(this.file), { recursive: true });
      await writeFile(`${this.file}.tmp`, safeStorage.encryptString(JSON.stringify(next)), { mode: 0o600 });
      await rename(`${this.file}.tmp`, this.file); this.state = next;
    });
    this.tail = op.catch(() => {}); return op;
  }
  async import(value: unknown): Promise<void> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Arquivo de credenciais inválido.');
    const allowed = ['openaiApiKey', 'textModel', 'imageModel', 'youtubeClientId', 'youtubeClientSecret', 'tiktokClientKey', 'tiktokClientSecret'];
    const entries = Object.entries(value);
    if (!entries.length || entries.some(([k, v]) => !allowed.includes(k) || typeof v !== 'string' || !v.trim() || v.length > 4096)) throw new Error('Campos de credenciais inválidos.');
    await this.change(s => { s.credentials = { ...s.credentials, ...value }; });
  }
  async saveAccount(account: TokenAccount): Promise<void> {
    await this.change(s => { s.accounts = [...s.accounts.filter(a => a.id !== account.id), account]; });
  }
}
