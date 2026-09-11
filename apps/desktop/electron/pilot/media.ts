import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { getFfmpegPath, getFfprobePath } from '../services/static-binaries';
import type { TechnicalReport, Word } from './contracts';

const execute = promisify(execFile);
export async function ffmpeg(args: string[], cwd: string, signal: AbortSignal): Promise<string> {
  try {
    const { stderr } = await execute(getFfmpegPath(), ['-hide_banner', '-nostdin', '-y', ...args], { cwd, signal, timeout: 900_000, windowsHide: true, maxBuffer: 16_000_000 });
    return stderr;
  } catch { signal.throwIfAborted(); throw new Error('Falha ao renderizar ou analisar mídia. Confira espaço livre e instalação do FFmpeg.'); }
}
export async function mediaProbe(file: string, signal: AbortSignal): Promise<any> {
  const { stdout } = await execute(getFfprobePath(), ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file], { signal, timeout: 30_000, windowsHide: true });
  return JSON.parse(stdout);
}
export function transcriptSimilarity(expected: string, actual: string): number {
  const tokens = (s: string) => s.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').match(/[\p{L}\p{N}]+/gu) ?? [];
  const a = tokens(expected), b = tokens(actual);
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) next[j] = Math.min(next[j - 1] + 1, row[j] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    row = next;
  }
  return Math.max(0, 1 - row[b.length] / Math.max(1, a.length, b.length));
}
const stamp = (t: number) => { const cs = Math.round(t * 100); return `${Math.floor(cs / 360000)}:${String(Math.floor(cs / 6000) % 60).padStart(2, '0')}:${String(Math.floor(cs / 100) % 60).padStart(2, '0')}.${String(cs % 100).padStart(2, '0')}`; };
export function buildCaptions(words: Word[]): string {
  const lines: string[] = [];
  for (let i = 0; i < words.length;) {
    const group = [words[i++]];
    while (i < words.length && group.length < 5 && group.map(w => w.word).join(' ').length + words[i].word.length < 32 && words[i].start - group[group.length - 1].end < 0.4) group.push(words[i++]);
    const clean = group.map(w => w.word.replace(/[{}\\\r\n]/g, '').replace(/[\x00-\x1f]/g, '')).join(' ');
    lines.push(`Dialogue: 0,${stamp(group[0].start)},${stamp(group[group.length - 1].end)},Default,,0,0,0,,${clean}`);
  }
  return `[Script Info]\nScriptType: v4.00+\nPlayResX: 1080\nPlayResY: 1920\nWrapStyle: 0\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,Arial,62,&H00FFFFFF,&H00FFFFFF,&H00101010,&H80000000,-1,0,0,0,100,100,0,0,1,4,1,2,120,180,380,1\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n${lines.join('\n')}\n`;
}

export async function compose(directory: string, imageFiles: string[], voiceFile: string, words: Word[], duration: number, signal: AbortSignal, sceneDurations?: number[]): Promise<string> {
  await writeFile(path.join(directory, 'captions.ass'), buildCaptions(words));
  const sceneDuration = duration / imageFiles.length;
  for (let i = 0; i < imageFiles.length; i++) {
    // Render scenes serially at two threads to avoid exhausting modest desktop hardware.
    await ffmpeg(['-loop', '1', '-i', imageFiles[i], '-vf',
      `scale=1200:2134:force_original_aspect_ratio=increase,crop=1200:2134,zoompan=z='min(zoom+0.00035,1.10)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1920:fps=30,setsar=1`,
      '-t', String(sceneDurations?.[i] ?? sceneDuration), '-an', '-c:v', 'libx264', '-preset', 'fast', '-crf', '20', '-pix_fmt', 'yuv420p', '-threads', '2', `scene-${i}.mp4`], directory, signal);
  }
  await writeFile(path.join(directory, 'concat.txt'), imageFiles.map((_, i) => `file 'scene-${i}.mp4'`).join('\n'));
  const video = path.join(directory, 'video.mp4');
  await ffmpeg(['-f', 'concat', '-safe', '1', '-i', 'concat.txt', '-i', voiceFile,
    '-map', '0:v:0', '-map', '1:a:0', '-vf', 'ass=captions.ass', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11',
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', '30', '-threads', '2',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', '-t', String(duration), video], directory, signal);
  return video;
}
export async function inspectVideo(file: string, words: Word[], expectedText: string, target: number, signal: AbortSignal): Promise<{ technical: TechnicalReport; frames: string[] }> {
  const directory = path.dirname(file);
  const probe = await mediaProbe(file, signal);
  const video = probe.streams?.find((s: any) => s.codec_type === 'video');
  const audio = probe.streams?.find((s: any) => s.codec_type === 'audio');
  const duration = Number(probe.format?.duration);
  const log = await ffmpeg(['-i', file, '-vf', 'blackdetect=d=0.4:pix_th=0.10', '-af', 'silencedetect=noise=-40dB:d=0.4,loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'], directory, signal);
  const loudnessText = log.match(/\{\s*"input_i"[\s\S]*?\}/)?.[0];
  const loudness = loudnessText ? JSON.parse(loudnessText) : {};
  const integratedLoudness = Number(loudness.input_i), truePeak = Number(loudness.input_tp);
  const silenceSeconds = [...log.matchAll(/silence_duration:\s*([\d.]+)/g)].reduce((sum, m) => sum + Number(m[1]), 0);
  const captionCoverage = words.reduce((sum, w) => sum + w.end - w.start, 0) / duration;
  const similarity = transcriptSimilarity(expectedText, words.map(w => w.word).join(' '));
  const issues: string[] = [];
  if (video?.width !== 1080 || video?.height !== 1920 || video?.codec_name !== 'h264' || video?.pix_fmt !== 'yuv420p' || video?.avg_frame_rate !== '30/1' || audio?.codec_name !== 'aac') issues.push('Formato, codec ou FPS fora do padrão.');
  if (!Number.isFinite(duration) || Math.abs(duration - target) > 0.6) issues.push('Duração fora do alvo.');
  if (!Number.isFinite(integratedLoudness) || integratedLoudness < -19 || integratedLoudness > -13 || !Number.isFinite(truePeak) || truePeak > -0.5) issues.push('Volume ou pico de áudio fora do padrão.');
  if (silenceSeconds / duration > 0.25) issues.push('Excesso de silêncio.');
  if (/black_duration:/.test(log)) issues.push('Detectado trecho preto no vídeo.');
  if (words.some(w => w.word.length > 32) || !Number.isFinite(captionCoverage) || captionCoverage < 0.35 || words.at(-1)!.end > duration + 0.1 || similarity < 0.85) issues.push('Transcrição ou cobertura de legendas insuficiente.');
  const frames: string[] = [];
  for (let i = 0; i < 6; i++) {
    const frame = path.join(directory, `review-${i}.jpg`);
    const t = i === 0 ? Math.min(words[0].start + 0.2, 2) : duration * (i / 6) + 0.1;
    await ffmpeg(['-ss', String(t), '-i', file, '-frames:v', '1', '-vf', 'scale=540:960', frame], directory, signal); frames.push(frame);
  }
  return { technical: { passed: issues.length === 0, issues, duration, integratedLoudness, truePeak, silenceRatio: silenceSeconds / duration, captionCoverage, transcriptSimilarity: similarity }, frames };
}
export async function digestFile(file: string): Promise<string> {
  // Generated shorts are bounded to 60 seconds; hashing streams avoids duplicating the full MP4 in memory.
  const { createReadStream } = await import('node:fs');
  const hash = createHash('sha256'); for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
