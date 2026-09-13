import { describe, expect, it } from 'vitest';
import {
  scoreCaptionReadability,
  scorePacing,
  scorePlatformFit,
  scoreVoiceClarity,
} from '../../apps/desktop/electron/core/pilot-metrics';

describe('pilot local quality metrics', () => {
  it('reconhece um ritmo de narração adequado', () => {
    const script = Array.from({ length: 120 }, () => 'palavra').join(' ');
    expect(scorePacing(script, 50)).toBe(100);
  });

  it('penaliza legenda densa demais para o tempo da cena', () => {
    const score = scoreCaptionReadability([
      { caption: 'Uma legenda muito longa para aparecer inteira em apenas um segundo de vídeo.', durationSeconds: 1 },
    ]);
    expect(score).toBeLessThan(70);
  });

  it('mede a proximidade entre roteiro e transcrição', () => {
    expect(scoreVoiceClarity('o gato correu pela casa', 'o gato correu pela casa')).toBe(100);
    expect(scoreVoiceClarity('o gato correu pela casa', 'texto totalmente diferente')).toBeLessThan(70);
  });

  it('aprova o perfil técnico vertical esperado', () => {
    expect(scorePlatformFit({
      filePath: 'video.mp4',
      fileName: 'video.mp4',
      extension: '.mp4',
      durationSeconds: 45,
      width: 1080,
      height: 1920,
      fps: 30,
      videoCodec: 'h264',
      audioCodec: 'aac',
      container: 'mov,mp4,m4a,3gp,3g2,mj2',
      sizeBytes: 1_000_000,
      bitrate: 2_000_000,
    }, 45)).toBe(100);
  });
});
