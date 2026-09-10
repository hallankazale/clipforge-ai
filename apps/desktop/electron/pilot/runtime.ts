import { randomUUID } from 'node:crypto';
import { access, mkdir, statfs } from 'node:fs/promises';
import type { PilotJob, PilotSnapshot, StartPilotInput, Publication } from './contracts';
import { JobStore } from './store';
import { Vault } from './vault';
import { Accounts } from './oauth';
import { validateStart } from './validation';
import { produce } from './engine';
import { publishYouTube, sendTikTokDraft, checkYouTube, checkTikTok, type PublishDependencies } from './publishers';

export class PilotRuntime {
  private active = new Map<string, AbortController>();
  private pumping = false;
  private starting = false;
  private closing = false;
  private timer?: ReturnType<typeof setInterval>;
  constructor(readonly store: JobStore, readonly vault: Vault, readonly accounts: Accounts, private readonly notify: () => void) {}
  async init(): Promise<void> {
    await this.vault.load(); await this.store.load();
    this.timer = setInterval(() => { void this.pump(); }, 30_000);
    void this.pump();
  }
  snapshot(): PilotSnapshot {
    const c = this.vault.credentials();
    return { jobs: this.store.list().map(j => ({ ...j, publications: j.publications.map(({ sessionUrl: _secret, ...p }) => p) })).reverse(),
      accounts: this.vault.accounts().map(({ id, platform, name }) => ({ id, platform, name })), busy: this.active.size > 0,
      configured: { openai: !!c.openaiApiKey, youtube: !!c.youtubeClientId, tiktok: !!c.tiktokClientKey && !!c.tiktokClientSecret } };
  }
  async start(input: StartPilotInput): Promise<void> {
    if (this.starting) throw new Error('Criação de lote já em andamento.');
    this.starting = true;
    try {
    validateStart(input);
    if (!this.vault.credentials().openaiApiKey) throw new Error('Importe a chave da OpenAI para produzir vídeos.');
    if (this.store.list().some(j => j.status === 'queued' || j.status === 'generating')) throw new Error('Aguarde o lote atual terminar.');
    const accounts = this.vault.accounts();
    if (input.autoPublishYouTube && input.settings.platforms.includes('YouTube Shorts') && !accounts.some(a => a.platform === 'youtube')) throw new Error('Conecte uma conta do YouTube antes de ativar a publicação automática.');
    if (accounts.filter(a => a.platform === 'youtube').length > 1 || accounts.filter(a => a.platform === 'tiktok').length > 1) throw new Error('Mantenha uma conta por plataforma conectada para definir o destino sem ambiguidade.');
    await mkdir(input.outputDirectory, { recursive: true }); await access(input.outputDirectory);
    const disk = await statfs(input.outputDirectory);
    if (disk.bavail * disk.bsize < 2 * 1024 ** 3) throw new Error('Libere pelo menos 2 GB na pasta de saída.');
    const jobs: PilotJob[] = Array.from({ length: input.count }, (_, i) => {
      const date = new Date(input.scheduledAt);
      date.setDate(date.getDate() + Math.floor(i / input.settings.videosPerDay));
      date.setHours(date.getHours() + (i % input.settings.videosPerDay) * Math.floor(24 / input.settings.videosPerDay));
      return { id: randomUUID(), createdAt: new Date().toISOString(), scheduledAt: date.toISOString(), settings: structuredClone(input.settings),
        outputDirectory: input.outputDirectory, status: 'queued', stage: 'Na fila', attempt: 0, reports: [],
        autoPublishYouTube: input.autoPublishYouTube, privacy: input.privacy, madeForKids: input.madeForKids,
        publications: accounts.filter(a => input.settings.platforms.includes(a.platform === 'youtube' ? 'YouTube Shorts' : 'TikTok')).map(a => ({ accountId: a.id, platform: a.platform, status: 'waiting' })) };
    });
    await this.store.change(all => { all.push(...jobs); }); this.notify(); void this.pump();
    } finally { this.starting = false; }
  }
  private dependencies(id: string, accountId: string): PublishDependencies {
    return { token: id => this.accounts.token(id), save: async patch => {
      await this.store.update(id, j => { const p = j.publications.find(p => p.accountId === accountId); if (!p) throw new Error('Destino ausente.'); Object.assign(p, patch); }); this.notify();
    } };
  }
  private async publication(job: PilotJob, post: Publication, tiktok: boolean): Promise<void> {
    const controller = new AbortController(); this.active.set(job.id, controller);
    const deps = this.dependencies(job.id, post.accountId);
    try {
      await deps.save({ status: 'uploading', error: undefined });
      if (tiktok) await sendTikTokDraft(job, post, deps, controller.signal);
      else await publishYouTube(job, post, deps, controller.signal);
    } catch (e) {
      // Ambiguous outcomes are not resubmitted: prevent duplicate publications after timeouts.
      await deps.save({ status: 'uncertain', error: e instanceof Error ? e.message : 'Envio não confirmado.', retryCount: (post.retryCount || 0) + 1, nextAttemptAt: new Date(Date.now() + 60_000 * 2 ** (post.retryCount || 0)).toISOString() });
    } finally { this.active.delete(job.id); this.notify(); }
  }
  async sendTikTok(id: string): Promise<void> {
    if (this.active.has(id)) throw new Error('Aguarde a operação atual.');
    const job = this.store.get(id), post = job.publications.find(p => p.platform === 'tiktok');
    if (!post || post.status !== 'waiting') throw new Error('Não há um envio novo disponível para este vídeo.');
    await this.publication(job, post, true);
  }
  async cancel(id: string): Promise<void> {
    const job = this.store.get(id);
    if (this.active.has(id) && job.status === 'ready') throw new Error('Aguarde a confirmação do envio antes de cancelar.');
    if (job.publications.some(p => ['uploading', 'processing', 'scheduled', 'draft-sent', 'uncertain'].includes(p.status))) throw new Error('Este vídeo já tem um envio iniciado. Confira a plataforma para alterar ou cancelar a publicação.');
    this.active.get(id)?.abort();
    await this.store.update(id, j => { j.status = 'canceled'; j.stage = 'Cancelado'; }); this.notify();
  }
  private async pump(): Promise<void> {
    if (this.pumping || this.closing) return;
    this.pumping = true;
    try {
      for (const job of this.store.list()) {
        if (this.closing) break;
        for (const post of job.publications) {
          if (this.active.has(job.id)) continue;
          const deps = this.dependencies(job.id, post.accountId);
          if (['processing', 'uncertain'].includes(post.status) && post.remoteId) {
            try { if (post.platform === 'youtube') await checkYouTube(post, deps, job); else await checkTikTok(post, deps); }
            catch (e) { await deps.save({ error: e instanceof Error ? e.message : 'Consulta temporariamente indisponível.' }); }
          }
          if (job.status === 'ready' && post.platform === 'youtube' && post.status === 'uncertain' && post.sessionUrl && !post.remoteId && (post.retryCount || 0) < 3 && Date.parse(post.nextAttemptAt || '1970-01-01') <= Date.now()) await this.publication(job, post, false);
          if (job.status === 'ready' && job.autoPublishYouTube && post.platform === 'youtube' && post.status === 'waiting' &&
            (job.privacy === 'public' || Date.parse(job.scheduledAt) <= Date.now())) await this.publication(job, post, false);
        }
      }
      const job = this.store.list().find(j => j.status === 'queued');
      if (job && !this.closing) {
        const controller = new AbortController(); this.active.set(job.id, controller);
        try {
          await this.store.update(job.id, j => { j.status = 'generating'; }); this.notify();
          const history = this.store.list().flatMap(j => j.plan ? [j.plan] : []);
          const result = await produce(job, this.vault.credentials(), history, controller.signal, {
            stage: async (attempt, stage) => { await this.store.update(job.id, j => { j.attempt = attempt; j.stage = stage; }); this.notify(); },
            report: async report => { await this.store.update(job.id, j => { j.reports.push(report); j.quality = report; }); this.notify(); },
          });
          controller.signal.throwIfAborted();
          await this.store.update(job.id, j => { Object.assign(j, { plan: result.plan, videoPath: result.videoPath, digest: result.digest, quality: result.quality,
            status: result.approved ? 'ready' : 'review', stage: result.approved ? 'Aprovado para publicação' : 'Revisão necessária' }); });
        } catch (e) {
          await this.store.update(job.id, j => { if (j.status !== 'canceled') { j.status = 'failed'; j.error = e instanceof Error ? e.message : 'Falha de produção.'; } });
          // A provider or disk failure pauses the remaining batch instead of repeatedly spending on failures.
          if (!controller.signal.aborted) await this.store.change(jobs => { for (const pending of jobs.filter(j => j.status === 'queued')) { pending.status = 'failed'; pending.error = 'Lote pausado após falha. Corrija a causa antes de criar outro lote.'; } });
        } finally { this.active.delete(job.id); this.notify(); }
      }
    } catch (e) {
      // Surface persistence failures without resetting or silently losing the queue.
      console.error('Pilot worker stopped:', e instanceof Error ? e.message : 'Unexpected error');
      return;
    } finally { this.pumping = false; }
    if (!this.closing && this.store.list().some(j => j.status === 'queued' || (j.status === 'ready' && j.autoPublishYouTube && j.privacy === 'public' && j.publications.some(p => p.platform === 'youtube' && p.status === 'waiting')))) queueMicrotask(() => { void this.pump(); });
  }
  stop(): void { this.closing = true; if (this.timer) clearInterval(this.timer); for (const c of this.active.values()) c.abort(); }
}
