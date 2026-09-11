import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { publishYouTube, verifyPublishable, checkYouTube } from '../../apps/desktop/electron/pilot/publishers';
import type { PilotJob, Publication } from '../../apps/desktop/electron/pilot/contracts';
const folders: string[] = [];
afterEach(async () => { vi.unstubAllGlobals(); await Promise.all(folders.splice(0).map(p => rm(p, { recursive: true, force: true }))); });
async function fixture() {
  const folder = await mkdtemp(path.join(tmpdir(), 'clipforge-upload-')); folders.push(folder);
  const bytes = Buffer.from('video-file-for-transport-test'); const file = path.join(folder, 'video.mp4'); await writeFile(file, bytes);
  const job = { id: 'job', status: 'ready', videoPath: file, digest: createHash('sha256').update(bytes).digest('hex'), quality: { gate: { passed: true }, technical: { passed: true } }, plan: { title: 'Título', description: 'Descrição', hashtags: [], fiction: true }, scheduledAt: '2099-01-01T00:00:00Z', privacy: 'public', madeForKids: false } as unknown as PilotJob;
  return { job, bytes };
}
describe('publicação sem duplicatas e sem aprovação fictícia', () => {
  it('bloqueia arquivo modificado depois da avaliação', async () => {
    const { job } = await fixture(); await writeFile(job.videoPath!, 'changed');
    await expect(verifyPublishable(job)).rejects.toThrow('alterado');
  });
  it('retoma uma sessão existente sem criar outro vídeo e usa o offset confirmado', async () => {
    const { job, bytes } = await fixture(); const calls: Array<{ url: string; init: RequestInit }> = [];
    vi.stubGlobal('fetch', vi.fn(async (url, init) => { calls.push({ url, init }); return calls.length === 1 ? new Response(null, { status: 308, headers: { Range: 'bytes=0-3' } }) : Response.json({ id: 'remote-video' }); }));
    const save = vi.fn(async () => {});
    await publishYouTube(job, { accountId: 'youtube:one', platform: 'youtube', status: 'uncertain', sessionUrl: 'https://www.googleapis.com/existing' }, { token: async () => 'test-token', save }, new AbortController().signal);
    expect(calls).toHaveLength(2); expect(calls.every(c => c.init.method === 'PUT')).toBe(true);
    expect((calls[1].init.headers as Record<string, string>)['Content-Range']).toBe(`bytes 4-${bytes.length - 1}/${bytes.length}`);
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ remoteId: 'remote-video', status: 'processing' }));
  });
  it('registra a sessão antes de enviar o arquivo', async () => {
    const { job } = await fixture(); const order: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => { order.push(init.method); return init.method === 'POST' ? new Response(null, { status: 200, headers: { location: 'https://www.googleapis.com/session' } }) : Response.json({ id: 'already-complete' }); }));
    await publishYouTube(job, { accountId: 'youtube:one', platform: 'youtube', status: 'waiting' }, { token: async () => 'test', save: async patch => { if (patch.sessionUrl) order.push('persist-session'); } }, new AbortController().signal);
    expect(order).toEqual(['POST', 'persist-session', 'PUT']);
  });
  it('não cria sessão nova se a antiga expirou', async () => {
    const { job } = await fixture(); const fetchMock = vi.fn(async () => new Response(null, { status: 404 })); vi.stubGlobal('fetch', fetchMock);
    await expect(publishYouTube(job, { accountId: 'youtube:one', platform: 'youtube', status: 'uncertain', sessionUrl: 'https://www.googleapis.com/existing' }, { token: async () => 'test', save: async () => {} }, new AbortController().signal)).rejects.toThrow('404');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('não chama vídeo privado por restrição da API de agendado público', async () => {
    const { job } = await fixture(); vi.stubGlobal('fetch', vi.fn(async () => Response.json({ items: [{ status: { privacyStatus: 'private', uploadStatus: 'processed' }, processingDetails: { processingStatus: 'succeeded' } }] })));
    const save = vi.fn(async () => {});
    await checkYouTube({ accountId: 'youtube:one', remoteId: 'video' } as Publication, { token: async () => 'test', save }, job);
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }));
  });
});
