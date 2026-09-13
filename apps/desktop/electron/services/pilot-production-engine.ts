import { app } from 'electron';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { decideProductionAfterQualityGate } from '../core/production';
import { evaluateQualityGate, type QualityAction, type QualityMetrics } from '../core/quality';
import {
  scoreCaptionReadability,
  scorePacing,
  scorePlatformFit,
  scoreVoiceClarity,
} from '../core/pilot-metrics';
import {
  evaluatePilotCreativeQuality,
  generatePilotContentPlan,
  generatePilotNarration,
  generatePilotSceneImage,
  transcribePilotNarration,
  type CreativeQualityScores,
  type PilotContentPlan,
} from './openai-pilot-provider';
import { renderPilotVerticalVideo, writePilotSrt } from './pilot-media-engine';
import { getPilotQueueItem, updatePilotQueueItem } from './pilot-queue';
import { readOpenAiApiKey } from './secure-secrets';
import { probeVideo } from './video-engine';

export type PilotProductionStage =
  | 'preparing'
  | 'script'
  | 'visuals'
  | 'voice'
  | 'editing'
  | 'quality'
  | 'retrying'
  | 'ready'
  | 'manual-review'
  | 'failed'
  | 'canceled';

export interface PilotProductionProgress {
  queueItemId: string;
  stage: PilotProductionStage;
  percent: number;
  message: string;
  detail?: string;
  timestamp: string;
}

export interface PilotProductionResult {
  queueItemId: string;
  status: 'ready-to-publish' | 'manual-review';
  outputPath: string;
  workspacePath: string;
  qualityScore: number;
  attempt: number;
  title: string;
}

interface RunPilotInput {
  queueItemId: string;
  signal: AbortSignal;
  onProgress: (progress: PilotProductionProgress) => void;
}

function emit(
  input: RunPilotInput,
  stage: PilotProductionStage,
  percent: number,
  message: string,
  detail?: string,
): void {
  input.onProgress({
    queueItemId: input.queueItemId,
    stage,
    percent: Math.min(100, Math.max(0, Math.round(percent))),
    message,
    detail,
    timestamp: new Date().toISOString(),
  });
}

function assertRunning(signal: AbortSignal): void {
  if (signal.aborted) throw new Error('PILOT_CANCELED');
}

function shouldRegeneratePlan(actions: QualityAction[]): boolean {
  return actions.some((action) => [
    'rewrite-hook',
    'rewrite-script',
    'retime-edit',
    'regenerate-captions',
    'diversify-concept',
    'adjust-platform-format',
  ].includes(action));
}

function buildMetrics(input: {
  creative: CreativeQualityScores;
  plan: PilotContentPlan;
  transcript: string;
  metadata: Awaited<ReturnType<typeof probeVideo>>;
  targetDurationSeconds: number;
}): QualityMetrics {
  return {
    hook: input.creative.hook,
    storytelling: input.creative.storytelling,
    visualConsistency: input.creative.visualConsistency,
    pacing: scorePacing(input.plan.script, input.metadata.durationSeconds),
    voiceClarity: scoreVoiceClarity(input.plan.script, input.transcript),
    captionReadability: scoreCaptionReadability(input.plan.scenes),
    originality: input.creative.originality,
    platformFit: scorePlatformFit(input.metadata, input.targetDurationSeconds),
  };
}

async function saveJson(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, JSON.stringify(value, null, 2), 'utf8');
}

export async function runPilotProduction(input: RunPilotInput): Promise<PilotProductionResult> {
  const queueItem = await getPilotQueueItem(input.queueItemId);
  if (!queueItem) throw new Error('Item da fila do Piloto IA não encontrado.');

  const apiKey = await readOpenAiApiKey();
  if (!apiKey) throw new Error('Configure a chave da OpenAI no Piloto IA antes de gerar vídeos.');

  const workspacePath = path.join(
    app.getPath('videos'),
    'ClipForge AI',
    'Pilot',
    input.queueItemId,
  );
  await mkdir(workspacePath, { recursive: true });
  await updatePilotQueueItem(input.queueItemId, {
    status: 'processing',
    workspacePath,
    error: undefined,
  });

  let plan: PilotContentPlan | undefined;
  let imagePaths: string[] = [];
  let narrationPath: string | undefined;
  let creativeScores: CreativeQualityScores | undefined;
  let correctiveActions: QualityAction[] = [];
  let regeneratePlan = true;
  let regenerateImages = true;
  let regenerateVoice = true;

  try {
    for (let attempt = 1; attempt <= queueItem.settings.maxRetries; attempt += 1) {
      assertRunning(input.signal);
      const attemptPath = path.join(workspacePath, `attempt-${String(attempt).padStart(2, '0')}`);
      await mkdir(attemptPath, { recursive: true });
      await updatePilotQueueItem(input.queueItemId, { attempt });

      if (regeneratePlan || !plan) {
        emit(input, 'script', 8, `Criando roteiro e storyboard — tentativa ${attempt}...`);
        plan = await generatePilotContentPlan({
          apiKey,
          settings: queueItem.settings,
          previousPlan: plan,
          correctiveActions,
          signal: input.signal,
        });
        await saveJson(path.join(attemptPath, 'plan.json'), plan);
        regenerateImages = true;
        regenerateVoice = true;
        creativeScores = undefined;
      }

      assertRunning(input.signal);
      if (regenerateImages || imagePaths.length !== plan.scenes.length) {
        imagePaths = [];
        emit(input, 'visuals', 20, `Gerando ${plan.scenes.length} cenas visuais...`);
        for (let index = 0; index < plan.scenes.length; index += 1) {
          assertRunning(input.signal);
          const scene = plan.scenes[index];
          const image = await generatePilotSceneImage({
            apiKey,
            prompt: scene.visualPrompt,
            visualStyle: queueItem.settings.niche.visualStyle,
            signal: input.signal,
          });
          const imagePath = path.join(attemptPath, `scene-${String(index + 1).padStart(2, '0')}.png`);
          await writeFile(imagePath, image);
          imagePaths.push(imagePath);
          emit(
            input,
            'visuals',
            20 + ((index + 1) / plan.scenes.length) * 30,
            `Cena ${index + 1}/${plan.scenes.length} concluída.`,
          );
        }
        creativeScores = undefined;
      }

      assertRunning(input.signal);
      if (regenerateVoice || !narrationPath) {
        emit(input, 'voice', 54, 'Gerando narração natural em português...');
        const narration = await generatePilotNarration({
          apiKey,
          text: plan.script,
          signal: input.signal,
        });
        narrationPath = path.join(attemptPath, 'narration.mp3');
        await writeFile(narrationPath, narration);
      }

      const captionsPath = path.join(attemptPath, 'captions.srt');
      await writePilotSrt(plan.scenes, captionsPath);
      const outputPath = path.join(attemptPath, 'clipforge-final.mp4');

      emit(input, 'editing', 62, 'Montando vídeo vertical, áudio e legendas...');
      await renderPilotVerticalVideo({
        scenes: plan.scenes,
        imagePaths,
        narrationPath,
        captionsPath,
        outputPath,
        signal: input.signal,
      });

      assertRunning(input.signal);
      emit(input, 'quality', 75, 'Validando qualidade técnica e criativa...');
      const [metadata, transcript, creative] = await Promise.all([
        probeVideo(outputPath),
        transcribePilotNarration({ apiKey, audioPath: narrationPath, signal: input.signal }),
        creativeScores
          ? Promise.resolve(creativeScores)
          : evaluatePilotCreativeQuality({
              apiKey,
              plan,
              imagePaths,
              signal: input.signal,
            }),
      ]);
      creativeScores = creative;

      const metrics = buildMetrics({
        creative,
        plan,
        transcript,
        metadata,
        targetDurationSeconds: queueItem.settings.durationSeconds,
      });
      const quality = evaluateQualityGate(metrics, queueItem.settings.minimumQualityScore);
      await saveJson(path.join(attemptPath, 'quality.json'), { metrics, quality, metadata });
      await saveJson(path.join(attemptPath, 'publication.json'), {
        title: plan.title,
        description: plan.description,
        hashtags: plan.hashtags,
        platforms: queueItem.settings.platforms,
      });

      const decision = decideProductionAfterQualityGate({
        quality,
        currentAttempt: attempt,
        maxRetries: queueItem.settings.maxRetries,
        autoRetry: queueItem.settings.autoRetry,
      });

      if (decision.status === 'approved') {
        await updatePilotQueueItem(input.queueItemId, {
          status: 'ready-to-publish',
          title: plan.title,
          outputPath,
          workspacePath,
          qualityScore: quality.score,
          attempt,
          error: undefined,
        });
        emit(input, 'ready', 100, `Vídeo aprovado com nota ${quality.score}/100.`, outputPath);
        return {
          queueItemId: input.queueItemId,
          status: 'ready-to-publish',
          outputPath,
          workspacePath,
          qualityScore: quality.score,
          attempt,
          title: plan.title,
        };
      }

      if (decision.status === 'manual-review') {
        await updatePilotQueueItem(input.queueItemId, {
          status: 'manual-review',
          title: plan.title,
          outputPath,
          workspacePath,
          qualityScore: quality.score,
          attempt,
          error: decision.reason,
        });
        emit(input, 'manual-review', 100, `Revisão manual necessária — nota ${quality.score}/100.`, decision.reason);
        return {
          queueItemId: input.queueItemId,
          status: 'manual-review',
          outputPath,
          workspacePath,
          qualityScore: quality.score,
          attempt,
          title: plan.title,
        };
      }

      correctiveActions = decision.actions;
      regeneratePlan = shouldRegeneratePlan(correctiveActions);
      regenerateImages = regeneratePlan || correctiveActions.includes('regenerate-visuals');
      regenerateVoice = regeneratePlan || correctiveActions.includes('regenerate-voice');
      if (!regenerateImages) creativeScores = creative;
      emit(
        input,
        'retrying',
        88,
        `Quality Gate pediu correção seletiva antes da tentativa ${decision.nextAttempt}.`,
        correctiveActions.join(', '),
      );
    }

    throw new Error('O motor encerrou sem uma decisão final de qualidade.');
  } catch (error) {
    const canceled = input.signal.aborted || (error instanceof Error && error.message === 'PILOT_CANCELED');
    const message = canceled
      ? 'Produção cancelada pelo usuário.'
      : error instanceof Error
        ? error.message
        : 'Falha inesperada no Piloto IA.';
    await updatePilotQueueItem(input.queueItemId, {
      status: canceled ? 'canceled' : 'failed',
      workspacePath,
      error: message,
    });
    emit(input, canceled ? 'canceled' : 'failed', 100, message);
    throw canceled ? new Error('PILOT_CANCELED') : new Error(message);
  }
}
