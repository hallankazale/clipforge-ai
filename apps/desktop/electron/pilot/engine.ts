import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { PilotJob, QualityReport, VideoPlan, Word } from './contracts';
import type { QualityAction } from './quality';
import { evaluateQualityGate } from './quality';
import { decideProductionAfterQualityGate } from './production';
import { OpenAIProducer } from './ai';
import { compose, digestFile, ffmpeg, inspectVideo, mediaProbe } from './media';
import type { Credentials } from './vault';

export function retryComponents(actions: QualityAction[]): { script: boolean; images: boolean; voice: boolean; captions: boolean } {
  const script = actions.some(a => ['rewrite-hook', 'rewrite-script', 'diversify-concept', 'retime-edit'].includes(a));
  return { script, images: script || actions.includes('regenerate-visuals'), voice: script || actions.includes('regenerate-voice'), captions: script || actions.includes('regenerate-voice') || actions.includes('regenerate-captions') };
}
/** Align scene boundaries to the spoken transcript, rather than equally dividing the video. */
export function sceneTimings(plan: VideoPlan, words: Word[], duration: number): number[] {
  const counts = plan.scenes.map(s => s.narration.match(/[\p{L}\p{N}]+/gu)?.length || 1);
  const total = counts.reduce((a, b) => a + b, 0);
  let cumulative = 0;
  const boundaries = [0];
  for (const count of counts.slice(0, -1)) {
    cumulative += count;
    const index = Math.min(words.length - 1, Math.round(cumulative / total * words.length));
    boundaries.push(Math.min(duration - 0.1, Math.max(boundaries.at(-1)! + 0.1, words[index].start)));
  }
  boundaries.push(duration);
  return counts.map((_, i) => boundaries[i + 1] - boundaries[i]);
}
export interface ProductionHooks {
  stage(attempt: number, stage: string): Promise<void>;
  report(report: QualityReport): Promise<void>;
}
export interface ProductionOutput { plan: VideoPlan; videoPath: string; digest: string; quality: QualityReport; approved: boolean }
export async function produce(job: PilotJob, credentials: Credentials, history: VideoPlan[], signal: AbortSignal, hooks: ProductionHooks): Promise<ProductionOutput> {
  const ai = new OpenAIProducer(credentials, signal);
  const base = path.join(job.outputDirectory, 'Piloto', job.id);
  let plan: VideoPlan | undefined, images: string[] = [], voice = '', words: Word[] = [];
  let actions: QualityAction[] = [], feedback = '';
  const max = job.settings.autoRetry ? job.settings.maxRetries : 1;
  for (let attempt = 1; attempt <= max; attempt++) {
    signal.throwIfAborted();
    const directory = path.join(base, `attempt-${attempt}`); await mkdir(directory, { recursive: true });
    const components = retryComponents(actions), initial = attempt === 1;
    if (initial || components.script || actions.includes('regenerate-visuals')) {
      await hooks.stage(attempt, 'Criando roteiro e storyboard');
      const previous = plan;
      plan = await ai.plan(job.settings, history.map(p => p.title), plan, actions, feedback);
      // Any narration change invalidates dependent voice and subtitles, even on a visual-only retry.
      if (previous && JSON.stringify(previous.scenes.map(s => s.narration)) !== JSON.stringify(plan.scenes.map(s => s.narration))) { components.voice = true; components.captions = true; }
    }
    if (!plan) throw new Error('Roteiro ausente.');
    const narration = plan.scenes.map(s => s.narration).join(' ');
    await writeFile(path.join(directory, 'storyboard.json'), JSON.stringify(plan, null, 2));
    if (initial || components.voice) {
      await hooks.stage(attempt, 'Gerando narração original');
      const originalVoice = path.join(directory, 'voice-original.mp3');
      await ai.voice(narration, originalVoice);
      const probe = await mediaProbe(originalVoice, signal);
      const actual = Number(probe.format?.duration), ratio = actual / job.settings.durationSeconds;
      if (!Number.isFinite(ratio) || ratio < 0.75 || ratio > 1.35) {
        feedback = `Narração durou ${actual.toFixed(1)}s; alvo ${job.settings.durationSeconds}s. Ajuste número de palavras mantendo ritmo natural.`;
        if (attempt === max) throw new Error(feedback);
        actions = ['rewrite-script']; continue;
      }
      voice = path.join(directory, 'voice.mp3');
      await ffmpeg(['-i', originalVoice, '-af', `atempo=${ratio}`, '-c:a', 'libmp3lame', '-b:a', '192k', voice], directory, signal);
    }
    if (initial || components.captions) {
      await hooks.stage(attempt, 'Sincronizando legendas com a voz'); words = await ai.transcribe(voice);
    }
    if (initial || components.images || !images.length) {
      images = [];
      for (let i = 0; i < plan.scenes.length; i++) {
        await hooks.stage(attempt, `Criando cena ${i + 1} de ${plan.scenes.length}`);
        const file = path.join(directory, `image-${i}.png`);
        await ai.image(`Identidade visual: ${plan.style}\nCena: ${plan.scenes[i].visual}\nRetrato. Sem texto, logotipos ou marcas d'água. Composição cinematográfica.`, file); images.push(file);
      }
    }
    await hooks.stage(attempt, 'Renderizando vídeo vertical e legendas');
    const videoPath = await compose(directory, images, voice, words, job.settings.durationSeconds, signal, sceneTimings(plan, words, job.settings.durationSeconds));
    await hooks.stage(attempt, 'Inspecionando áudio, imagem e conteúdo');
    const { technical, frames } = await inspectVideo(videoPath, words, narration, job.settings.durationSeconds, signal);
    const editorial = await ai.review(plan, frames, { technical, transcript: words, recentVideos: history.map(p => ({ title: p.title, narration: p.scenes.map(s => s.narration).join(' ') })) });
    const duplicate = history.some(p => p.title.toLocaleLowerCase().trim() === plan!.title.toLocaleLowerCase().trim());
    if (duplicate) editorial.metrics.originality = 0;
    if (!technical.passed) {
      // Route measured defects to the component that can repair them, not a generic re-render.
      if (technical.issues.some(i => i.includes('Formato'))) editorial.metrics.platformFit = 0;
      if (technical.issues.some(i => i.includes('Duração'))) editorial.metrics.pacing = 0;
      if (technical.issues.some(i => i.includes('preto'))) editorial.metrics.visualConsistency = 0;
      if (technical.transcriptSimilarity < 0.85 || technical.issues.some(i => i.includes('Volume') || i.includes('silêncio'))) editorial.metrics.voiceClarity = 0;
      if (technical.issues.some(i => i.includes('legendas'))) editorial.metrics.captionReadability = 0;
    }
    const gate = evaluateQualityGate(editorial.metrics, job.settings.minimumQualityScore);
    if (!technical.passed) gate.passed = false;
    if (editorial.factualConcerns) {
      gate.passed = false;
      gate.issues.push({ metric: 'storytelling', score: 0, minimum: 68, action: 'rewrite-script', message: 'Afirmações ou referências exigem revisão factual.' });
      gate.nextActions = [...new Set([...gate.nextActions, 'rewrite-script' as QualityAction])];
    }
    const quality: QualityReport = { gate, metrics: editorial.metrics, technical, evidence: [...editorial.evidence, ...technical.issues, ...(duplicate ? ['Título repetido no histórico.'] : [])], assessedAt: new Date().toISOString() };
    await writeFile(path.join(directory, 'quality.json'), JSON.stringify(quality, null, 2)); await hooks.report(quality);
    const decision = decideProductionAfterQualityGate({ quality: gate, currentAttempt: attempt, maxRetries: job.settings.maxRetries, autoRetry: job.settings.autoRetry });
    if (decision.status !== 'retry') {
      await writeFile(path.join(directory, 'publicacao.txt'), `${plan.title}\n\n${plan.description}\n\n${plan.hashtags.join(' ')}\n\nImagens e narração geradas por IA.${plan.fiction ? ' História de ficção.' : ''}`);
      return { plan, videoPath, digest: await digestFile(videoPath), quality, approved: decision.status === 'approved' && technical.passed };
    }
    actions = decision.actions; feedback = quality.evidence.join('\n');
  }
  throw new Error('Limite de produção atingido.');
}
