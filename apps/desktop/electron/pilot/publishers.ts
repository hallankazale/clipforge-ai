import { open, stat } from 'node:fs/promises';
import type { PilotJob, Publication } from './contracts';
import { request, jsonResponse, assertUploadHost } from './http';
import { digestFile } from './media';

export interface PublishDependencies {
  token(accountId: string): Promise<string>;
  save(patch: Partial<Publication>): Promise<void>;
}
export async function verifyPublishable(job: PilotJob): Promise<void> {
  if (job.status !== 'ready' || !job.videoPath || !job.digest || !job.quality?.gate.passed || !job.quality.technical.passed) throw new Error('Vídeo não aprovado para publicação.');
  if (await digestFile(job.videoPath) !== job.digest) throw new Error('Arquivo alterado após a avaliação. Publicação bloqueada.');
}
export function youtubeMetadata(job: PilotJob): unknown {
  if (!job.plan || (job.privacy === 'public' && Date.parse(job.scheduledAt) < Date.now() + 120_000)) throw new Error('O horário ficou próximo ou passou. Gere um novo plano de publicação.');
  return {
    snippet: { title: job.plan.title, description: `${job.plan.description}\n\n${job.plan.hashtags.join(' ')}\n\nImagens e voz geradas por IA.${job.plan.fiction ? ' História de ficção.' : ''}`, categoryId: '22' },
    status: { privacyStatus: job.privacy === 'public' ? 'private' : job.privacy, ...(job.privacy === 'public' ? { publishAt: job.scheduledAt } : {}), selfDeclaredMadeForKids: job.madeForKids, containsSyntheticMedia: true },
  };
}
export async function publishYouTube(job: PilotJob, post: Publication, deps: PublishDependencies, signal: AbortSignal): Promise<void> {
  await verifyPublishable(job);
  const token = await deps.token(post.accountId);
  const size = (await stat(job.videoPath!)).size;
  let session = post.sessionUrl;
  if (!session) {
    const response = await request('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
      method: 'POST', signal, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Upload-Content-Type': 'video/mp4', 'X-Upload-Content-Length': String(size) }, body: JSON.stringify(youtubeMetadata(job)),
    });
    if (!response.ok) await jsonResponse(response);
    session = response.headers.get('location') || undefined;
    if (!session) throw new Error('YouTube não retornou uma sessão de upload.');
    assertUploadHost(session, ['www.googleapis.com']);
    // Persist the session before sending bytes: an interrupted upload must never create a second video.
    await deps.save({ sessionUrl: session });
  }
  assertUploadHost(session, ['www.googleapis.com']);
  const headers = { Authorization: `Bearer ${token}` };
  let response = await request(session, { method: 'PUT', signal, headers: { ...headers, 'Content-Length': '0', 'Content-Range': `bytes */${size}` } });
  const file = await open(job.videoPath!, 'r');
  try {
    while (response.status === 308) {
      signal.throwIfAborted();
      const range = response.headers.get('range');
      const match = range?.match(/^bytes=0-(\d+)$/);
      if (range && !match) throw new Error('YouTube retornou um intervalo inválido.');
      const start = match ? Number(match[1]) + 1 : 0;
      if (start >= size) throw new Error('Confirmação do upload pendente.');
      const length = Math.min(8 * 1024 * 1024, size - start);
      const buffer = Buffer.alloc(length); const { bytesRead } = await file.read(buffer, 0, length, start);
      if (bytesRead !== length) throw new Error('O vídeo mudou durante o upload.');
      response = await request(session, { method: 'PUT', signal, headers: { ...headers, 'Content-Type': 'video/mp4', 'Content-Length': String(length), 'Content-Range': `bytes ${start}-${start + length - 1}/${size}` }, body: new Uint8Array(buffer) }, 120_000);
    }
    const result = await jsonResponse<{ id?: string }>(response);
    if (!result.id) throw new Error('YouTube não confirmou o ID do vídeo.');
    await deps.save({ remoteId: result.id, status: 'processing', error: undefined, sessionUrl: undefined });
  } finally { await file.close(); }
}
export async function checkYouTube(post: Publication, deps: PublishDependencies, job?: PilotJob): Promise<void> {
  const token = await deps.token(post.accountId);
  const response = await jsonResponse<any>(await request(`https://www.googleapis.com/youtube/v3/videos?part=status,processingDetails&id=${encodeURIComponent(post.remoteId!)}`, { headers: { Authorization: `Bearer ${token}` } }));
  const item = response.items?.[0];
  if (!item) throw new Error('Vídeo enviado não encontrado na conta.');
  const status = item.processingDetails?.processingStatus;
  if (['failed', 'terminated'].includes(status) || ['failed', 'rejected', 'deleted'].includes(item.status?.uploadStatus)) await deps.save({ status: 'failed', error: 'A plataforma não aprovou o processamento.' });
  else if (status === 'succeeded' || item.status?.uploadStatus === 'processed') {
    if (job?.privacy === 'public' && item.status?.privacyStatus !== 'public' && !item.status?.publishAt) {
      await deps.save({ status: 'failed', error: 'O YouTube manteve o vídeo privado sem agendamento. Verifique a aprovação do projeto de API.' });
    } else await deps.save({ status: 'scheduled', error: undefined });
  }
}
/** TikTok inbox uploads require a per-video user action; publishing is completed in the TikTok app. */
export async function sendTikTokDraft(job: PilotJob, post: Publication, deps: PublishDependencies, signal: AbortSignal): Promise<void> {
  await verifyPublishable(job);
  const token = await deps.token(post.accountId), size = (await stat(job.videoPath!)).size;
  if (size > 64 * 1024 * 1024) throw new Error('Vídeo excede 64 MB para este envio. Reduza o tamanho.');
  const result = await jsonResponse<any>(await request('https://open.tiktokapis.com/v2/post/publish/inbox/video/init/', {
    method: 'POST', signal, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ source_info: { source: 'FILE_UPLOAD', video_size: size, chunk_size: size, total_chunk_count: 1 } }),
  }));
  if (result.error?.code !== 'ok' || !result.data?.publish_id || !result.data?.upload_url) throw new Error('TikTok recusou o envio. Confira permissões e limite diário.');
  const url = result.data.upload_url;
  assertUploadHost(url, ['open-upload.tiktokapis.com']);
  await deps.save({ remoteId: result.data.publish_id });
  const file = await open(job.videoPath!, 'r');
  try {
    const buffer = await file.readFile();
    const response = await request(url, { method: 'PUT', signal, headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(size), 'Content-Range': `bytes 0-${size - 1}/${size}` }, body: new Uint8Array(buffer) });
    if (!response.ok) await jsonResponse(response);
    await deps.save({ status: 'processing' });
  } finally { await file.close(); }
}
export async function checkTikTok(post: Publication, deps: PublishDependencies): Promise<void> {
  const token = await deps.token(post.accountId);
  const result = await jsonResponse<any>(await request('https://open.tiktokapis.com/v2/post/publish/status/fetch/', {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ publish_id: post.remoteId }),
  }));
  if (result.error?.code !== 'ok') throw new Error('Não foi possível consultar o envio ao TikTok.');
  if (['SEND_TO_USER_INBOX', 'PUBLISH_COMPLETE'].includes(result.data?.status)) await deps.save({ status: 'draft-sent' });
  else if (result.data?.status === 'FAILED') await deps.save({ status: 'failed', error: 'TikTok rejeitou o processamento do vídeo.' });
}
