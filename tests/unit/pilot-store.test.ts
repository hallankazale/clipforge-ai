import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { JobStore } from '../../apps/desktop/electron/pilot/store';
import type { PilotJob } from '../../apps/desktop/electron/pilot/contracts';
const folders: string[] = [];
afterEach(async () => { await Promise.all(folders.splice(0).map(p => rm(p, { recursive: true, force: true }))); });
async function storeFile() { const folder = await mkdtemp(path.join(tmpdir(), 'clipforge-store-')); folders.push(folder); return path.join(folder, 'jobs.json'); }
describe('fila persistente', () => {
  it('serializa gravações simultâneas sem perder jobs', async () => {
    const store = new JobStore(await storeFile()); await store.load();
    await Promise.all(Array.from({ length: 20 }, (_, i) => store.change(jobs => { jobs.push({ id: String(i), status: 'queued', publications: [] } as unknown as PilotJob); })));
    expect(store.list()).toHaveLength(20);
  });
  it('não reinicia geração paga nem duplica upload após reiniciar', async () => {
    const file = await storeFile();
    await writeFile(file, JSON.stringify({ version: 1, jobs: [{ id: 'one', status: 'generating', publications: [{ status: 'uploading', sessionUrl: 'saved-session' }] }] }));
    const store = new JobStore(file); await store.load();
    expect(store.get('one').status).toBe('failed');
    expect(store.get('one').publications[0]).toMatchObject({ status: 'uncertain', sessionUrl: 'saved-session' });
  });
  it('preserva fila corrompida em vez de sobrescrevê-la', async () => {
    const file = await storeFile(); await writeFile(file, '{broken');
    await expect(new JobStore(file).load()).rejects.toThrow();
    expect(await readFile(file, 'utf8')).toBe('{broken');
  });
});
