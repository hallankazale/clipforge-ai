import { execFile } from 'node:child_process';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import ffprobeStatic from 'ffprobe-static';

const execFileAsync = promisify(execFile);

const SUPPORTED_VIDEO_EXTENSIONS = new Set([
  '.mp4',
  '.mov',
  '.mkv',
  '.avi',
  '.webm',
  '.m4v',
  '.mpeg',
  '.mpg',
]);

interface ProbeStream {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  avg_frame_rate?: string;
  r_frame_rate?: string;
  duration?: string;
}

interface ProbeFormat {
  filename?: string;
  format_name?: string;
  duration?: string;
  size?: string;
  bit_rate?: string;
}

interface ProbeOutput {
  streams?: ProbeStream[];
  format?: ProbeFormat;
}

export interface VideoMetadata {
  filePath: string;
  fileName: string;
  extension: string;
  durationSeconds: number;
  width: number | null;
  height: number | null;
  fps: number | null;
  videoCodec: string | null;
  audioCodec: string | null;
  container: string | null;
  sizeBytes: number | null;
  bitrate: number | null;
}

function parseNumber(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseFrameRate(value: string | undefined): number | null {
  if (!value) return null;

  if (!value.includes('/')) {
    return parseNumber(value);
  }

  const [numeratorRaw, denominatorRaw] = value.split('/');
  const numerator = Number(numeratorRaw);
  const denominator = Number(denominatorRaw);

  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return null;
  }

  return numerator / denominator;
}

export function parseProbeOutput(filePath: string, output: ProbeOutput): VideoMetadata {
  const streams = output.streams ?? [];
  const videoStream = streams.find((stream) => stream.codec_type === 'video');
  const audioStream = streams.find((stream) => stream.codec_type === 'audio');
  const format = output.format ?? {};

  const duration =
    parseNumber(format.duration) ??
    parseNumber(videoStream?.duration) ??
    0;

  return {
    filePath,
    fileName: path.basename(filePath),
    extension: path.extname(filePath).toLowerCase(),
    durationSeconds: duration,
    width: videoStream?.width ?? null,
    height: videoStream?.height ?? null,
    fps: parseFrameRate(videoStream?.avg_frame_rate ?? videoStream?.r_frame_rate),
    videoCodec: videoStream?.codec_name ?? null,
    audioCodec: audioStream?.codec_name ?? null,
    container: format.format_name ?? null,
    sizeBytes: parseNumber(format.size),
    bitrate: parseNumber(format.bit_rate),
  };
}

export async function probeVideo(filePath: string): Promise<VideoMetadata> {
  if (!path.isAbsolute(filePath)) {
    throw new Error('O caminho do vídeo precisa ser absoluto.');
  }

  const extension = path.extname(filePath).toLowerCase();
  if (!SUPPORTED_VIDEO_EXTENSIONS.has(extension)) {
    throw new Error(`Formato de vídeo não suportado: ${extension || 'sem extensão'}.`);
  }

  await access(filePath);
  await access(ffprobeStatic.path);

  const args = [
    '-v',
    'error',
    '-print_format',
    'json',
    '-show_format',
    '-show_streams',
    filePath,
  ];

  try {
    const { stdout } = await execFileAsync(ffprobeStatic.path, args, {
      windowsHide: true,
      maxBuffer: 10 * 1024 * 1024,
    });

    const parsed = JSON.parse(stdout) as ProbeOutput;
    return parseProbeOutput(filePath, parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    throw new Error(`Não foi possível analisar o vídeo com FFprobe. ${message}`);
  }
}
