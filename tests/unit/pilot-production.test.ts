import { describe, expect, it } from 'vitest';
import { evaluateQualityGate } from '../../apps/desktop/src/pilot/quality';
import { buildSevenDaySchedule, decideProductionAfterQualityGate } from '../../apps/desktop/src/pilot/production';

describe('pilot production orchestration', () => {
  it('aprova quando o quality gate passa', () => {
    const quality = evaluateQualityGate({
      hook: 90,
      storytelling: 88,
      visualConsistency: 87,
      pacing: 86,
      voiceClarity: 90,
      captionReadability: 91,
      originality: 84,
      platformFit: 93,
    }, 82);

    expect(decideProductionAfterQualityGate({
      quality,
      currentAttempt: 1,
      maxRetries: 3,
      autoRetry: true,
    })).toEqual({ status: 'approved', actions: [] });
  });

  it('manda corrigir somente as áreas fracas enquanto ainda há tentativas', () => {
    const quality = evaluateQualityGate({
      hook: 58,
      storytelling: 84,
      visualConsistency: 85,
      pacing: 82,
      voiceClarity: 89,
      captionReadability: 90,
      originality: 83,
      platformFit: 92,
    }, 82);

    const decision = decideProductionAfterQualityGate({
      quality,
      currentAttempt: 1,
      maxRetries: 3,
      autoRetry: true,
    });

    expect(decision.status).toBe('retry');
    if (decision.status === 'retry') {
      expect(decision.nextAttempt).toBe(2);
      expect(decision.actions).toContain('rewrite-hook');
    }
  });

  it('para a automação e pede revisão quando acaba o limite de tentativas', () => {
    const quality = evaluateQualityGate({
      hook: 55,
      storytelling: 60,
      visualConsistency: 82,
      pacing: 78,
      voiceClarity: 90,
      captionReadability: 88,
      originality: 80,
      platformFit: 90,
    }, 82);

    const decision = decideProductionAfterQualityGate({
      quality,
      currentAttempt: 3,
      maxRetries: 3,
      autoRetry: true,
    });

    expect(decision.status).toBe('manual-review');
  });

  it('gera a quantidade correta de slots para sete dias', () => {
    expect(buildSevenDaySchedule(1)).toHaveLength(7);
    expect(buildSevenDaySchedule(2)).toHaveLength(14);
    expect(buildSevenDaySchedule(3)).toHaveLength(21);
  });
});
