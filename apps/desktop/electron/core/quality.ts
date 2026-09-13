export type PilotPlatform = 'YouTube Shorts' | 'TikTok';

export type QualityMetricKey =
  | 'hook'
  | 'storytelling'
  | 'visualConsistency'
  | 'pacing'
  | 'voiceClarity'
  | 'captionReadability'
  | 'originality'
  | 'platformFit';

export interface QualityMetrics {
  hook: number;
  storytelling: number;
  visualConsistency: number;
  pacing: number;
  voiceClarity: number;
  captionReadability: number;
  originality: number;
  platformFit: number;
}

export type QualityAction =
  | 'rewrite-hook'
  | 'rewrite-script'
  | 'regenerate-visuals'
  | 'retime-edit'
  | 'regenerate-voice'
  | 'regenerate-captions'
  | 'diversify-concept'
  | 'adjust-platform-format';

export interface QualityIssue {
  metric: QualityMetricKey;
  score: number;
  minimum: number;
  action: QualityAction;
  message: string;
}

export interface QualityGateResult {
  score: number;
  passed: boolean;
  minimumScore: number;
  issues: QualityIssue[];
  nextActions: QualityAction[];
}

const weights: Record<QualityMetricKey, number> = {
  hook: 0.20,
  storytelling: 0.17,
  visualConsistency: 0.13,
  pacing: 0.13,
  voiceClarity: 0.10,
  captionReadability: 0.10,
  originality: 0.10,
  platformFit: 0.07,
};

const criticalThresholds: Partial<Record<QualityMetricKey, number>> = {
  hook: 70,
  visualConsistency: 68,
  voiceClarity: 72,
  captionReadability: 70,
  originality: 65,
};

const actionByMetric: Record<QualityMetricKey, QualityAction> = {
  hook: 'rewrite-hook',
  storytelling: 'rewrite-script',
  visualConsistency: 'regenerate-visuals',
  pacing: 'retime-edit',
  voiceClarity: 'regenerate-voice',
  captionReadability: 'regenerate-captions',
  originality: 'diversify-concept',
  platformFit: 'adjust-platform-format',
};

const labels: Record<QualityMetricKey, string> = {
  hook: 'Hook',
  storytelling: 'Roteiro',
  visualConsistency: 'Consistência visual',
  pacing: 'Ritmo',
  voiceClarity: 'Voz',
  captionReadability: 'Legendas',
  originality: 'Originalidade',
  platformFit: 'Formato da plataforma',
};

function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.round(Math.min(100, Math.max(0, score)));
}

function normalizeMetrics(metrics: QualityMetrics): QualityMetrics {
  return {
    hook: clampScore(metrics.hook),
    storytelling: clampScore(metrics.storytelling),
    visualConsistency: clampScore(metrics.visualConsistency),
    pacing: clampScore(metrics.pacing),
    voiceClarity: clampScore(metrics.voiceClarity),
    captionReadability: clampScore(metrics.captionReadability),
    originality: clampScore(metrics.originality),
    platformFit: clampScore(metrics.platformFit),
  };
}

export function evaluateQualityGate(
  metrics: QualityMetrics,
  minimumScore = 82,
): QualityGateResult {
  const normalized = normalizeMetrics(metrics);

  const weightedScore = (Object.keys(weights) as QualityMetricKey[]).reduce(
    (total, key) => total + normalized[key] * weights[key],
    0,
  );
  const score = Math.round(weightedScore);

  const issues: QualityIssue[] = [];
  for (const key of Object.keys(criticalThresholds) as QualityMetricKey[]) {
    const minimum = criticalThresholds[key];
    if (minimum === undefined || normalized[key] >= minimum) continue;

    issues.push({
      metric: key,
      score: normalized[key],
      minimum,
      action: actionByMetric[key],
      message: `${labels[key]} abaixo do mínimo de segurança de qualidade (${normalized[key]}/${minimum}).`,
    });
  }

  if (score < minimumScore) {
    const weakestMetrics = (Object.keys(weights) as QualityMetricKey[])
      .sort((a, b) => normalized[a] - normalized[b])
      .slice(0, 2);

    for (const key of weakestMetrics) {
      if (issues.some((issue) => issue.metric === key)) continue;
      issues.push({
        metric: key,
        score: normalized[key],
        minimum: minimumScore,
        action: actionByMetric[key],
        message: `${labels[key]} é um dos pontos que mais reduz a nota final.`,
      });
    }
  }

  const nextActions = [...new Set(issues.map((issue) => issue.action))];
  return {
    score,
    passed: score >= minimumScore && issues.length === 0,
    minimumScore,
    issues,
    nextActions,
  };
}

export const qualityMetricLabels = labels;
