import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { JobStore } from '../../apps/desktop/electron/pilot/store';
import { PilotRuntime } from '../../apps/desktop/electron/pilot/runtime';
import type { StartPilotInput } from '../../apps/desktop/electron/pilot/contracts';
import type { Vault } from '../../apps/desktop/electron/pilot/vault';
import type { Accounts } from '../../apps/desktop/electron/pilot/oauth';
const fake = vi.hoisted(() => ({ produce: vi.fn(), publishYouTube: vi.fn(), sendTikTokDraft: vi.fn(), checkYouTube: vi.fn(), checkTikTok: vi.fn() }));
vi.mock('../../apps/desktop/electron/pilot/engine', () => ({ produce: fake.produce }));
vi.mock('../../apps/desktop/electron/pilot/publishers', () => ({ publishYouTube: fake.publishYouTube, sendTikTokDraft: fake.sendTikTokDraft, checkYouTube: fake.checkYouTube, checkTikTok: fake.checkTikTok }));
const instances: PilotRuntime[] = [], folders: string[] = [];
afterEach(async () => { for (const r of instances.splice(0)) r.stop(); vi.resetAllMocks(); await Promise.all(folders.splice(0).map(p => rm(p, { recursive: true, force: true }))); });
async function setup(approved: boolean) {
  const folder = await mkdtemp(path.join(tmpdir(), 'clipforge-runtime-')); folders.push(folder);
  const vault = { load: async () => {}, credentials: () => ({ openaiApiKey: 'test-only' }), accounts: () => [{ id: 'youtube:one', platform: 'youtube', name: 'Test channel' }] } as unknown as Vault;
  const runtime = new PilotRuntime(new JobStore(path.join(folder, 'jobs.json')), vault, { token: async () => 'test-only' } as unknown as Accounts, () => {}); instances.push(runtime);
  fake.produce.mockResolvedValue({ approved, plan: { title: 'Teste', scenes: [] }, videoPath: path.join(folder, 'video.mp4'), digest: 'hash', quality: { gate: { passed: approved }, technical: { passed: approved } } });
  fake.publishYouTube.mockImplementation(async (_job, _post, deps) => { await deps.save({ status: 'processing', remoteId: 'remote' }); });
  await runtime.init();
  const input: StartPilotInput = { settings: { nicheId: 'terror-misterio', platforms: ['YouTube Shorts'], durationSeconds: 30, videosPerDay: 1, minimumQualityScore: 82, autoRetry: true, maxRetries: 3 }, outputDirectory: folder, scheduledAt: '2099-01-01T12:00:00Z', count: 1, autoPublishYouTube: true, privacy: 'public', madeForKids: false };
  return { runtime, input, folder };
}
describe('fluxo produção → aprovação → fila → adaptador', () => {
  it('despacha o aprovado exatamente uma vez', async () => {
    const { runtime, input } = await setup(true); await runtime.start(input);
    await vi.waitFor(() => expect(runtime.snapshot().jobs[0].publications[0].status).toBe('processing'));
    expect(fake.produce).toHaveBeenCalledTimes(1); expect(fake.publishYouTube).toHaveBeenCalledTimes(1);
  });
  it('mantém reprovado fora de todos os publicadores', async () => {
    const { runtime, input } = await setup(false); await runtime.start(input);
    await vi.waitFor(() => expect(runtime.snapshot().jobs[0].status).toBe('review'));
    expect(fake.publishYouTube).not.toHaveBeenCalled(); expect(fake.sendTikTokDraft).not.toHaveBeenCalled();
  });
  it('não duplica lote com dois cliques simultâneos', async () => {
    const { runtime, input } = await setup(true);
    const results = await Promise.allSettled([runtime.start(input), runtime.start(input)]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    await vi.waitFor(() => expect(runtime.snapshot().jobs[0].status).toBe('ready'));
    expect(runtime.snapshot().jobs).toHaveLength(1);
  });
  it('pausa um lote após falha do provedor sem consumir os outros vídeos', async () => {
    const { runtime, input } = await setup(true); fake.produce.mockRejectedValue(new Error('Crédito indisponível'));
    await runtime.start({ ...input, count: 7 });
    await vi.waitFor(() => expect(runtime.snapshot().jobs.every(j => j.status === 'failed')).toBe(true));
    expect(fake.produce).toHaveBeenCalledTimes(1); expect(fake.publishYouTube).not.toHaveBeenCalled();
  });
});
