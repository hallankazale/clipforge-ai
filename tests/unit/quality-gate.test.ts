import { describe, expect, it } from 'vitest';
import { evaluateQualityGate } from '../../apps/desktop/src/pilot/quality';

describe('evaluateQualityGate', () => {
  it('aprova um vídeo forte acima da meta sem métricas críticas fracas', () => {
    const result = evaluateQualityGate({
      hook: 91,
      storytelling: 87,
      visualConsistency: 88,
      pacing: 86,
      voiceClarity: 90,
      captionReadability: 92,
      originality: 84,
      platformFit: 94,
    }, 82);

    expect(result.passed).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(82);
    expect(result.issues).toHaveLength(0);
  });

  it('reprova mesmo com média boa quando o hook cai abaixo do mínimo crítico', () => {
    const result = evaluateQualityGate({
      hook: 62,
      storytelling: 95,
      visualConsistency: 92,
      pacing: 93,
      voiceClarity: 94,
      captionReadability: 93,
      originality: 90,
      platformFit: 94,
    }, 82);

    expect(result.passed).toBe(false);
    expect(result.issues.some((issue) => issue.metric === 'hook')).toBe(true);
    expect(result.nextActions).toContain('rewrite-hook');
  });

  it('indica regeneração visual e de voz quando essas áreas são fracas', () => {
    const result = evaluateQualityGate({
      hook: 88,
      storytelling: 84,
      visualConsistency: 51,
      pacing: 80,
      voiceClarity: 61,
      captionReadability: 86,
      originality: 82,
      platformFit: 88,
    }, 82);

    expect(result.passed).toBe(false);
    expect(result.nextActions).toContain('regenerate-visuals');
    expect(result.nextActions).toContain('regenerate-voice');
  });
});
