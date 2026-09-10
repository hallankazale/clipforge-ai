import { describe, expect, it } from 'vitest';
import { buildSmartCutPlan } from '../../apps/desktop/electron/services/smart-cut-engine';

describe('buildSmartCutPlan', () => {
  it('gera um único corte quando o vídeo é menor que a duração solicitada', () => {
    const cuts = buildSmartCutPlan({
      sourceDurationSeconds: 42,
      requestedDurationMinutes: 1,
      hasAudio: true,
      silences: [],
      visualSamples: [
        { timeSeconds: 0, deltaRatio: 0.1 },
        { timeSeconds: 10, deltaRatio: 0.3 },
      ],
    });

    expect(cuts).toHaveLength(1);
    expect(cuts[0].startSeconds).toBe(0);
    expect(cuts[0].durationSeconds).toBe(42);
  });

  it('prefere janelas com áudio ativo quando o início do vídeo é silencioso', () => {
    const cuts = buildSmartCutPlan({
      sourceDurationSeconds: 300,
      requestedDurationMinutes: 1,
      hasAudio: true,
      silences: [{ startSeconds: 0, endSeconds: 120 }],
      visualSamples: Array.from({ length: 31 }, (_, index) => ({
        timeSeconds: index * 10,
        deltaRatio: 0.15,
      })),
    });

    expect(cuts.length).toBeGreaterThan(0);
    expect(cuts[0].startSeconds).toBeGreaterThanOrEqual(120);
    expect(cuts[0].audioActivity).toBeGreaterThan(0.95);
  });

  it('limita a quantidade e evita sobreposição forte entre cortes selecionados', () => {
    const cuts = buildSmartCutPlan({
      sourceDurationSeconds: 900,
      requestedDurationMinutes: 1,
      hasAudio: false,
      silences: [],
      visualSamples: Array.from({ length: 91 }, (_, index) => ({
        timeSeconds: index * 10,
        deltaRatio: (index % 7) / 7,
      })),
    });

    expect(cuts.length).toBeLessThanOrEqual(6);

    for (let i = 0; i < cuts.length; i += 1) {
      for (let j = i + 1; j < cuts.length; j += 1) {
        const aStart = cuts[i].startSeconds;
        const aEnd = aStart + cuts[i].durationSeconds;
        const bStart = cuts[j].startSeconds;
        const bEnd = bStart + cuts[j].durationSeconds;
        const overlap = Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
        expect(overlap).toBeLessThanOrEqual(9);
      }
    }
  });
});
