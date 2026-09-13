import { describe, expect, it } from 'vitest';
import { normalizePilotSettings } from '../../apps/desktop/electron/core/pilot-settings';

const validSettings = {
  niche: {
    id: 'tecnologia-ia',
    label: 'Tecnologia e IA',
    audience: 'Pessoas interessadas em tecnologia',
    tone: 'Didático e direto',
    visualStyle: 'Futurista limpo',
    contentPillars: ['IA', 'Automação'],
  },
  platforms: ['YouTube Shorts', 'TikTok'],
  durationSeconds: 45,
  videosPerDay: 2,
  minimumQualityScore: 82,
  autoRetry: true,
  maxRetries: 3,
};

describe('normalizePilotSettings', () => {
  it('aceita uma configuração mobile válida', () => {
    const normalized = normalizePilotSettings(validSettings);
    expect(normalized).not.toBeNull();
    expect(normalized?.platforms).toEqual(['YouTube Shorts', 'TikTok']);
    expect(normalized?.durationSeconds).toBe(45);
  });

  it('rejeita plataforma não autorizada', () => {
    const normalized = normalizePilotSettings({
      ...validSettings,
      platforms: ['YouTube Shorts', 'shell-admin'],
    });
    expect(normalized?.platforms).toEqual(['YouTube Shorts']);
  });

  it('rejeita duração e nota fora dos limites', () => {
    expect(normalizePilotSettings({ ...validSettings, durationSeconds: 999 })).toBeNull();
    expect(normalizePilotSettings({ ...validSettings, minimumQualityScore: 100 })).toBeNull();
  });

  it('rejeita payload sem plataforma válida', () => {
    expect(normalizePilotSettings({ ...validSettings, platforms: ['invalida'] })).toBeNull();
  });
});
