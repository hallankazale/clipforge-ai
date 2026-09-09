import { spawn } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import ffmpegPath from 'ffmpeg-static';
import { probeVideo, type VideoMetadata } from './video-engine';

export type AnalysisStage =
  | 'preparing'
  | 'audio'
  | 'frames'
  | 'finalizing'
  | 'completed'
  | 'canceled';

export interface AnalysisProgress {
  jobId: string;
  stage: AnalysisStage;
  percent: number;
  message: string;
  detail?: string;
  timestamp: string;
  workspacePath: string;
}

export interface AnalysisResult {
  jobId: string;
  workspacePath: string;
  audioPath: string | null;
  framesDirectory: string;
  frameIntervalSeconds: number;
  metadata: VideoMetadata;
}

export interface AnalysisPipelineInput {
  jobId: string;
  filePath: string;
  outputPath: string;
  signal: AbortSignal;
  onProgress: (progress: AnalysisProgress) => void;
}

interface FfmpegProgressOptions {
  jobId: string;
  stage: AnalysisStage;
  message: string;
  workspacePath: string;
  durationSeconds: number;
  startPercent: number;
  endPercent: number;
  signal: AbortSignal;
  onProgress: (progress: AnalysisProgress) => void;
}

const FRAME_INTERVAL_SECONDS = 10;

function nowIso(): string {
  return new Date().toISOString();
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function parseProgressSeconds(line: string): number | null {
  const [key, rawValue] = line.trim().split('=', 2);
  if (!key || !rawValue) return null;

  if (key === 'out_time_us' || key === 'out_time_ms') {
    const microseconds = Number(rawValue);
    if (!Number.isFinite(microseconds)) return null;
    return microseconds / 1_000_000;
  }

  if (key === 'out_time') {
    const match = /^(\d+):(\d+):(\d+(?:\.\d+)?)$/.exec(rawValue);
    if (!match) return null;

    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    const seconds = Number(match[3]);
    if (![hours, minutes, seconds].every(Number.isFinite)) return null;

    return hours * 3600 + minutes * 60 + seconds;
  }

  return null;
}

export function mapStageProgress(
  elapsedSeconds: number,
  durationSeconds: number,
  startPercent: number,
  endPercent: number,
): number {
  if (durationSeconds <= 0) return startPercent;
  const ratio = clamp(elapsedSeconds / durationSeconds, 0, 1);
  return Math.round(startPercent + ratio * (endPercent - startPercent));
}

function emitProgress(
  onProgress: AnalysisPipelineInput['onProgress'],
  progress: Omit<AnalysisProgress, 'timestamp'>,
): void {
  onProgress({ ...progress, timestamp: nowIso() });
}

async function runFfmpeg(
  args: string[],
  options: FfmpegProgressOptions,
): Promise<void> {
  const binaryPath = ffmpegPath;
  if (!binaryPath) {
    throw new Error('O binário do FFmpeg não foi encontrado nesta instalação.');
  }

  await new Promise<void>((resolve, reject) => {
    const child = spawn(binaryPath, args, {
      windowsHide: true,
      shell: false,
      signal: options.signal,
    });

    let stdoutBuffer = '';
    let stderrTail = '';
    let settled = false;

    const settleResolve = (): void => {
      if (settled) return;
      settled = true;
      resolve();
    };

    const settleReject = (error: Error): void => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdoutBuffer += chunk;
      const lines = stdoutBuffer.split(/\r?\n/);
      stdoutBuffer = lines.pop() ?? '';

      for (const line of lines) {
        const elapsedSeconds = parseProgressSeconds(line);
        if (elapsedSeconds === null) continue;

        emitProgress(options.onProgress, {
          jobId: options.jobId,
          stage: options.stage,
          percent: mapStageProgress(
            elapsedSeconds,
            options.durationSeconds,
            options.startPercent,
            options.endPercent,
          ),
          message: options.message,
          detail: `${Math.round(elapsedSeconds)}s de ${Math.round(options.durationSeconds)}s`,
          workspacePath: options.workspacePath,
        });
      }
    });

    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => {
      stderrTail = `${stderrTail}${chunk}`.slice(-8_000);
    });

    child.on('error', (error: Error) => {
      if (options.signal.aborted || error.name === 'AbortError') {
        settleReject(new Error('ANALYSIS_CANCELED'));
        return;
      }
      settleReject(error);
    });

    child.on('close', (code: number | null) => {
      if (options.signal.aborted) {
        settleReject(new Error('ANALYSIS_CANCELED'));
        return;
      }

      if (code === 0) {
        settleResolve();
        return;
      }

      settleReject(
        new Error(
          `FFmpeg encerrou com código ${code ?? 'desconhecido'}. ${stderrTail.trim()}`.trim(),
        ),
      );
    });
  });
}

export async function runAnalysisPipeline(
  input: AnalysisPipelineInput,
): Promise<AnalysisResult> {
  if (!path.isAbsolute(input.filePath)) {
    throw new Error('O caminho do vídeo precisa ser absoluto.');
  }
  if (!path.isAbsolute(input.outputPath)) {
    throw new Error('A pasta de saída precisa ser um caminho absoluto.');
  }

  const workspacePath = path.join(
    input.outputPath,
    '_ClipForge',
    'analises',
    input.jobId,
  );
  const framesDirectory = path.join(workspacePath, 'frames');
  const audioPath = path.join(workspacePath, 'audio-16khz.wav');

  try {
    emitProgress(input.onProgress, {
      jobId: input.jobId,
      stage: 'preparing',
      percent: 2,
      message: 'Validando vídeo e preparando pasta de trabalho...',
      detail: input.filePath,
      workspacePath,
    });

    const metadata = await probeVideo(input.filePath);
    await mkdir(framesDirectory, { recursive: true });

    emitProgress(input.onProgress, {
      jobId: input.jobId,
      stage: 'preparing',
      percent: 8,
      message: 'Vídeo validado. Preparando extração de mídia...',
      detail: `${metadata.width ?? '?'} × ${metadata.height ?? '?'} · ${Math.round(metadata.durationSeconds)}s`,
      workspacePath,
    });

    let generatedAudioPath: string | null = null;

    if (metadata.audioCodec) {
      emitProgress(input.onProgress, {
        jobId: input.jobId,
        stage: 'audio',
        percent: 10,
        message: 'Extraindo áudio para futura transcrição...',
        detail: 'Mono · 16 kHz · WAV',
        workspacePath,
      });

      await runFfmpeg(
        [
          '-hide_banner',
          '-y',
          '-i',
          input.filePath,
          '-vn',
          '-ac',
          '1',
          '-ar',
          '16000',
          '-c:a',
          'pcm_s16le',
          '-progress',
          'pipe:1',
          '-nostats',
          audioPath,
        ],
        {
          jobId: input.jobId,
          stage: 'audio',
          message: 'Extraindo áudio...',
          workspacePath,
          durationSeconds: metadata.durationSeconds,
          startPercent: 10,
          endPercent: 52,
          signal: input.signal,
          onProgress: input.onProgress,
        },
      );

      generatedAudioPath = audioPath;
    } else {
      emitProgress(input.onProgress, {
        jobId: input.jobId,
        stage: 'audio',
        percent: 52,
        message: 'O vídeo não possui faixa de áudio. Etapa ignorada.',
        workspacePath,
      });
    }

    emitProgress(input.onProgress, {
      jobId: input.jobId,
      stage: 'frames',
      percent: 55,
      message: 'Extraindo quadros para análise visual...',
      detail: `1 quadro a cada ${FRAME_INTERVAL_SECONDS}s`,
      workspacePath,
    });

    const framePattern = path.join(framesDirectory, 'frame-%06d.jpg');
    await runFfmpeg(
      [
        '-hide_banner',
        '-y',
        '-i',
        input.filePath,
        '-an',
        '-vf',
        `fps=1/${FRAME_INTERVAL_SECONDS},scale=640:-2`,
        '-q:v',
        '4',
        '-progress',
        'pipe:1',
        '-nostats',
        framePattern,
      ],
      {
        jobId: input.jobId,
        stage: 'frames',
        message: 'Extraindo quadros do vídeo...',
        workspacePath,
        durationSeconds: metadata.durationSeconds,
        startPercent: 55,
        endPercent: 94,
        signal: input.signal,
        onProgress: input.onProgress,
      },
    );

    emitProgress(input.onProgress, {
      jobId: input.jobId,
      stage: 'finalizing',
      percent: 97,
      message: 'Organizando arquivos para a próxima etapa da IA...',
      detail: workspacePath,
      workspacePath,
    });

    emitProgress(input.onProgress, {
      jobId: input.jobId,
      stage: 'completed',
      percent: 100,
      message: 'Pré-análise concluída.',
      detail: 'Áudio e quadros preparados para transcrição e análise inteligente.',
      workspacePath,
    });

    return {
      jobId: input.jobId,
      workspacePath,
      audioPath: generatedAudioPath,
      framesDirectory,
      frameIntervalSeconds: FRAME_INTERVAL_SECONDS,
      metadata,
    };
  } catch (error) {
    const canceled =
      input.signal.aborted ||
      (error instanceof Error && error.message === 'ANALYSIS_CANCELED');

    if (canceled) {
      emitProgress(input.onProgress, {
        jobId: input.jobId,
        stage: 'canceled',
        percent: 0,
        message: 'Análise cancelada. Limpando arquivos temporários...',
        workspacePath,
      });
    }

    await rm(workspacePath, { recursive: true, force: true });

    if (canceled) {
      throw new Error('ANALYSIS_CANCELED');
    }

    throw error;
  }
}
