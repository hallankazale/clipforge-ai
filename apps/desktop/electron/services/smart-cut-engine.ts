import { execFile } from 'node:child_process';
import { readdir, stat, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import ffmpegPath from 'ffmpeg-static';

const execFileAsync = promisify(execFile);

export type CutPlatform = 'Instagram' | 'TikTok' | 'Reels' | 'YouTube';

export interface SmartCutCandidate {
  startSeconds: number;
  durationSeconds: number;
  score: number;
  audioActivity: number;
  visualActivity: number;
}

export interface RenderedCut extends SmartCutCandidate {
  id: string;
  rank: number;
  platform: CutPlatform;
  filePath: string;
}

export interface SmartCutResult {
  cutsDirectory: string;
  candidates: SmartCutCandidate[];
  renderedCuts: RenderedCut[];
}

interface SmartCutInput {
  jobId: string;
  filePath: string;
  outputPath: string;
  sourceDurationSeconds: number;
  requestedDurationMinutes: 1 | 5 | 10;
  platforms: CutPlatform[];
  framesDirectory: string;
  frameIntervalSeconds: number;
  hasAudio: boolean;
  signal: AbortSignal;
  onProgress: (event: {
    phase: 'scoring' | 'cutting';
    percent: number;
    message: string;
    detail?: string;
  }) => void;
}

interface SilenceInterval {
  startSeconds: number;
  endSeconds: number;
}

interface VisualSample {
  timeSeconds: number;
  deltaRatio: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function sanitizeFolderName(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-. ]+|[-. ]+$/g, '')
    .slice(0, 80) || 'video';
}

function overlapSeconds(
  startA: number,
  endA: number,
  startB: number,
  endB: number,
): number {
  return Math.max(0, Math.min(endA, endB) - Math.max(startA, startB));
}

async function detectSilences(
  filePath: string,
  sourceDurationSeconds: number,
  signal: AbortSignal,
): Promise<SilenceInterval[]> {
  if (!ffmpegPath) {
    throw new Error('O binário do FFmpeg não foi encontrado nesta instalação.');
  }

  try {
    const { stderr } = await execFileAsync(
      ffmpegPath,
      [
        '-hide_banner',
        '-loglevel',
        'info',
        '-i',
        filePath,
        '-af',
        'silencedetect=noise=-35dB:d=1.2',
        '-f',
        'null',
        '-',
      ],
      {
        windowsHide: true,
        maxBuffer: 24 * 1024 * 1024,
        signal,
      },
    );

    const intervals: SilenceInterval[] = [];
    let currentStart: number | null = null;

    for (const line of stderr.split(/\r?\n/)) {
      const startMatch = /silence_start:\s*([0-9.]+)/.exec(line);
      if (startMatch) {
        currentStart = Number(startMatch[1]);
        continue;
      }

      const endMatch = /silence_end:\s*([0-9.]+)/.exec(line);
      if (endMatch && currentStart !== null) {
        const endSeconds = Number(endMatch[1]);
        if (Number.isFinite(currentStart) && Number.isFinite(endSeconds)) {
          intervals.push({
            startSeconds: clamp(currentStart, 0, sourceDurationSeconds),
            endSeconds: clamp(endSeconds, 0, sourceDurationSeconds),
          });
        }
        currentStart = null;
      }
    }

    if (currentStart !== null && Number.isFinite(currentStart)) {
      intervals.push({
        startSeconds: clamp(currentStart, 0, sourceDurationSeconds),
        endSeconds: sourceDurationSeconds,
      });
    }

    return intervals;
  } catch (error) {
    if (signal.aborted || (error instanceof Error && error.name === 'AbortError')) {
      throw new Error('ANALYSIS_CANCELED');
    }

    // O ranking ainda pode funcionar só com atividade visual caso a análise de silêncio falhe.
    return [];
  }
}

async function loadVisualSamples(
  framesDirectory: string,
  frameIntervalSeconds: number,
): Promise<VisualSample[]> {
  const files = (await readdir(framesDirectory))
    .filter((file) => /^frame-\d+\.jpg$/i.test(file))
    .sort();

  const samples: VisualSample[] = [];
  let previousSize: number | null = null;

  for (const file of files) {
    const match = /frame-(\d+)\.jpg/i.exec(file);
    if (!match) continue;

    const index = Number(match[1]);
    const info = await stat(path.join(framesDirectory, file));
    const currentSize = info.size;

    let deltaRatio = 0;
    if (previousSize !== null && currentSize > 0 && previousSize > 0) {
      deltaRatio = clamp(
        Math.abs(currentSize - previousSize) / Math.max(currentSize, previousSize),
        0,
        1,
      );
    }

    samples.push({
      timeSeconds: Math.max(0, (index - 1) * frameIntervalSeconds),
      deltaRatio,
    });
    previousSize = currentSize;
  }

  return samples;
}

function calculateAudioActivity(
  startSeconds: number,
  durationSeconds: number,
  silences: SilenceInterval[],
): number {
  const endSeconds = startSeconds + durationSeconds;
  const silentSeconds = silences.reduce(
    (total, silence) =>
      total + overlapSeconds(startSeconds, endSeconds, silence.startSeconds, silence.endSeconds),
    0,
  );

  return clamp(1 - silentSeconds / Math.max(durationSeconds, 1), 0, 1);
}

function calculateVisualActivity(
  startSeconds: number,
  durationSeconds: number,
  samples: VisualSample[],
): number {
  const endSeconds = startSeconds + durationSeconds;
  const inside = samples.filter(
    (sample) => sample.timeSeconds >= startSeconds && sample.timeSeconds <= endSeconds,
  );

  if (inside.length === 0) return 0;
  return clamp(
    inside.reduce((total, sample) => total + sample.deltaRatio, 0) / inside.length,
    0,
    1,
  );
}

export function buildSmartCutPlan(input: {
  sourceDurationSeconds: number;
  requestedDurationMinutes: 1 | 5 | 10;
  hasAudio: boolean;
  silences: SilenceInterval[];
  visualSamples: VisualSample[];
}): SmartCutCandidate[] {
  const targetSeconds = Math.min(
    input.sourceDurationSeconds,
    input.requestedDurationMinutes * 60,
  );

  if (targetSeconds <= 0) return [];

  const maxCuts = input.requestedDurationMinutes === 1
    ? 6
    : input.requestedDurationMinutes === 5
      ? 4
      : 3;

  const desiredCount = Math.max(
    1,
    Math.min(maxCuts, Math.floor(input.sourceDurationSeconds / targetSeconds)),
  );

  if (input.sourceDurationSeconds <= targetSeconds + 1) {
    return [{
      startSeconds: 0,
      durationSeconds: targetSeconds,
      audioActivity: input.hasAudio ? calculateAudioActivity(0, targetSeconds, input.silences) : 0,
      visualActivity: calculateVisualActivity(0, targetSeconds, input.visualSamples),
      score: 1,
    }];
  }

  const lastStart = Math.max(0, input.sourceDurationSeconds - targetSeconds);
  const stepSeconds = clamp(targetSeconds / 3, 10, 30);
  const starts = new Set<number>();

  for (let start = 0; start <= lastStart; start += stepSeconds) {
    starts.add(Math.round(start * 10) / 10);
  }
  starts.add(Math.round(lastStart * 10) / 10);

  const candidates = [...starts].map((startSeconds) => {
    const audioActivity = input.hasAudio
      ? calculateAudioActivity(startSeconds, targetSeconds, input.silences)
      : 0;
    const visualActivity = calculateVisualActivity(
      startSeconds,
      targetSeconds,
      input.visualSamples,
    );
    const score = input.hasAudio
      ? audioActivity * 0.72 + visualActivity * 0.28
      : visualActivity;

    return {
      startSeconds,
      durationSeconds: targetSeconds,
      audioActivity,
      visualActivity,
      score,
    };
  });

  const sorted = candidates.sort((a, b) => b.score - a.score);
  const selected: SmartCutCandidate[] = [];

  for (const candidate of sorted) {
    const candidateEnd = candidate.startSeconds + candidate.durationSeconds;
    const overlapsTooMuch = selected.some((current) => {
      const currentEnd = current.startSeconds + current.durationSeconds;
      return overlapSeconds(
        candidate.startSeconds,
        candidateEnd,
        current.startSeconds,
        currentEnd,
      ) > targetSeconds * 0.15;
    });

    if (!overlapsTooMuch) selected.push(candidate);
    if (selected.length >= desiredCount) break;
  }

  return selected.length > 0 ? selected : [sorted[0]];
}

function platformFilter(platform: CutPlatform): string {
  if (platform === 'YouTube') {
    return 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1';
  }

  return 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1';
}

function platformFolder(platform: CutPlatform): string {
  return platform.toLowerCase();
}

async function renderCut(
  input: SmartCutInput,
  candidate: SmartCutCandidate,
  rank: number,
  platform: CutPlatform,
  destination: string,
): Promise<void> {
  if (!ffmpegPath) {
    throw new Error('O binário do FFmpeg não foi encontrado nesta instalação.');
  }

  try {
    await execFileAsync(
      ffmpegPath,
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-y',
        '-ss',
        candidate.startSeconds.toFixed(3),
        '-i',
        input.filePath,
        '-t',
        candidate.durationSeconds.toFixed(3),
        '-map',
        '0:v:0',
        '-map',
        '0:a:0?',
        '-vf',
        platformFilter(platform),
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '22',
        '-pix_fmt',
        'yuv420p',
        '-c:a',
        'aac',
        '-b:a',
        '160k',
        '-movflags',
        '+faststart',
        '-sn',
        '-dn',
        destination,
      ],
      {
        windowsHide: true,
        maxBuffer: 8 * 1024 * 1024,
        signal: input.signal,
      },
    );
  } catch (error) {
    if (input.signal.aborted || (error instanceof Error && error.name === 'AbortError')) {
      throw new Error('ANALYSIS_CANCELED');
    }

    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    throw new Error(`Falha ao renderizar o corte ${rank} para ${platform}. ${message}`);
  }
}

export async function createSmartCuts(input: SmartCutInput): Promise<SmartCutResult> {
  input.onProgress({
    phase: 'scoring',
    percent: 0,
    message: 'Medindo atividade de áudio e vídeo...',
  });

  const [silences, visualSamples] = await Promise.all([
    input.hasAudio
      ? detectSilences(input.filePath, input.sourceDurationSeconds, input.signal)
      : Promise.resolve([]),
    loadVisualSamples(input.framesDirectory, input.frameIntervalSeconds),
  ]);

  const candidates = buildSmartCutPlan({
    sourceDurationSeconds: input.sourceDurationSeconds,
    requestedDurationMinutes: input.requestedDurationMinutes,
    hasAudio: input.hasAudio,
    silences,
    visualSamples,
  });

  if (candidates.length === 0) {
    throw new Error('Não foi possível encontrar um trecho válido para gerar cortes.');
  }

  input.onProgress({
    phase: 'scoring',
    percent: 100,
    message: `${candidates.length} trecho(s) selecionado(s) pelo ranking local.`,
    detail: 'Prioridade para trechos com áudio ativo e maior variação visual.',
  });

  const sourceBaseName = sanitizeFolderName(path.basename(input.filePath, path.extname(input.filePath)));
  const cutsDirectory = path.join(
    input.outputPath,
    'Cortes',
    sourceBaseName,
    input.jobId,
  );
  await mkdir(cutsDirectory, { recursive: true });

  const normalizedPlatforms = [...new Set(input.platforms)].filter((platform): platform is CutPlatform =>
    ['Instagram', 'TikTok', 'Reels', 'YouTube'].includes(platform),
  );
  const platforms = normalizedPlatforms.length > 0 ? normalizedPlatforms : ['YouTube' as CutPlatform];
  const totalRenders = candidates.length * platforms.length;
  const renderedCuts: RenderedCut[] = [];
  let completedRenders = 0;

  for (let candidateIndex = 0; candidateIndex < candidates.length; candidateIndex += 1) {
    const candidate = candidates[candidateIndex];
    const rank = candidateIndex + 1;

    for (const platform of platforms) {
      const folder = path.join(cutsDirectory, platformFolder(platform));
      await mkdir(folder, { recursive: true });
      const filePath = path.join(folder, `corte-${String(rank).padStart(2, '0')}.mp4`);

      input.onProgress({
        phase: 'cutting',
        percent: Math.round((completedRenders / totalRenders) * 100),
        message: `Renderizando corte ${rank}/${candidates.length} para ${platform}...`,
        detail: `${Math.round(candidate.startSeconds)}s → ${Math.round(candidate.startSeconds + candidate.durationSeconds)}s`,
      });

      await renderCut(input, candidate, rank, platform, filePath);
      completedRenders += 1;
      renderedCuts.push({
        ...candidate,
        id: `${input.jobId}-${rank}-${platform}`,
        rank,
        platform,
        filePath,
      });

      input.onProgress({
        phase: 'cutting',
        percent: Math.round((completedRenders / totalRenders) * 100),
        message: `Corte ${rank} para ${platform} concluído.`,
        detail: filePath,
      });
    }
  }

  return {
    cutsDirectory,
    candidates,
    renderedCuts,
  };
}
