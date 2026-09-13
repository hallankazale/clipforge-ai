import type { PilotProductionSettings } from '../services/pilot-queue-types';

const PILOT_PLATFORMS = new Set(['YouTube Shorts', 'TikTok']);

export function normalizePilotSettings(value: unknown): PilotProductionSettings | null {
  if (!value || typeof value !== 'object') return null;
  const input = value as Partial<PilotProductionSettings>;
  const niche = input.niche;

  if (!niche || typeof niche !== 'object') return null;
  if (
    typeof niche.id !== 'string' ||
    typeof niche.label !== 'string' ||
    typeof niche.audience !== 'string' ||
    typeof niche.tone !== 'string' ||
    typeof niche.visualStyle !== 'string' ||
    !Array.isArray(niche.contentPillars)
  ) return null;

  const platforms = Array.isArray(input.platforms)
    ? [...new Set(input.platforms)].filter((platform) => PILOT_PLATFORMS.has(platform))
    : [];

  if (platforms.length === 0) return null;
  if (![30, 45, 60].includes(input.durationSeconds as number)) return null;
  if (![1, 2, 3].includes(input.videosPerDay as number)) return null;
  if (![1, 2, 3].includes(input.maxRetries as number)) return null;
  if (
    typeof input.minimumQualityScore !== 'number' ||
    input.minimumQualityScore < 75 ||
    input.minimumQualityScore > 95
  ) return null;
  if (typeof input.autoRetry !== 'boolean') return null;

  return {
    niche: {
      id: niche.id.slice(0, 80),
      label: niche.label.slice(0, 120),
      audience: niche.audience.slice(0, 300),
      tone: niche.tone.slice(0, 200),
      visualStyle: niche.visualStyle.slice(0, 500),
      contentPillars: niche.contentPillars
        .filter((item): item is string => typeof item === 'string')
        .slice(0, 12)
        .map((item) => item.slice(0, 120)),
    },
    platforms: platforms as PilotProductionSettings['platforms'],
    durationSeconds: input.durationSeconds as 30 | 45 | 60,
    videosPerDay: input.videosPerDay as 1 | 2 | 3,
    minimumQualityScore: input.minimumQualityScore,
    autoRetry: input.autoRetry,
    maxRetries: input.maxRetries as 1 | 2 | 3,
  };
}
