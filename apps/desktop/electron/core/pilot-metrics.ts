import type { VideoMetadata } from '../services/video-engine';

function clamp(value: number): number {
  return Math.round(Math.min(100, Math.max(0, value)));
}

function words(value: string): string[] {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

export function scorePacing(script: string, durationSeconds: number): number {
  if (durationSeconds <= 0) return 0;
  const rate = words(script).length / durationSeconds;
  if (rate >= 2.0 && rate <= 3.1) return 100;
  const distance = rate < 2.0 ? 2.0 - rate : rate - 3.1;
  return clamp(100 - distance * 45);
}

export function scoreCaptionReadability(
  scenes: Array<{ caption: string; durationSeconds: number }>,
): number {
  if (scenes.length === 0) return 0;
  const scores = scenes.map((scene) => {
    const duration = Math.max(0.5, scene.durationSeconds);
    const charsPerSecond = scene.caption.trim().length / duration;
    const linePenalty = scene.caption.trim().length > 90 ? 12 : 0;
    if (charsPerSecond <= 17) return 100 - linePenalty;
    return clamp(100 - (charsPerSecond - 17) * 8 - linePenalty);
  });
  return clamp(scores.reduce((sum, score) => sum + score, 0) / scores.length);
}

export function scoreVoiceClarity(expected: string, transcript: string): number {
  const source = words(expected);
  const heard = words(transcript);
  if (source.length === 0 || heard.length === 0) return 0;

  const previous = Array.from({ length: heard.length + 1 }, (_, index) => index);
  for (let i = 1; i <= source.length; i += 1) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= heard.length; j += 1) {
      const above = previous[j];
      const cost = source[i - 1] === heard[j - 1] ? 0 : 1;
      previous[j] = Math.min(previous[j] + 1, previous[j - 1] + 1, diagonal + cost);
      diagonal = above;
    }
  }

  const editDistance = previous[heard.length];
  const denominator = Math.max(source.length, heard.length);
  return clamp((1 - editDistance / denominator) * 100);
}

export function scorePlatformFit(
  metadata: VideoMetadata,
  targetDurationSeconds: number,
): number {
  let score = 100;
  if (metadata.width !== 1080 || metadata.height !== 1920) score -= 35;
  if (metadata.videoCodec !== 'h264') score -= 20;
  if (metadata.audioCodec !== 'aac') score -= 15;
  if (!metadata.fps || metadata.fps < 24 || metadata.fps > 60) score -= 10;

  const durationDelta = Math.abs(metadata.durationSeconds - targetDurationSeconds);
  if (durationDelta > 8) score -= 20;
  else if (durationDelta > 4) score -= 10;

  return clamp(score);
}
