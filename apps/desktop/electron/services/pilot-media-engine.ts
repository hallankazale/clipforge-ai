import { execFile } from 'node:child_process';
import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { getFfmpegPath } from './static-binaries';

const execFileAsync = promisify(execFile);

export interface PilotMediaScene {
  caption: string;
  durationSeconds: number;
}

function toSrtTime(value: number): string {
  const totalMs = Math.max(0, Math.round(value * 1000));
  const hours = Math.floor(totalMs / 3_600_000);
  const minutes = Math.floor((totalMs % 3_600_000) / 60_000);
  const seconds = Math.floor((totalMs % 60_000) / 1000);
  const millis = totalMs % 1000;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
}

function escapeConcatPath(filePath: string): string {
  return filePath.replace(/'/g, "'\\''");
}

function escapeSubtitlePath(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");
}

export async function writePilotSrt(
  scenes: PilotMediaScene[],
  destination: string,
): Promise<void> {
  let cursor = 0;
  const blocks = scenes.map((scene, index) => {
    const start = cursor;
    cursor += Math.max(0.5, scene.durationSeconds);
    return `${index + 1}\n${toSrtTime(start)} --> ${toSrtTime(cursor)}\n${scene.caption.trim()}\n`;
  });
  await writeFile(destination, blocks.join('\n'), 'utf8');
}

export async function renderPilotVerticalVideo(input: {
  scenes: PilotMediaScene[];
  imagePaths: string[];
  narrationPath: string;
  captionsPath: string;
  outputPath: string;
  signal: AbortSignal;
}): Promise<void> {
  if (input.scenes.length === 0 || input.scenes.length !== input.imagePaths.length) {
    throw new Error('Storyboard e imagens precisam ter a mesma quantidade de cenas.');
  }

  const ffmpegPath = getFfmpegPath();
  await access(ffmpegPath);
  await access(input.narrationPath);
  await access(input.captionsPath);
  await Promise.all(input.imagePaths.map((filePath) => access(filePath)));
  await mkdir(path.dirname(input.outputPath), { recursive: true });

  const concatPath = path.join(path.dirname(input.outputPath), 'visuals.concat.txt');
  const concatLines: string[] = [];
  input.imagePaths.forEach((imagePath, index) => {
    concatLines.push(`file '${escapeConcatPath(imagePath)}'`);
    concatLines.push(`duration ${Math.max(0.5, input.scenes[index].durationSeconds).toFixed(3)}`);
  });
  concatLines.push(`file '${escapeConcatPath(input.imagePaths[input.imagePaths.length - 1])}'`);
  await writeFile(concatPath, `${concatLines.join('\n')}\n`, 'utf8');

  const filter = [
    'scale=1080:1920:force_original_aspect_ratio=increase',
    'crop=1080:1920',
    'fps=30',
    `subtitles='${escapeSubtitlePath(input.captionsPath)}':force_style='FontName=Arial,FontSize=22,Bold=1,PrimaryColour=&H00FFFFFF,OutlineColour=&H00101010,BorderStyle=1,Outline=3,Shadow=1,Alignment=2,MarginV=190'`,
  ].join(',');

  try {
    await execFileAsync(ffmpegPath, [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'concat', '-safe', '0', '-i', concatPath,
      '-i', input.narrationPath,
      '-vf', filter,
      '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '192k',
      '-movflags', '+faststart', '-shortest', input.outputPath,
    ], {
      windowsHide: true,
      maxBuffer: 20 * 1024 * 1024,
      signal: input.signal,
    });
  } catch (error) {
    if (input.signal.aborted || (error instanceof Error && error.name === 'AbortError')) {
      throw new Error('PILOT_CANCELED');
    }
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    throw new Error(`Falha ao montar o vídeo com FFmpeg. ${message}`);
  }
}
